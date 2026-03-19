/** DMP API server. */

import * as daimo from "./daimo";
import {
  parseMppChallenges,
  decodeMppRequest,
  buildMppCredential,
  atomicToUnits,
} from "./mpp";
import { createPayment, getPayment, updatePayment } from "./store";

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function error(message: string, status = 400) {
  return json({ error: { message } }, status);
}

// -- POST /v1/mpp/request --

type MppRequestBody = {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: unknown;
  wallet: { evmAddress?: string; solanaAddress?: string };
};

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

  // 8. Store payment state
  const payment = createPayment({
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

async function handleMppPoll(
  paymentId: string,
  txHash?: string
): Promise<Response> {
  const payment = getPayment(paymentId);
  if (!payment) {
    return error("Payment not found", 404);
  }

  // Already done
  if (payment.status === "succeeded") {
    return json({
      status: "succeeded",
      response: payment.finalResponse,
    });
  }
  if (payment.status === "failed") {
    return json({ status: "failed", error: payment.error }, 400);
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

  // Still waiting
  if (
    session.status === "requires_payment_method" ||
    session.status === "waiting_payment"
  ) {
    return json({ status: "waiting_payment" });
  }

  if (session.status === "processing") {
    updatePayment(paymentId, { status: "processing" });
    return json({ status: "processing" });
  }

  // Failed states
  if (session.status === "bounced" || session.status === "expired") {
    updatePayment(paymentId, {
      status: "failed",
      error: `Daimo session ${session.status}`,
    });
    return json(
      { status: "failed", error: `Daimo session ${session.status}` },
      400
    );
  }

  // Succeeded -- get delivery txHash and replay with MPP auth
  if (session.status === "succeeded") {
    const deliveryTxHash = session.destination.delivery?.txHash;
    if (!deliveryTxHash) {
      return error("Session succeeded but no delivery txHash", 502);
    }

    // Build MPP Authorization: Payment credential
    const authValue = buildMppCredential(payment.challenge, deliveryTxHash);

    // Replay the original request with auth
    const orig = payment.originalRequest;
    let replayRes: Response;
    try {
      replayRes = await fetch(orig.url, {
        method: orig.method,
        headers: { ...orig.headers, Authorization: authValue },
        ...(orig.body ? { body: orig.body } : {}),
      });
    } catch (e) {
      updatePayment(paymentId, {
        status: "failed",
        error: `Replay request failed: ${e}`,
      });
      return error(`Replay request failed: ${e}`, 502);
    }

    // Parse replay response
    let body: unknown;
    const ct = replayRes.headers.get("content-type") ?? "";
    if (ct.includes("json")) {
      body = await replayRes.json();
    } else {
      body = await replayRes.text();
    }

    const finalResponse = { status: replayRes.status, body };
    updatePayment(paymentId, { status: "succeeded", finalResponse });

    return json({ status: "succeeded", response: finalResponse });
  }

  return json({ status: session.status });
}

// -- Server --

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

    return error("Not found", 404);
  },
});

console.log(`DMP API listening on :${server.port}`);
