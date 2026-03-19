/** Provider CRUD, search, and aggregation. */

import sql from "../db";
import type { Provider, ProviderStats, ProviderWithStats, Rating } from "./schema";

const SHARED_HOSTS = ["mpp.dev"];

/** Normalize a service URL to a canonical provider URL (protocol + host). */
export function normalizeProviderUrl(rawUrl: string): string {
  const u = new URL(rawUrl);
  if (SHARED_HOSTS.includes(u.host)) {
    const match = u.pathname.match(/^(\/api\/[^/]+)/);
    if (match) return `${u.protocol}//${u.host}${match[1]}`;
  }
  return `${u.protocol}//${u.host}`;
}

/** Get or auto-create a provider for a given service URL. */
export async function ensureProvider(serviceUrl: string): Promise<Provider> {
  const url = normalizeProviderUrl(serviceUrl);

  const [existing] = await sql<Provider[]>`
    SELECT * FROM mpp_providers WHERE url = ${url}
  `;
  if (existing) return existing;

  const [created] = await sql<Provider[]>`
    INSERT INTO mpp_providers (url)
    VALUES (${url})
    ON CONFLICT (url) DO UPDATE SET url = EXCLUDED.url
    RETURNING *
  `;
  return created;
}

/** Get a provider by ID. */
export async function getProvider(id: string): Promise<Provider | null> {
  const [row] = await sql<Provider[]>`
    SELECT * FROM mpp_providers WHERE id = ${id}
  `;
  return row ?? null;
}

/** Update provider metadata (name, description, category, metadata). */
export async function updateProvider(
  id: string,
  update: { name?: string; description?: string; category?: string; metadata?: Record<string, unknown> }
): Promise<Provider | null> {
  const provider = await getProvider(id);
  if (!provider) return null;

  const [updated] = await sql<Provider[]>`
    UPDATE mpp_providers SET
      name = COALESCE(${update.name ?? null}, name),
      description = COALESCE(${update.description ?? null}, description),
      category = COALESCE(${update.category ?? null}, category),
      metadata = COALESCE(${update.metadata ? sql.json(update.metadata as any) : null}::jsonb, metadata),
      updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  return updated ?? null;
}

/** Aggregate stats for a provider (payment count, rating averages, top tags). */
export async function getProviderStats(providerId: string): Promise<ProviderStats> {
  const [payments] = await sql<{ cnt: number }[]>`
    SELECT COUNT(*) as cnt FROM mpp_payments
    WHERE status = 'succeeded'
    AND original_request->>'url' LIKE (
      SELECT url || '%' FROM mpp_providers WHERE id = ${providerId}
    )
  `;

  const [aggs] = await sql<{
    cnt: number;
    avg_score: number | null;
  }[]>`
    SELECT COUNT(*) as cnt, AVG(score) as avg_score
    FROM mpp_ratings WHERE provider_id = ${providerId}
  `;

  // Top tags
  const tagRows = await sql<{ tags: string[] }[]>`
    SELECT tags FROM mpp_ratings
    WHERE provider_id = ${providerId} AND tags IS NOT NULL
  `;

  const tagCounts = new Map<string, number>();
  for (const r of tagRows) {
    if (!r.tags) continue;
    for (const t of r.tags) {
      tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }
  }

  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));

  const round = (n: number | null) => (n != null ? Math.round(n * 10) / 10 : null);

  return {
    totalPayments: payments?.cnt ?? 0,
    totalRatings: aggs?.cnt ?? 0,
    avgScore: round(aggs?.avg_score ?? null),
    topTags,
  };
}

/** Get the most recent ratings for a provider. */
export async function getRecentRatings(providerId: string, limit = 10): Promise<Rating[]> {
  return sql<Rating[]>`
    SELECT * FROM mpp_ratings
    WHERE provider_id = ${providerId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
}

/** List providers with optional full-text search, category filter, and sorting. */
export async function listProviders(params: {
  q?: string;
  category?: string;
  sortBy?: string;
  limit?: number;
  offset?: number;
}): Promise<{ providers: ProviderWithStats[] }> {
  const limit = Math.min(params.limit ?? 20, 100);
  const offset = params.offset ?? 0;
  const sortCol = params.sortBy === "total_ratings" ? "total_ratings"
    : params.sortBy === "total_payments" ? "total_payments"
    : "avg_score";

  if (params.q) {
    const tsquery = params.q.split(/\s+/).map(w => `${w}:*`).join(" & ");
    const rows = await sql<ProviderWithStats[]>`
      SELECT p.*,
        (SELECT AVG(score) FROM mpp_ratings WHERE provider_id = p.id) as avg_score,
        (SELECT COUNT(*)::int FROM mpp_ratings WHERE provider_id = p.id) as total_ratings,
        (SELECT COUNT(*)::int FROM mpp_payments
         WHERE status = 'succeeded' AND original_request->>'url' LIKE p.url || '%') as total_payments
      FROM mpp_providers p
      WHERE p.search_vector @@ to_tsquery('english', ${tsquery})
      ${params.category ? sql`AND p.category = ${params.category}` : sql``}
      ORDER BY ts_rank(p.search_vector, to_tsquery('english', ${tsquery})) DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    return { providers: rows };
  }

  const rows = await sql<ProviderWithStats[]>`
    SELECT p.*,
      (SELECT AVG(score) FROM mpp_ratings WHERE provider_id = p.id) as avg_score,
      (SELECT COUNT(*)::int FROM mpp_ratings WHERE provider_id = p.id) as total_ratings,
      (SELECT COUNT(*)::int FROM mpp_payments
       WHERE status = 'succeeded' AND original_request->>'url' LIKE p.url || '%') as total_payments
    FROM mpp_providers p
    ${params.category ? sql`WHERE p.category = ${params.category}` : sql``}
    ORDER BY ${sql(sortCol)} DESC NULLS LAST
    LIMIT ${limit} OFFSET ${offset}
  `;
  return { providers: rows };
}

/** Ranked providers with at least 3 ratings. */
export async function getLeaderboard(params: {
  category?: string;
  sortBy?: string;
  limit?: number;
}): Promise<ProviderWithStats[]> {
  const limit = Math.min(params.limit ?? 20, 100);
  const sortCol = params.sortBy === "total_ratings" ? "total_ratings"
    : params.sortBy === "total_payments" ? "total_payments"
    : "avg_score";

  return sql<ProviderWithStats[]>`
    SELECT * FROM (
      SELECT p.*,
        (SELECT AVG(score) FROM mpp_ratings WHERE provider_id = p.id) as avg_score,
        (SELECT COUNT(*)::int FROM mpp_ratings WHERE provider_id = p.id) as total_ratings,
        (SELECT COUNT(*)::int FROM mpp_payments
         WHERE status = 'succeeded' AND original_request->>'url' LIKE p.url || '%') as total_payments
      FROM mpp_providers p
      ${params.category ? sql`WHERE p.category = ${params.category}` : sql``}
    ) sub
    WHERE total_ratings >= 3
    ORDER BY ${sql(sortCol)} DESC NULLS LAST
    LIMIT ${limit}
  `;
}
