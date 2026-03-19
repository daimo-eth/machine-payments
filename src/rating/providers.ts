/** Provider CRUD + aggregation queries. */

import type { SQLQueryBindings } from "bun:sqlite";
import { getDb } from "./db";
import type { Provider, ProviderStats, Rating } from "./schema";

const SHARED_HOSTS = ["mpp.dev"];

/** Normalize a service URL to a canonical provider URL. */
export function normalizeProviderUrl(rawUrl: string): string {
  const u = new URL(rawUrl);
  if (SHARED_HOSTS.includes(u.host)) {
    // Keep first path segment after /api/
    const match = u.pathname.match(/^(\/api\/[^/]+)/);
    if (match) return `${u.protocol}//${u.host}${match[1]}`;
  }
  return `${u.protocol}//${u.host}`;
}

/** Get or auto-create a provider for a given service URL. */
export function ensureProvider(
  serviceUrl: string,
  intent?: string
): Provider {
  const db = getDb();
  const url = normalizeProviderUrl(serviceUrl);
  const existing = db
    .query<Provider, [string]>("SELECT * FROM providers WHERE url = ?")
    .get(url);

  if (existing) {
    // Merge new intent if not already tracked
    if (intent) {
      const intents: string[] = JSON.parse(existing.mpp_intents);
      if (!intents.includes(intent)) {
        intents.push(intent);
        db.run("UPDATE providers SET mpp_intents = ?, updated_at = ? WHERE id = ?", [
          JSON.stringify(intents),
          Date.now(),
          existing.id,
        ]);
        existing.mpp_intents = JSON.stringify(intents);
      }
    }
    return existing;
  }

  const id = crypto.randomUUID();
  const now = Date.now();
  const intents = intent ? JSON.stringify([intent]) : "[]";

  db.run(
    `INSERT INTO providers (id, url, name, description, category, mpp_intents, metadata, created_at, updated_at)
     VALUES (?, ?, NULL, NULL, NULL, ?, NULL, ?, ?)`,
    [id, url, intents, now, now]
  );

  return {
    id,
    url,
    name: null,
    description: null,
    category: null,
    mpp_intents: intents,
    metadata: null,
    created_at: now,
    updated_at: now,
  };
}

export function getProvider(id: string): Provider | null {
  return (
    getDb()
      .query<Provider, [string]>("SELECT * FROM providers WHERE id = ?")
      .get(id) ?? null
  );
}

export function updateProvider(
  id: string,
  update: { name?: string; description?: string; category?: string; metadata?: Record<string, unknown> }
): Provider | null {
  const db = getDb();
  const provider = getProvider(id);
  if (!provider) return null;

  const sets: string[] = [];
  const args: SQLQueryBindings[] = [];

  if (update.name !== undefined) {
    sets.push("name = ?");
    args.push(update.name);
  }
  if (update.description !== undefined) {
    sets.push("description = ?");
    args.push(update.description);
  }
  if (update.category !== undefined) {
    sets.push("category = ?");
    args.push(update.category);
  }
  if (update.metadata !== undefined) {
    sets.push("metadata = ?");
    args.push(JSON.stringify(update.metadata));
  }

  if (sets.length === 0) return provider;

  sets.push("updated_at = ?");
  args.push(Date.now());
  args.push(id);

  db.run(`UPDATE providers SET ${sets.join(", ")} WHERE id = ?`, args);

  // Sync FTS
  syncProviderFts(id);

  return getProvider(id);
}

function syncProviderFts(providerId: string) {
  const db = getDb();
  const p = getProvider(providerId);
  if (!p) return;

  // Get rowid for content sync
  const row = db
    .query<{ rowid: number }, [string]>("SELECT rowid FROM providers WHERE id = ?")
    .get(providerId);
  if (!row) return;

  // Delete old entry, insert new
  db.run("INSERT INTO providers_fts(providers_fts, rowid, name, description, category) VALUES('delete', ?, ?, ?, ?)", [
    row.rowid,
    p.name ?? "",
    p.description ?? "",
    p.category ?? "",
  ]);
  db.run("INSERT INTO providers_fts(rowid, name, description, category) VALUES(?, ?, ?, ?)", [
    row.rowid,
    p.name ?? "",
    p.description ?? "",
    p.category ?? "",
  ]);
}

export function getProviderStats(providerId: string): ProviderStats {
  const db = getDb();

  const paymentCount = db
    .query<{ cnt: number }, [string]>(
      "SELECT COUNT(*) as cnt FROM events WHERE provider_url = (SELECT url FROM providers WHERE id = ?) AND type = 'payment.succeeded'"
    )
    .get(providerId);

  const ratingAggs = db
    .query<
      {
        cnt: number;
        avg_overall: number | null;
        avg_speed: number | null;
        avg_quality: number | null;
        avg_value: number | null;
        avg_reliability: number | null;
      },
      [string]
    >(
      `SELECT COUNT(*) as cnt,
              AVG(overall_score) as avg_overall,
              AVG(speed_score) as avg_speed,
              AVG(quality_score) as avg_quality,
              AVG(value_score) as avg_value,
              AVG(reliability_score) as avg_reliability
       FROM ratings WHERE provider_id = ?`
    )
    .get(providerId);

  // Top tags
  const ratings = db
    .query<{ tags: string | null }, [string]>(
      "SELECT tags FROM ratings WHERE provider_id = ? AND tags IS NOT NULL"
    )
    .all(providerId);

  const tagCounts = new Map<string, number>();
  for (const r of ratings) {
    if (!r.tags) continue;
    const tags: string[] = JSON.parse(r.tags);
    for (const t of tags) {
      tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }
  }
  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));

  const round = (n: number | null) => (n != null ? Math.round(n * 10) / 10 : null);

  return {
    totalPayments: paymentCount?.cnt ?? 0,
    totalRatings: ratingAggs?.cnt ?? 0,
    avgOverall: round(ratingAggs?.avg_overall ?? null),
    avgSpeed: round(ratingAggs?.avg_speed ?? null),
    avgQuality: round(ratingAggs?.avg_quality ?? null),
    avgValue: round(ratingAggs?.avg_value ?? null),
    avgReliability: round(ratingAggs?.avg_reliability ?? null),
    topTags,
  };
}

export function getRecentRatings(providerId: string, limit = 10): Rating[] {
  return getDb()
    .query<Rating, [string, number]>(
      "SELECT * FROM ratings WHERE provider_id = ? ORDER BY created_at DESC LIMIT ?"
    )
    .all(providerId, limit);
}

export function listProviders(params: {
  q?: string;
  category?: string;
  sortBy?: string;
  limit?: number;
  offset?: number;
}): { providers: (Provider & { avg_score: number | null; total_ratings: number; total_payments: number })[] } {
  const db = getDb();
  const limit = Math.min(params.limit ?? 20, 100);
  const offset = params.offset ?? 0;

  // FTS search
  if (params.q) {
    const ftsQuery = params.q.split(/\s+/).map((w) => `"${w}"*`).join(" ");
    const conditions: string[] = [];
    const args: SQLQueryBindings[] = [ftsQuery];

    if (params.category) {
      conditions.push("p.category = ?");
      args.push(params.category);
    }

    const where = conditions.length ? `AND ${conditions.join(" AND ")}` : "";

    const rows = db
      .query<Provider & { avg_score: number | null; total_ratings: number; total_payments: number }, SQLQueryBindings[]>(
        `SELECT p.*,
                (SELECT AVG(overall_score) FROM ratings WHERE provider_id = p.id) as avg_score,
                (SELECT COUNT(*) FROM ratings WHERE provider_id = p.id) as total_ratings,
                (SELECT COUNT(*) FROM events WHERE provider_url = p.url AND type = 'payment.succeeded') as total_payments
         FROM providers p
         JOIN providers_fts fts ON fts.rowid = p.rowid
         WHERE providers_fts MATCH ? ${where}
         ORDER BY rank
         LIMIT ? OFFSET ?`
      )
      .all(...args, limit, offset);

    return { providers: rows };
  }

  // Regular listing
  const conditions: string[] = [];
  const args: SQLQueryBindings[] = [];

  if (params.category) {
    conditions.push("p.category = ?");
    args.push(params.category);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const sortCol =
    params.sortBy === "total_ratings"
      ? "total_ratings"
      : params.sortBy === "total_payments"
        ? "total_payments"
        : "avg_score";

  const rows = db
    .query<Provider & { avg_score: number | null; total_ratings: number; total_payments: number }, SQLQueryBindings[]>(
      `SELECT p.*,
              (SELECT AVG(overall_score) FROM ratings WHERE provider_id = p.id) as avg_score,
              (SELECT COUNT(*) FROM ratings WHERE provider_id = p.id) as total_ratings,
              (SELECT COUNT(*) FROM events WHERE provider_url = p.url AND type = 'payment.succeeded') as total_payments
       FROM providers p
       ${where}
       ORDER BY ${sortCol} DESC NULLS LAST
       LIMIT ? OFFSET ?`
    )
    .all(...args, limit, offset);

  return { providers: rows };
}

export function getLeaderboard(params: {
  category?: string;
  sortBy?: string;
  limit?: number;
}): (Provider & { avg_score: number | null; total_ratings: number; total_payments: number })[] {
  const db = getDb();
  const limit = Math.min(params.limit ?? 20, 100);
  const args: SQLQueryBindings[] = [];
  const conditions: string[] = [];

  if (params.category) {
    conditions.push("category = ?");
    args.push(params.category);
  }

  const catFilter = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const sortCol =
    params.sortBy === "total_ratings"
      ? "total_ratings"
      : params.sortBy === "total_payments"
        ? "total_payments"
        : "avg_score";

  return db
    .query<Provider & { avg_score: number | null; total_ratings: number; total_payments: number }, SQLQueryBindings[]>(
      `SELECT *
       FROM (
         SELECT p.*,
                (SELECT AVG(overall_score) FROM ratings WHERE provider_id = p.id) as avg_score,
                (SELECT COUNT(*) FROM ratings WHERE provider_id = p.id) as total_ratings,
                (SELECT COUNT(*) FROM events WHERE provider_url = p.url AND type = 'payment.succeeded') as total_payments
         FROM providers p
         ${catFilter}
       ) WHERE total_ratings >= 3
       ORDER BY ${sortCol} DESC NULLS LAST
       LIMIT ?`
    )
    .all(...args, limit);
}
