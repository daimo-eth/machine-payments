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

  // Count successful proxy requests (200 with payment credential = paid API call)
  const [txns] = await sql<{ cnt: number }[]>`
    SELECT COUNT(*)::int as cnt FROM mpp_proxy_requests
    WHERE response_status = 200 AND has_payment_credential = true
    ${interval ? sql`AND created_at >= now() - ${interval}::interval` : sql``}
  `;

  const [providerCount] = await sql<{ cnt: number }[]>`
    SELECT COUNT(*)::int as cnt FROM mpp_providers
  `;

  const [ratingCount] = await sql<{ cnt: number }[]>`
    SELECT COUNT(*)::int as cnt FROM mpp_ratings
    ${interval ? sql`WHERE created_at >= now() - ${interval}::interval` : sql``}
  `;

  // Time-series from proxy requests
  const txnSeries = await sql<{ cnt: number }[]>`
    SELECT cnt FROM (
      SELECT date_bin(${bucket}::interval, created_at, '2020-01-01'::timestamptz) as b,
             COUNT(*)::int as cnt
      FROM mpp_proxy_requests
      WHERE response_status = 200 AND has_payment_credential = true
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

  // Recent proxy requests for the ticker
  const recentPayments = await sql<{
    id: string;
    status: string;
    created_at: string;
    original_url: string | null;
    original_method: string | null;
    duration_ms: number | null;
    provider_name: string | null;
  }[]>`
    SELECT r.id,
           CASE
             WHEN r.response_status = 200 AND r.has_payment_credential THEN 'succeeded'
             WHEN r.response_status = 402 THEN 'pending'
             WHEN r.error IS NOT NULL THEN 'failed'
             ELSE 'failed'
           END as status,
           r.created_at,
           r.target_url as original_url,
           r.method as original_method,
           r.duration_ms,
           prov.name as provider_name
    FROM mpp_proxy_requests r
    LEFT JOIN mpp_providers prov ON r.target_url LIKE prov.url || '%'
    WHERE r.response_status IS NOT NULL
    ORDER BY r.created_at DESC LIMIT 20
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
