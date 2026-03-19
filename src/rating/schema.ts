/** Rating system types. */

export type Provider = {
  id: string;
  url: string;
  name: string | null;
  description: string | null;
  category: string | null;
  mpp_intents: string; // JSON array
  metadata: string | null; // JSON blob
  created_at: number;
  updated_at: number;
};

export type Rating = {
  id: string;
  provider_id: string;
  payment_id: string;
  daimo_session_id: string;
  agent_id: string | null;
  overall_score: number;
  speed_score: number | null;
  quality_score: number | null;
  value_score: number | null;
  reliability_score: number | null;
  comment: string | null;
  tags: string | null; // JSON array
  use_case: string | null;
  amount_paid: string | null;
  mpp_intent: string | null;
  created_at: number;
  updated_at: number;
};

export type Event = {
  id: string;
  type: string;
  provider_url: string | null;
  payment_id: string | null;
  daimo_session_id: string | null;
  agent_wallet: string | null;
  amount: string | null;
  metadata: string | null; // JSON blob
  created_at: number;
};

export type EventType =
  | "payment.initiated"
  | "payment.succeeded"
  | "payment.failed"
  | "rating.submitted";

export type ProviderStats = {
  totalPayments: number;
  totalRatings: number;
  avgOverall: number | null;
  avgSpeed: number | null;
  avgQuality: number | null;
  avgValue: number | null;
  avgReliability: number | null;
  topTags: { tag: string; count: number }[];
};

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
