/** DMP API server. */

import * as daimo from "./daimo";
import { migrate } from "./db";
import {
  parseMppChallenges,
  decodeMppRequest,
  buildMppCredential,
  atomicToUnits,
} from "./mpp";
import {
  createMppPayment,
  getMppPayment,
  updateMppPayment,
  createCompletionAttempt,
  getCompletionAttempt,
  getCompletionAttempts,
} from "./store";
import { handleRatingRoute } from "./rating/routes";
import { ensureProvider } from "./rating/providers";

const MAX_COMPLETION_ATTEMPTS = 10;

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function error(message: string, status = 400) {
  return json({ error: { message } }, status);
}

/** Parse a response body string as JSON if possible, otherwise return raw. */
function parseBody(raw: string | undefined): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

// -- POST /v1/mpp/request --

type MppRequestBody = {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: unknown;
  wallet: { evmAddress?: string; solanaAddress?: string };
};

/** Forward request to target service, handle 402 by creating a Daimo session. */
async function handleMppRequest(req: Request): Promise<Response> {
  let input: MppRequestBody;
  try {
    input = (await req.json()) as MppRequestBody;
  } catch {
    return error("Invalid JSON body");
  }

  if (!input.url || !input.method) {
    return error("url and method are required");
  }
  if (!input.wallet?.evmAddress && !input.wallet?.solanaAddress) {
    return error("wallet.evmAddress or wallet.solanaAddress is required");
  }

  // 1. Forward request to target service
  const targetRes = await fetch(input.url, {
    method: input.method,
    headers: input.headers ?? {},
    ...(input.body ? { body: JSON.stringify(input.body) } : {}),
  });

  // 2. If not 402, return the response directly
  if (targetRes.status !== 402) {
    let body: unknown;
    const ct = targetRes.headers.get("content-type") ?? "";
    if (ct.includes("json")) {
      body = await targetRes.json();
    } else {
      body = await targetRes.text();
    }
    return json({ status: "success", response: { status: targetRes.status, body } });
  }

  // 3. Parse MPP 402 challenge
  const authHeader = targetRes.headers.get("www-authenticate");
  if (!authHeader) {
    return error("402 response has no WWW-Authenticate header", 502);
  }

  const challenges = parseMppChallenges(authHeader);
  if (challenges.length === 0) {
    return error("No tempo Payment challenge found in 402 response", 502);
  }

  const challenge = challenges[0];
  const mppReq = decodeMppRequest(challenge);

  // 4. Determine destination from MPP challenge
  const chainId = mppReq.methodDetails?.chainId;
  if (!chainId) {
    return error("MPP challenge missing methodDetails.chainId", 502);
  }

  const amountUnits = atomicToUnits(mppReq.amount);

  // 5. Create Daimo session targeting the MPP destination
  let session: daimo.DaimoSession;
  try {
    session = await daimo.createSession({
      address: mppReq.recipient,
      chainId,
      tokenAddress: mppReq.currency,
      amountUnits,
    });
  } catch (e) {
    return error(`Failed to create Daimo session: ${e}`, 502);
  }

  // 6. Create EVM payment method to get deposit address
  try {
    session = await daimo.createPaymentMethod(
      session.sessionId,
      session.clientSecret
    );
  } catch (e) {
    return error(`Failed to create payment method: ${e}`, 502);
  }

  const depositAddress = session.paymentMethod?.receiverAddress;
  if (!depositAddress) {
    return error("No deposit address in payment method response", 502);
  }

  // 7. Get token options for agent's wallet
  let tokenOptions: daimo.TokenOption[];
  try {
    tokenOptions = await daimo.getTokenOptions(
      session.sessionId,
      session.clientSecret,
      input.wallet
    );
  } catch (e) {
    return error(`Failed to get token options: ${e}`, 502);
  }

  // 8. Store payment + auto-create provider
  const payment = await createMppPayment({
    daimoSessionId: session.sessionId,
    daimoClientSecret: session.clientSecret,
    originalRequest: {
      url: input.url,
      method: input.method,
      headers: input.headers ?? {},
      body: input.body ? JSON.stringify(input.body) : undefined,
    },
    challenge,
    depositAddress,
    tokenOptions,
  });

  await ensureProvider(input.url);

  // 9. Return payment info to agent
  return json({
    status: "payment_required",
    paymentId: payment.id,
    depositAddress,
    tokenOptions,
    payment: {
      amount: amountUnits,
      recipient: mppReq.recipient,
      chainId,
    },
  });
}

// -- GET /v1/mpp/poll/:paymentId --

/** Poll Daimo session status. On success, replay request with MPP auth. */
async function handleMppPoll(
  paymentId: string,
  txHash?: string
): Promise<Response> {
  const payment = await getMppPayment(paymentId);
  if (!payment) {
    return error("Payment not found", 404);
  }

  // Terminal states: return cached result
  if (payment.status !== "pending") {
    if (payment.status === "succeeded" && payment.finalCompletionAttemptId) {
      const attempt = await getCompletionAttempt(payment.finalCompletionAttemptId);
      return json({
        status: "succeeded",
        response: {
          status: attempt?.responseStatus,
          body: parseBody(attempt?.responseBody),
        },
      });
    }
    if (payment.finalCompletionAttemptId) {
      const attempt = await getCompletionAttempt(payment.finalCompletionAttemptId);
      return json({
        status: "failed",
        error: payment.failureReason,
        response: attempt?.responseStatus
          ? { status: attempt.responseStatus, body: parseBody(attempt.responseBody) }
          : undefined,
      }, 400);
    }
    return json({ status: "failed", error: payment.failureReason }, 400);
  }

  // Poll Daimo session
  let session: daimo.DaimoSession;
  try {
    if (txHash) {
      session = await daimo.checkSession(
        payment.daimoSessionId,
        payment.daimoClientSecret,
        txHash
      );
    } else {
      session = await daimo.retrieveSession(payment.daimoSessionId);
    }
  } catch (e) {
    return error(`Failed to check session: ${e}`, 502);
  }

  // Daimo still in progress
  if (
    session.status === "requires_payment_method" ||
    session.status === "waiting_payment" ||
    session.status === "processing"
  ) {
    return json({ status: "pending", nextPollWaitS: 2 });
  }

  // Daimo failed
  if (session.status === "bounced" || session.status === "expired") {
    const reason = `Daimo session ${session.status}`;
    await updateMppPayment(paymentId, { status: "failed", failureReason: reason });
    return json({ status: "failed", error: reason }, 400);
  }

  // Daimo succeeded -- attempt completion
  if (session.status === "succeeded") {
    const outputTxHash = session.destination.delivery?.txHash;
    if (!outputTxHash) {
      return error("Session succeeded but no delivery txHash", 502);
    }

    if (!payment.outputTxHash) {
      await updateMppPayment(paymentId, { outputTxHash });
    }

    const priorAttempts = await getCompletionAttempts(paymentId);
    if (priorAttempts.length >= MAX_COMPLETION_ATTEMPTS) {
      const last = priorAttempts[priorAttempts.length - 1];
      await updateMppPayment(paymentId, {
        status: "failed",
        finalCompletionAttemptId: last.id,
        failureReason: `Exhausted ${MAX_COMPLETION_ATTEMPTS} completion attempts`,
      });
      return json({
        status: "failed",
        error: `Exhausted ${MAX_COMPLETION_ATTEMPTS} completion attempts`,
      }, 400);
    }

    // Build MPP credential and replay original request
    const authValue = buildMppCredential(payment.challenge, outputTxHash);
    const orig = payment.originalRequest;
    const replayHeaders = { ...orig.headers, Authorization: authValue };
    const startMs = Date.now();

    let replayRes: Response;
    try {
      replayRes = await fetch(orig.url, {
        method: orig.method,
        headers: replayHeaders,
        ...(orig.body ? { body: orig.body } : {}),
      });
    } catch (e) {
      const attempt = await createCompletionAttempt({
        paymentId,
        deliveryTxHash: outputTxHash,
        requestUrl: orig.url,
        requestMethod: orig.method,
        requestHeaders: replayHeaders,
        requestBody: orig.body,
        outcome: "network_error",
        error: String(e),
        durationMs: Date.now() - startMs,
      });

      const n = priorAttempts.length + 1;
      if (n >= MAX_COMPLETION_ATTEMPTS) {
        await updateMppPayment(paymentId, {
          status: "failed",
          finalCompletionAttemptId: attempt.id,
          failureReason: `Exhausted ${MAX_COMPLETION_ATTEMPTS} completion attempts`,
        });
        return json({
          status: "failed",
          error: `Exhausted ${MAX_COMPLETION_ATTEMPTS} completion attempts`,
        }, 400);
      }

      return json({
        status: "pending",
        completionAttempts: n,
        lastAttemptError: String(e),
        nextPollWaitS: 2 * Math.pow(2, Math.floor(n / 2)),
      });
    }

    // Parse replay response
    const durationMs = Date.now() - startMs;
    const responseBody = await replayRes.text();
    const responseHeaders: Record<string, string> = {};
    replayRes.headers.forEach((v, k) => { responseHeaders[k] = v; });

    const isSuccess = replayRes.status >= 200 && replayRes.status < 300;

    const attempt = await createCompletionAttempt({
      paymentId,
      deliveryTxHash: outputTxHash,
      requestUrl: orig.url,
      requestMethod: orig.method,
      requestHeaders: replayHeaders,
      requestBody: orig.body,
      responseStatus: replayRes.status,
      responseHeaders,
      responseBody,
      outcome: isSuccess ? "success" : "http_error",
      error: isSuccess ? undefined : `HTTP ${replayRes.status}`,
      durationMs,
    });

    const body = parseBody(responseBody);

    if (isSuccess) {
      await updateMppPayment(paymentId, {
        status: "succeeded",
        finalCompletionAttemptId: attempt.id,
      });
      return json({ status: "succeeded", response: { status: replayRes.status, body } });
    }

    // Non-2xx: retry or exhaust
    const n = priorAttempts.length + 1;
    if (n >= MAX_COMPLETION_ATTEMPTS) {
      await updateMppPayment(paymentId, {
        status: "failed",
        finalCompletionAttemptId: attempt.id,
        failureReason: `Exhausted ${MAX_COMPLETION_ATTEMPTS} completion attempts`,
      });
      return json({
        status: "failed",
        error: `Exhausted ${MAX_COMPLETION_ATTEMPTS} completion attempts`,
        response: { status: replayRes.status, body },
      }, 400);
    }

    return json({
      status: "pending",
      completionAttempts: n,
      lastAttemptError: `HTTP ${replayRes.status}`,
      nextPollWaitS: 2 * Math.pow(2, Math.floor(n / 2)),
    });
  }

  return json({ status: "pending", nextPollWaitS: 2 });
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

    if (req.method === "POST" && url.pathname === "/v1/mpp/request") {
      return handleMppRequest(req);
    }

    if (req.method === "GET" && url.pathname.startsWith("/v1/mpp/poll/")) {
      const paymentId = url.pathname.slice("/v1/mpp/poll/".length);
      const txHash = url.searchParams.get("txHash") ?? undefined;
      return handleMppPoll(paymentId, txHash);
    }

    const ratingRes = await handleRatingRoute(req, url);
    if (ratingRes) return ratingRes;

    return error("Not found", 404);
  },
});

console.log(`DMP API listening on :${server.port}`);
