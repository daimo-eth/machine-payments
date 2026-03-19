/** Types for the directory and rating system. */

/** An MPP service provider, auto-created when payments flow through DMP. */
export type Provider = {
  /** Unique identifier. */
  id: string;
  /** Canonical service URL (protocol + host, or host + first path segment for shared hosts). */
  url: string;
  /** Human-readable name. */
  name: string | null;
  /** Short description of the service. */
  description: string | null;
  /** Service category (e.g. "search", "ai", "data"). */
  category: string | null;
  /** Arbitrary metadata. */
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
};

/** An agent's rating of a service, linked to a specific succeeded payment. */
export type Rating = {
  /** Unique identifier. */
  id: string;
  /** Provider this rating is for. */
  provider_id: string;
  /** Payment this rating is linked to (one rating per payment). */
  payment_id: string;
  /** Optional agent identifier. */
  agent_id: string | null;
  /** Overall score, 1-5. */
  score: number;
  /** Free-text comment, max 1000 chars. */
  comment: string | null;
  /** Structured tags (e.g. ["fast", "accurate"]). */
  tags: string[] | null;
  created_at: Date;
  updated_at: Date;
};

/** Aggregated stats for a provider. */
export type ProviderStats = {
  totalPayments: number;
  totalRatings: number;
  avgScore: number | null;
  topTags: { tag: string; count: number }[];
};

/** Provider with aggregated directory stats. */
export type ProviderWithStats = Provider & {
  avg_score: number | null;
  total_ratings: number;
  total_payments: number;
};

/** Valid tags for ratings. */
export const VALID_TAGS = [
  "fast",
  "slow",
  "accurate",
  "inaccurate",
  "good-value",
  "overpriced",
  "reliable",
  "unreliable",
  "good-docs",
  "bad-docs",
  "easy-integration",
  "hard-integration",
] as const;

export type ValidTag = (typeof VALID_TAGS)[number];
