/** DMP API server. */

import sql from "./db";
import { migrate } from "./db";
import * as daimo from "./daimo";
import { handleRatingRoute } from "./rating/routes";
import { ensureProvider } from "./rating/providers";
import {
  createMppPayment,
  getMppPayment,
  updateMppPayment,
  createCompletionAttempt,
  getCompletionAttempt,
  countCompletionAttempts,
} from "./store";
import { parseMppCredential } from "./mpp";

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function error(message: string, status = 400) {
  return json({ error: { message } }, status);
}

// -- Transparent MPP proxy: /proxy/<target_host>/<path> --

/** Headers to strip when proxying (hop-by-hop or problematic). */
const STRIP_HEADERS = new Set(["host", "connection", "transfer-encoding", "content-length"]);

/** Strip hop-by-hop headers from a Headers object. */
function stripHeaders(headers: Headers): Headers {
  const filtered = new Headers();
  headers.forEach((v, k) => {
    if (!STRIP_HEADERS.has(k.toLowerCase())) filtered.set(k, v);
  });
  return filtered;
}

/** Forward a request to the target service, pass through all headers both ways. */
async function handleProxy(req: Request, targetUrl: string): Promise<Response> {
  const startMs = Date.now();
  const hasCred = !!req.headers.get("authorization")?.startsWith("Payment ");
  const fwdHeaders = stripHeaders(req.headers);

  let targetRes: Response;
  try {
    targetRes = await fetch(targetUrl, {
      method: req.method,
      headers: fwdHeaders,
      body: req.method !== "GET" && req.method !== "HEAD" ? await req.blob() : undefined,
    });
  } catch (e) {
    logProxyRequest(targetUrl, req.method, hasCred, undefined, Date.now() - startMs, String(e));
    return error(`Failed to reach ${targetUrl}: ${e}`, 502);
  }

  const durationMs = Date.now() - startMs;

  if (targetRes.status === 402) {
    ensureProvider(targetUrl).catch(() => {});
  }

  logProxyRequest(targetUrl, req.method, hasCred, targetRes.status, durationMs);

  return new Response(targetRes.body, {
    status: targetRes.status,
    headers: stripHeaders(targetRes.headers),
  });
}

/** Log a proxy request to Postgres (fire-and-forget). */
function logProxyRequest(
  targetUrl: string, method: string, hasCred: boolean,
  status: number | undefined, durationMs: number, err?: string
) {
  sql`
    INSERT INTO mpp_proxy_requests (target_url, method, has_payment_credential, response_status, duration_ms, error)
    VALUES (${targetUrl}, ${method}, ${hasCred}, ${status ?? null}, ${durationMs}, ${err ?? null})
  `.catch(() => {});
}

// -- DMP payment flow: POST /v1/mpp/start, /v1/mpp/proxy/:paymentId --

/** Create a DMP payment record for a request. */
async function handleMppStart(req: Request): Promise<Response> {
  let body: { url: string; method: string; headers?: Record<string, string>; body?: unknown };
  try {
    body = await req.json();
  } catch {
    return error("Invalid JSON body");
  }
  if (!body.url) return error("url is required");
  if (!body.method) return error("method is required");

  const payment = await createMppPayment({
    daimoSessionId: "",
    daimoClientSecret: "",
    originalRequest: {
      url: body.url,
      method: body.method,
      headers: body.headers ?? {},
      body: body.body != null ? (typeof body.body === "string" ? body.body : JSON.stringify(body.body)) : undefined,
    },
    challenge: {} as any,
    depositAddress: "",
    tokenOptions: [],
  });

  return json({ paymentId: payment.id });
}

const MAX_COMPLETION_ATTEMPTS = 5;
const PROXY_TIMEOUT_MS = 60_000;

/** Proxy a request using stored payment details. Updates payment on success. */
async function handleMppProxy(req: Request, paymentId: string): Promise<Response> {
  const payment = await getMppPayment(paymentId);
  if (!payment) return error("Payment not found", 404);

  // Return cached response for completed (succeeded or failed) payments
  if (payment.finalCompletionAttemptId) {
    const cached = await getCompletionAttempt(payment.finalCompletionAttemptId);
    if (cached?.responseStatus != null && cached.responseBody != null) {
      const headers = new Headers(
        (cached.responseHeaders as Record<string, string>) ?? {}
      );
      return new Response(cached.responseBody, {
        status: cached.responseStatus,
        headers,
      });
    }
  }

  const targetUrl = payment.originalRequest.url;
  const startMs = Date.now();
  const authHeader = req.headers.get("authorization") ?? "";
  const hasCred = authHeader.startsWith("Payment ");
  const txHash = hasCred ? parseMppCredential(authHeader)?.txHash : undefined;
  const fwdHeaders = stripHeaders(req.headers);
  const method = payment.originalRequest.method;
  const reqBody = req.method !== "GET" && req.method !== "HEAD" ? await req.blob() : undefined;
  const reqBodyText = reqBody ? await new Blob([reqBody]).text() : undefined;
  const reqHeadersObj = Object.fromEntries(fwdHeaders.entries());

  // Helper: record attempt and maybe mark payment as failed
  const recordAttempt = async (
    outcome: "success" | "http_error" | "network_error" | "timeout",
    resStatus?: number,
    resHeaders?: Record<string, string>,
    resBody?: string,
    errMsg?: string
  ) => {
    const attempt = await createCompletionAttempt({
      paymentId,
      deliveryTxHash: txHash,
      requestUrl: targetUrl,
      requestMethod: method,
      requestHeaders: reqHeadersObj,
      requestBody: reqBodyText,
      responseStatus: resStatus,
      responseHeaders: resHeaders,
      responseBody: resBody,
      outcome,
      error: errMsg,
      durationMs: Date.now() - startMs,
    });

    if (outcome === "success") {
      await updateMppPayment(paymentId, {
        status: "succeeded",
        outputTxHash: txHash,
        finalCompletionAttemptId: attempt.id,
      });
    } else {
      const count = await countCompletionAttempts(paymentId);
      if (count >= MAX_COMPLETION_ATTEMPTS) {
        await updateMppPayment(paymentId, {
          status: "failed",
          finalCompletionAttemptId: attempt.id,
          failureReason: `${count} failed attempts. Last: ${errMsg ?? outcome}`,
        });
      }
    }
  };

  let targetRes: Response;
  try {
    targetRes = await fetch(targetUrl, {
      method,
      headers: fwdHeaders,
      body: reqBodyText ?? undefined,
      signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
    });
  } catch (e) {
    const isTimeout = e instanceof DOMException && e.name === "TimeoutError";
    const outcome = isTimeout ? "timeout" as const : "network_error" as const;
    const errMsg = isTimeout ? `Timed out after ${PROXY_TIMEOUT_MS}ms` : String(e);
    logProxyRequest(targetUrl, method, hasCred, undefined, Date.now() - startMs, errMsg);
    if (hasCred) recordAttempt(outcome, undefined, undefined, undefined, errMsg).catch(() => {});
    return error(errMsg, isTimeout ? 504 : 502);
  }

  const durationMs = Date.now() - startMs;

  if (targetRes.status === 402) {
    ensureProvider(targetUrl).catch(() => {});
  }

  logProxyRequest(targetUrl, method, hasCred, targetRes.status, durationMs);

  const resHeaders = stripHeaders(targetRes.headers);

  // Record completion attempt for paid requests
  if (hasCred) {
    const resBody = await targetRes.text();
    const resHeadersObj = Object.fromEntries(resHeaders.entries());
    const outcome = targetRes.status < 400 ? "success" as const : "http_error" as const;
    const errMsg = outcome === "http_error" ? `HTTP ${targetRes.status}` : undefined;

    recordAttempt(outcome, targetRes.status, resHeadersObj, resBody, errMsg).catch(() => {});

    return new Response(resBody, { status: targetRes.status, headers: resHeaders });
  }

  return new Response(targetRes.body, { status: targetRes.status, headers: resHeaders });
}

// -- Fund Tempo wallet via Daimo session: POST /v1/fund, GET /v1/fund/:sessionId --

/** USDCe on Tempo. */
const TEMPO_USDC = {
  chainId: 4217,
  tokenAddress: "0x20c000000000000000000000b9537d11c60e8b50",
};

/** Create a Daimo session to fund a Tempo address from any chain. */
async function handleFund(req: Request): Promise<Response> {
  let body: { tempoAddress: string; amount?: string; wallet: { evmAddress?: string; solanaAddress?: string } };
  try {
    body = await req.json();
  } catch {
    return error("Invalid JSON body");
  }

  if (!body.tempoAddress) return error("tempoAddress is required");
  if (!body.wallet?.evmAddress && !body.wallet?.solanaAddress) {
    return error("wallet.evmAddress or wallet.solanaAddress is required");
  }

  const amount = body.amount ?? "5.00";

  let session: daimo.DaimoSession;
  try {
    session = await daimo.createSession({
      address: body.tempoAddress,
      chainId: TEMPO_USDC.chainId,
      tokenAddress: TEMPO_USDC.tokenAddress,
      amountUnits: amount,
    });
  } catch (e) {
    return error(`Failed to create Daimo session: ${e}`, 502);
  }

  const clientSecret = session.clientSecret;
  try {
    session = await daimo.createPaymentMethod(session.sessionId, clientSecret);
  } catch (e) {
    return error(`Failed to create payment method: ${e}`, 502);
  }

  const depositAddress = session.paymentMethod?.receiverAddress;
  if (!depositAddress) return error("No deposit address", 502);

  let tokenOptions: daimo.TokenOption[];
  try {
    tokenOptions = await daimo.getTokenOptions(session.sessionId, clientSecret, body.wallet);
  } catch (e) {
    return error(`Failed to get token options: ${e}`, 502);
  }

  return json({
    sessionId: session.sessionId,
    depositAddress,
    amount,
    tokenOptions,
  });
}

/** Poll a Daimo funding session. */
async function handleFundPoll(sessionId: string): Promise<Response> {
  try {
    const session = await daimo.retrieveSession(sessionId);
    if (session.status === "succeeded") {
      return json({ status: "succeeded", delivery: session.destination.delivery });
    }
    if (session.status === "bounced" || session.status === "expired") {
      return json({ status: "failed", error: `Session ${session.status}` }, 400);
    }
    return json({ status: "pending", nextPollWaitS: 2 });
  } catch (e) {
    return error(`Failed to check session: ${e}`, 502);
  }
}

// -- Server --

await migrate();

const port = parseInt(process.env.PORT ?? "3000");

const server = Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/health") {
      return json({ ok: true });
    }

    // Serve static docs (before SPA fallback)
    if (url.pathname === "/SKILL.md" || url.pathname === "/skill.md" || url.pathname === "/llms.txt") {
      const filename = url.pathname === "/skill.md" ? "/SKILL.md" : url.pathname;
      const file = Bun.file(import.meta.dir + "/.." + filename);
      if (await file.exists()) {
        return new Response(file, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
    }

    // DMP payment flow
    if (req.method === "POST" && url.pathname === "/v1/mpp/start") {
      return handleMppStart(req);
    }
    if (url.pathname.startsWith("/v1/mpp/proxy/")) {
      const paymentId = url.pathname.slice("/v1/mpp/proxy/".length);
      if (!paymentId) return error("Payment ID required", 400);
      return handleMppProxy(req, paymentId);
    }

    // Fund Tempo wallet from any chain
    if (req.method === "POST" && url.pathname === "/v1/fund") {
      return handleFund(req);
    }
    if (req.method === "GET" && url.pathname.startsWith("/v1/fund/")) {
      const sessionId = url.pathname.slice("/v1/fund/".length);
      return handleFundPoll(sessionId);
    }

    // Transparent MPP proxy: /proxy/<target_host>/<path>
    if (url.pathname.startsWith("/proxy/")) {
      const targetPath = url.pathname.slice("/proxy/".length);
      if (!targetPath) return error("Missing target URL in /proxy/<host>/<path>", 400);
      const targetUrl = `https://${targetPath}${url.search}`;
      return handleProxy(req, targetUrl);
    }

    const ratingRes = await handleRatingRoute(req, url);
    if (ratingRes) return ratingRes;

    // Static file serving (web/dist)
    const staticDir = import.meta.dir + "/../web/dist";
    const filePath = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = Bun.file(staticDir + filePath);
    if (await file.exists()) {
      const ct = file.type;
      if (ct.startsWith("text/") && !ct.includes("charset")) {
        return new Response(file, { headers: { "Content-Type": `${ct}; charset=utf-8` } });
      }
      return new Response(file);
    }
    // SPA fallback — inject per-route OG tags for crawlers
    const indexFile = Bun.file(staticDir + "/index.html");
    if (await indexFile.exists()) {
      if (url.pathname === "/demo") {
        let html = await indexFile.text();
        html = html
          .replace(/<title>[^<]*<\/title>/, "<title>Demos — Daimo Machine Payments</title>")
          .replace(/og:title" content="[^"]*"/, 'og:title" content="Demos — Daimo Machine Payments"')
          .replace(/og:description" content="[^"]*"/, 'og:description" content="Try AI demos powered by machine payments: generate music, get roasted on a phone call, receive a letter from 2030, or find leads."')
          .replace(/og:url" content="[^"]*"/, 'og:url" content="https://mpp.daimo.com/demo"')
          .replace(/twitter:title" content="[^"]*"/, 'twitter:title" content="Demos — Daimo Machine Payments"')
          .replace(/twitter:description" content="[^"]*"/, 'twitter:description" content="Try AI demos powered by machine payments: generate music, get roasted on a phone call, receive a letter from 2030, or find leads."');
        return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
      return new Response(indexFile);
    }

    return error("Not found", 404);
  },
});

console.log(`DMP API listening on :${server.port}`);
