export type Provider = {
  id: string;
  url: string;
  name: string | null;
  description: string | null;
  category: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type ProviderWithStats = Provider & {
  avg_score: number | null;
  total_ratings: number;
  total_payments: number;
};

export type Rating = {
  id: string;
  provider_id: string;
  payment_id: string;
  agent_id: string | null;
  score: number;
  comment: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
};

export type ProviderStats = {
  totalPayments: number;
  totalRatings: number;
  avgScore: number | null;
  topTags: { tag: string; count: number }[];
};

export type ProviderDetailResponse = {
  provider: Provider;
  stats: ProviderStats;
  recentRatings: Rating[];
};

export type SortOption = "avg_score" | "total_ratings" | "total_payments";
export type TimeRange = "1m" | "5m" | "1h" | "24h" | "all";

export type RecentPayment = {
  id: string;
  status: string;
  created_at: string;
  original_url: string | null;
};

export type DashboardStats = {
  totals: {
    transactions: number;
    providers: number;
    ratings: number;
  };
  series: {
    transactions: number[];
    ratings: number[];
  };
  recentPayments: RecentPayment[];
};
