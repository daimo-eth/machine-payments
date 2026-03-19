/** HTTP route handler for ratings and directory. */

import { createRating, getRating } from "./ratings";
import {
  getProvider,
  getProviderStats,
  getRecentRatings,
  listProviders,
  getLeaderboard,
  updateProvider,
} from "./providers";
import { getDashboardStats } from "./stats";

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function err(message: string, status = 400) {
  return json({ error: { message } }, status);
}

/** Match rating and directory routes. Returns null if no match. */
export async function handleRatingRoute(
  req: Request,
  url: URL
): Promise<Response | null> {
  // POST /v1/ratings -- submit or update a rating
  if (req.method === "POST" && url.pathname === "/v1/ratings") {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return err("Invalid JSON body");
    }

    const result = await createRating({
      paymentId: body.paymentId,
      score: body.score,
      comment: body.comment,
      tags: body.tags,
      agentId: body.agentId,
    });

    if ("error" in result) return err(result.error, result.status);
    return json({ rating: result.rating }, 201);
  }

  // GET /v1/ratings/:id -- get a single rating
  if (req.method === "GET" && url.pathname.startsWith("/v1/ratings/")) {
    const id = url.pathname.slice("/v1/ratings/".length);
    if (!id) return err("Rating ID required", 400);
    const rating = await getRating(id);
    if (!rating) return err("Rating not found", 404);
    return json({ rating });
  }

  // GET /v1/providers/leaderboard -- ranked providers (min 3 ratings)
  if (req.method === "GET" && url.pathname === "/v1/providers/leaderboard") {
    const providers = await getLeaderboard({
      category: url.searchParams.get("category") ?? undefined,
      sortBy: url.searchParams.get("sortBy") ?? undefined,
      limit: url.searchParams.get("limit") ? parseInt(url.searchParams.get("limit")!) : undefined,
    });
    return json({ providers });
  }

  // GET /v1/providers/:id -- provider detail with stats and recent ratings
  if (req.method === "GET" && url.pathname.startsWith("/v1/providers/")) {
    const id = url.pathname.slice("/v1/providers/".length);
    if (!id) return err("Provider ID required", 400);

    const provider = await getProvider(id);
    if (!provider) return err("Provider not found", 404);

    const [stats, recentRatings] = await Promise.all([
      getProviderStats(id),
      getRecentRatings(id),
    ]);

    return json({ provider, stats, recentRatings });
  }

  // GET /v1/providers -- list/search providers
  if (req.method === "GET" && url.pathname === "/v1/providers") {
    const result = await listProviders({
      q: url.searchParams.get("q") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
      sortBy: url.searchParams.get("sortBy") ?? undefined,
      limit: url.searchParams.get("limit") ? parseInt(url.searchParams.get("limit")!) : undefined,
      offset: url.searchParams.get("offset") ? parseInt(url.searchParams.get("offset")!) : undefined,
    });
    return json(result);
  }

  // PATCH /v1/providers/:id -- update provider metadata
  if (req.method === "PATCH" && url.pathname.startsWith("/v1/providers/")) {
    const id = url.pathname.slice("/v1/providers/".length);
    if (!id) return err("Provider ID required", 400);

    let body: any;
    try {
      body = await req.json();
    } catch {
      return err("Invalid JSON body");
    }

    const updated = await updateProvider(id, {
      name: body.name,
      description: body.description,
      category: body.category,
      metadata: body.metadata,
    });

    if (!updated) return err("Provider not found", 404);
    return json({ provider: updated });
  }

  // GET /v1/stats
  if (req.method === "GET" && url.pathname === "/v1/stats") {
    const range = url.searchParams.get("range") ?? "24h";
    const valid = ["1m", "5m", "1h", "24h", "all"];
    const r = valid.includes(range) ? (range as any) : "24h";
    return json(await getDashboardStats(r));
  }

  return null;
}
