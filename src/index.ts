/** DMP API server. */

import sql from "./db";
import { migrate } from "./db";
import { handleRatingRoute } from "./rating/routes";
import { ensureProvider } from "./rating/providers";

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function error(message: string, status = 400) {
  return json({ error: { message } }, status);
}

// -- Transparent MPP proxy: /proxy/<target_host>/<path> --

/** Headers to strip when proxying (hop-by-hop or problematic). */
const STRIP_HEADERS = new Set(["host", "connection", "transfer-encoding", "content-length"]);

/** Forward a request to the target service, pass through all headers both ways. */
async function handleProxy(req: Request, targetUrl: string): Promise<Response> {
  const startMs = Date.now();
  const hasCred = !!req.headers.get("authorization")?.startsWith("Payment ");

  // Forward headers, stripping hop-by-hop
  const fwdHeaders = new Headers();
  req.headers.forEach((v, k) => {
    if (!STRIP_HEADERS.has(k.toLowerCase())) fwdHeaders.set(k, v);
  });

  // Forward request to target
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

  // Auto-create provider on first 402 (payment-gated = real MPP service)
  if (targetRes.status === 402) {
    ensureProvider(targetUrl).catch(() => {});
  }

  // Log for observability
  logProxyRequest(targetUrl, req.method, hasCred, targetRes.status, durationMs);

  // Pass through response with all headers
  const resHeaders = new Headers();
  targetRes.headers.forEach((v, k) => {
    if (!STRIP_HEADERS.has(k.toLowerCase())) resHeaders.set(k, v);
  });

  return new Response(targetRes.body, {
    status: targetRes.status,
    headers: resHeaders,
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
    if (await file.exists()) return new Response(file);
    // SPA fallback
    const indexFile = Bun.file(staticDir + "/index.html");
    if (await indexFile.exists()) return new Response(indexFile);

    return error("Not found", 404);
  },
});

console.log(`DMP API listening on :${server.port}`);
