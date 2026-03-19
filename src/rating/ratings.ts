/** Rating creation and retrieval. */

import sql from "../db";
import { getMppPayment } from "../store";
import { ensureProvider } from "./providers";
import type { Rating } from "./schema";
import { VALID_TAGS } from "./schema";

/** 24-hour window to update an existing rating. */
const UPSERT_WINDOW_MS = 24 * 60 * 60 * 1000;

export type CreateRatingInput = {
  /** Payment ID to rate (must be succeeded). */
  paymentId: string;
  /** Overall score, 1-5. */
  score: number;
  /** Free-text comment, max 1000 chars. */
  comment?: string;
  /** Structured tags. */
  tags?: string[];
  /** Agent identifier. */
  agentId?: string;
};

/** Validate a score is an integer 1-5. */
function validateScore(v: unknown, name: string): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 5) {
    return `${name} must be an integer 1-5`;
  }
  return null;
}

/** Create or update a rating for a succeeded payment. */
export async function createRating(
  input: CreateRatingInput
): Promise<{ rating: Rating } | { error: string; status: number }> {
  const scoreErr = validateScore(input.score, "score");
  if (scoreErr || input.score === undefined) {
    return { error: scoreErr ?? "score is required", status: 400 };
  }

  if (input.tags) {
    for (const tag of input.tags) {
      if (!VALID_TAGS.includes(tag as any)) {
        return { error: `Invalid tag: ${tag}. Valid: ${VALID_TAGS.join(", ")}`, status: 400 };
      }
    }
  }

  if (input.comment && input.comment.length > 1000) {
    return { error: "Comment must be <= 1000 characters", status: 400 };
  }

  const payment = await getMppPayment(input.paymentId);
  if (!payment) return { error: "Payment not found", status: 404 };
  if (payment.status !== "succeeded") {
    return { error: "Can only rate succeeded payments", status: 400 };
  }

  // Check for existing rating (upsert within 24h window)
  const [existing] = await sql<Rating[]>`
    SELECT * FROM mpp_ratings WHERE payment_id = ${input.paymentId}
  `;

  if (existing) {
    const age = Date.now() - new Date(existing.created_at).getTime();
    if (age > UPSERT_WINDOW_MS) {
      return { error: "Rating update window has expired (24h)", status: 400 };
    }

    const [updated] = await sql<Rating[]>`
      UPDATE mpp_ratings SET
        score = ${input.score},
        comment = ${input.comment ?? null},
        tags = ${input.tags ? sql.json(input.tags) : null},
        agent_id = ${input.agentId ?? null},
        updated_at = now()
      WHERE id = ${existing.id}
      RETURNING *
    `;
    return { rating: updated };
  }

  // Auto-create provider from payment URL
  const provider = await ensureProvider(payment.originalRequest.url);

  const [rating] = await sql<Rating[]>`
    INSERT INTO mpp_ratings (provider_id, payment_id, agent_id, score, comment, tags)
    VALUES (
      ${provider.id}, ${input.paymentId}, ${input.agentId ?? null},
      ${input.score}, ${input.comment ?? null},
      ${input.tags ? sql.json(input.tags) : null}
    )
    RETURNING *
  `;

  return { rating };
}

/** Get a rating by ID. */
export async function getRating(id: string): Promise<Rating | null> {
  const [row] = await sql<Rating[]>`
    SELECT * FROM mpp_ratings WHERE id = ${id}
  `;
  return row ?? null;
}
