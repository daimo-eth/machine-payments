/** MppPayment and CompletionAttempt state backed by Postgres. */

import sql from "./db";
import type { MppChallenge } from "./mpp";
import type { TokenOption } from "./daimo";

// -- MppPayment --

export type MppPayment = {
  id: string;
  createdAt: Date;
  daimoSessionId: string;
  daimoClientSecret: string;
  originalRequest: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
  };
  challenge: MppChallenge;
  depositAddress: string;
  tokenOptions: TokenOption[];
  outputTxHash?: string;
  status: "pending" | "succeeded" | "failed";
  finalCompletionAttemptId?: string;
  failureReason?: string;
};

type PaymentRow = {
  id: string;
  created_at: Date;
  daimo_session_id: string;
  daimo_client_secret: string;
  original_request: MppPayment["originalRequest"];
  challenge: MppChallenge;
  deposit_address: string;
  token_options: TokenOption[];
  output_tx_hash: string | null;
  status: string;
  final_completion_attempt_id: string | null;
  failure_reason: string | null;
};

function toPayment(r: PaymentRow): MppPayment {
  return {
    id: r.id,
    createdAt: r.created_at,
    daimoSessionId: r.daimo_session_id,
    daimoClientSecret: r.daimo_client_secret,
    originalRequest: r.original_request,
    challenge: r.challenge,
    depositAddress: r.deposit_address,
    tokenOptions: r.token_options,
    outputTxHash: r.output_tx_hash ?? undefined,
    status: r.status as MppPayment["status"],
    finalCompletionAttemptId: r.final_completion_attempt_id ?? undefined,
    failureReason: r.failure_reason ?? undefined,
  };
}

export async function createMppPayment(
  init: Omit<MppPayment, "id" | "createdAt" | "status" | "outputTxHash" | "finalCompletionAttemptId" | "failureReason">
): Promise<MppPayment> {
  const [row] = await sql<PaymentRow[]>`
    INSERT INTO mpp_payments (
      daimo_session_id, daimo_client_secret, original_request,
      challenge, deposit_address, token_options
    ) VALUES (
      ${init.daimoSessionId}, ${init.daimoClientSecret},
      ${sql.json(init.originalRequest)}, ${sql.json(init.challenge)},
      ${init.depositAddress}, ${sql.json(init.tokenOptions)}
    )
    RETURNING *
  `;
  return toPayment(row);
}

export async function getMppPayment(id: string): Promise<MppPayment | null> {
  const [row] = await sql<PaymentRow[]>`
    SELECT * FROM mpp_payments WHERE id = ${id}
  `;
  return row ? toPayment(row) : null;
}

export async function updateMppPayment(
  id: string,
  update: Partial<Pick<MppPayment, "status" | "outputTxHash" | "finalCompletionAttemptId" | "failureReason">>
): Promise<void> {
  // COALESCE preserves existing value when update field is not provided
  await sql`
    UPDATE mpp_payments SET
      status = COALESCE(${update.status ?? null}, status),
      output_tx_hash = COALESCE(${update.outputTxHash ?? null}, output_tx_hash),
      final_completion_attempt_id = COALESCE(${update.finalCompletionAttemptId ?? null}::uuid, final_completion_attempt_id),
      failure_reason = COALESCE(${update.failureReason ?? null}, failure_reason)
    WHERE id = ${id}
  `;
}

// -- Completion attempts --

export type CompletionAttempt = {
  id: string;
  paymentId: string;
  attemptedAt: Date;
  deliveryTxHash: string;
  requestUrl: string;
  requestMethod: string;
  requestHeaders: Record<string, string>;
  requestBody?: string;
  responseStatus?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  outcome: "success" | "http_error" | "network_error" | "timeout";
  error?: string;
  durationMs?: number;
};

type AttemptRow = {
  id: string;
  payment_id: string;
  attempted_at: Date;
  delivery_tx_hash: string;
  request_url: string;
  request_method: string;
  request_headers: Record<string, string>;
  request_body: string | null;
  response_status: number | null;
  response_headers: Record<string, string> | null;
  response_body: string | null;
  outcome: string;
  error: string | null;
  duration_ms: number | null;
};

function toAttempt(r: AttemptRow): CompletionAttempt {
  return {
    id: r.id,
    paymentId: r.payment_id,
    attemptedAt: r.attempted_at,
    deliveryTxHash: r.delivery_tx_hash,
    requestUrl: r.request_url,
    requestMethod: r.request_method,
    requestHeaders: r.request_headers,
    requestBody: r.request_body ?? undefined,
    responseStatus: r.response_status ?? undefined,
    responseHeaders: r.response_headers ?? undefined,
    responseBody: r.response_body ?? undefined,
    outcome: r.outcome as CompletionAttempt["outcome"],
    error: r.error ?? undefined,
    durationMs: r.duration_ms ?? undefined,
  };
}

export async function createCompletionAttempt(
  init: Omit<CompletionAttempt, "id" | "attemptedAt">
): Promise<CompletionAttempt> {
  const [row] = await sql<AttemptRow[]>`
    INSERT INTO mpp_completion_attempts (
      payment_id, delivery_tx_hash,
      request_url, request_method, request_headers, request_body,
      response_status, response_headers, response_body,
      outcome, error, duration_ms
    ) VALUES (
      ${init.paymentId}, ${init.deliveryTxHash},
      ${init.requestUrl}, ${init.requestMethod},
      ${sql.json(init.requestHeaders)}, ${init.requestBody ?? null},
      ${init.responseStatus ?? null},
      ${init.responseHeaders ? sql.json(init.responseHeaders) : null},
      ${init.responseBody ?? null},
      ${init.outcome}, ${init.error ?? null}, ${init.durationMs ?? null}
    )
    RETURNING *
  `;
  return toAttempt(row);
}

export async function getCompletionAttempt(
  id: string
): Promise<CompletionAttempt | null> {
  const [row] = await sql<AttemptRow[]>`
    SELECT * FROM mpp_completion_attempts WHERE id = ${id}
  `;
  return row ? toAttempt(row) : null;
}

export async function getCompletionAttempts(
  paymentId: string
): Promise<CompletionAttempt[]> {
  const rows = await sql<AttemptRow[]>`
    SELECT * FROM mpp_completion_attempts
    WHERE payment_id = ${paymentId}
    ORDER BY attempted_at ASC
  `;
  return rows.map(toAttempt);
}
