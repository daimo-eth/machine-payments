/** Dashboard aggregate stats + time-series for sparklines (Postgres). */

import sql from "../db";

type TimeRange = "1m" | "5m" | "1h" | "24h" | "all";

const RANGE_INTERVAL: Record<TimeRange, string | null> = {
  "1m": "1 minute",
  "5m": "5 minutes",
  "1h": "1 hour",
  "24h": "24 hours",
  all: null,
};

const BUCKET_INTERVAL: Record<TimeRange, string> = {
  "1m": "5 seconds",
  "5m": "15 seconds",
  "1h": "1 minute",
  "24h": "1 hour",
  all: "1 day",
};

export async function getDashboardStats(range: TimeRange = "24h") {
  const interval = RANGE_INTERVAL[range];
  const bucket = BUCKET_INTERVAL[range];

  const [txns] = await sql<{ cnt: number }[]>`
    SELECT COUNT(*)::int as cnt FROM mpp_payments
    WHERE status = 'succeeded'
    ${interval ? sql`AND created_at >= now() - ${interval}::interval` : sql``}
  `;

  const [providerCount] = await sql<{ cnt: number }[]>`
    SELECT COUNT(*)::int as cnt FROM mpp_providers
  `;

  const [ratingCount] = await sql<{ cnt: number }[]>`
    SELECT COUNT(*)::int as cnt FROM mpp_ratings
    ${interval ? sql`WHERE created_at >= now() - ${interval}::interval` : sql``}
  `;

  const txnSeries = await sql<{ cnt: number }[]>`
    SELECT cnt FROM (
      SELECT date_bin(${bucket}::interval, created_at, '2020-01-01'::timestamptz) as b,
             COUNT(*)::int as cnt
      FROM mpp_payments
      WHERE status = 'succeeded'
      ${interval ? sql`AND created_at >= now() - ${interval}::interval` : sql``}
      GROUP BY b ORDER BY b
    ) sub
  `;

  const ratingSeries = await sql<{ cnt: number }[]>`
    SELECT cnt FROM (
      SELECT date_bin(${bucket}::interval, created_at, '2020-01-01'::timestamptz) as b,
             COUNT(*)::int as cnt
      FROM mpp_ratings
      ${interval ? sql`WHERE created_at >= now() - ${interval}::interval` : sql``}
      GROUP BY b ORDER BY b
    ) sub
  `;

  const recentPayments = await sql<{
    id: string;
    status: string;
    created_at: string;
    original_url: string | null;
    original_method: string | null;
    challenge_realm: string | null;
    challenge_description: string | null;
    challenge_request: string | null;
    output_tx_hash: string | null;
    deposit_address: string | null;
    provider_name: string | null;
  }[]>`
    SELECT p.id, p.status, p.created_at,
           p.original_request->>'url' as original_url,
           p.original_request->>'method' as original_method,
           p.challenge->>'realm' as challenge_realm,
           p.challenge->>'description' as challenge_description,
           p.challenge->>'request' as challenge_request,
           p.output_tx_hash,
           p.deposit_address,
           prov.name as provider_name
    FROM mpp_payments p
    LEFT JOIN mpp_providers prov ON p.original_request->>'url' LIKE prov.url || '%'
    ORDER BY p.created_at DESC LIMIT 20
  `;

  return {
    totals: {
      transactions: txns?.cnt ?? 0,
      providers: providerCount?.cnt ?? 0,
      ratings: ratingCount?.cnt ?? 0,
    },
    series: {
      transactions: txnSeries.map((r) => r.cnt),
      ratings: ratingSeries.map((r) => r.cnt),
    },
    recentPayments,
  };
}
