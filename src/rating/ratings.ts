/** Rating CRUD + validation. */

import { getDb } from "./db";
import { getMppPayment } from "../store";
import { ensureProvider, normalizeProviderUrl } from "./providers";
import { logEvent } from "./events";
import type { Rating } from "./schema";
import { VALID_TAGS } from "./schema";

const UPSERT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export type CreateRatingInput = {
  paymentId: string;
  overall: number;
  speed?: number;
  quality?: number;
  value?: number;
  reliability?: number;
  comment?: string;
  tags?: string[];
  useCase?: string;
  agentId?: string;
};

function validateScore(v: unknown, name: string): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 5) {
    return `${name} must be an integer 1-5`;
  }
  return null;
}

export async function createRating(
  input: CreateRatingInput
): Promise<{ rating: Rating } | { error: string; status: number }> {
  const db = getDb();

  // Validate overall score
  const overallErr = validateScore(input.overall, "overall");
  if (overallErr || input.overall === undefined) {
    return { error: overallErr ?? "overall is required", status: 400 };
  }

  // Validate optional scores
  for (const [key, val] of [
    ["speed", input.speed],
    ["quality", input.quality],
    ["value", input.value],
    ["reliability", input.reliability],
  ] as const) {
    const err = validateScore(val, key);
    if (err) return { error: err, status: 400 };
  }

  // Validate tags
  if (input.tags) {
    for (const tag of input.tags) {
      if (!VALID_TAGS.includes(tag as any)) {
        return { error: `Invalid tag: ${tag}. Valid: ${VALID_TAGS.join(", ")}`, status: 400 };
      }
    }
  }

  // Validate comment length
  if (input.comment && input.comment.length > 1000) {
    return { error: "Comment must be <= 1000 characters", status: 400 };
  }

  // Look up payment
  const payment = await getMppPayment(input.paymentId);
  if (!payment) {
    return { error: "Payment not found", status: 404 };
  }
  if (payment.status !== "succeeded") {
    return { error: "Can only rate succeeded payments", status: 400 };
  }

  // Check for existing rating (upsert within window)
  const existing = db
    .query<Rating, [string]>("SELECT * FROM ratings WHERE payment_id = ?")
    .get(input.paymentId);

  if (existing) {
    const age = Date.now() - existing.created_at;
    if (age > UPSERT_WINDOW_MS) {
      return { error: "Rating update window has expired (24h)", status: 400 };
    }

    // Update existing rating
    const now = Date.now();
    db.run(
      `UPDATE ratings SET
        overall_score = ?, speed_score = ?, quality_score = ?, value_score = ?, reliability_score = ?,
        comment = ?, tags = ?, use_case = ?, agent_id = ?, updated_at = ?
       WHERE id = ?`,
      [
        input.overall,
        input.speed ?? null,
        input.quality ?? null,
        input.value ?? null,
        input.reliability ?? null,
        input.comment ?? null,
        input.tags ? JSON.stringify(input.tags) : null,
        input.useCase ?? null,
        input.agentId ?? null,
        now,
        existing.id,
      ]
    );

    const updated = db
      .query<Rating, [string]>("SELECT * FROM ratings WHERE id = ?")
      .get(existing.id)!;
    return { rating: updated };
  }

  // Ensure provider exists
  const provider = ensureProvider(
    payment.originalRequest.url,
    payment.challenge.intent
  );

  const id = crypto.randomUUID();
  const now = Date.now();

  db.run(
    `INSERT INTO ratings (
      id, provider_id, payment_id, daimo_session_id, agent_id,
      overall_score, speed_score, quality_score, value_score, reliability_score,
      comment, tags, use_case, amount_paid, mpp_intent,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      provider.id,
      input.paymentId,
      payment.daimoSessionId,
      input.agentId ?? null,
      input.overall,
      input.speed ?? null,
      input.quality ?? null,
      input.value ?? null,
      input.reliability ?? null,
      input.comment ?? null,
      input.tags ? JSON.stringify(input.tags) : null,
      input.useCase ?? null,
      null, // amount_paid — could be enriched later
      payment.challenge.intent ?? null,
      now,
      now,
    ]
  );

  // Log event
  logEvent({
    type: "rating.submitted",
    providerUrl: provider.url,
    paymentId: input.paymentId,
    daimoSessionId: payment.daimoSessionId,
    agentWallet: input.agentId,
  });

  const rating = db.query<Rating, [string]>("SELECT * FROM ratings WHERE id = ?").get(id)!;
  return { rating };
}

export function getRating(id: string): Rating | null {
  return (
    getDb()
      .query<Rating, [string]>("SELECT * FROM ratings WHERE id = ?")
      .get(id) ?? null
  );
}
