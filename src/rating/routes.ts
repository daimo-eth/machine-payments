/** HTTP route handler for rating system. */

import { createRating, getRating } from "./ratings";
import {
  getProvider,
  getProviderStats,
  getRecentRatings,
  listProviders,
  getLeaderboard,
  updateProvider,
} from "./providers";
import { queryEvents } from "./events";

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function err(message: string, status = 400) {
  return json({ error: { message } }, status);
}

export async function handleRatingRoute(
  req: Request,
  url: URL
): Promise<Response | null> {
  // POST /v1/ratings
  if (req.method === "POST" && url.pathname === "/v1/ratings") {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return err("Invalid JSON body");
    }

    const result = createRating({
      paymentId: body.paymentId,
      overall: body.overall,
      speed: body.speed,
      quality: body.quality,
      value: body.value,
      reliability: body.reliability,
      comment: body.comment,
      tags: body.tags,
      useCase: body.useCase,
      agentId: body.agentId,
    });

    if ("error" in result) {
      return err(result.error, result.status);
    }
    return json({ rating: result.rating }, 201);
  }

  // GET /v1/ratings/:id
  if (req.method === "GET" && url.pathname.startsWith("/v1/ratings/")) {
    const id = url.pathname.slice("/v1/ratings/".length);
    if (!id) return err("Rating ID required", 400);
    const rating = getRating(id);
    if (!rating) return err("Rating not found", 404);
    return json({ rating });
  }

  // GET /v1/providers/leaderboard (must be before /v1/providers/:id)
  if (req.method === "GET" && url.pathname === "/v1/providers/leaderboard") {
    const category = url.searchParams.get("category") ?? undefined;
    const sortBy = url.searchParams.get("sortBy") ?? undefined;
    const limit = url.searchParams.get("limit")
      ? parseInt(url.searchParams.get("limit")!)
      : undefined;

    const providers = getLeaderboard({ category, sortBy, limit });
    return json({ providers });
  }

  // GET /v1/providers/:id
  if (req.method === "GET" && url.pathname.startsWith("/v1/providers/")) {
    const id = url.pathname.slice("/v1/providers/".length);
    if (!id) return err("Provider ID required", 400);

    const provider = getProvider(id);
    if (!provider) return err("Provider not found", 404);

    const stats = getProviderStats(id);
    const recentRatings = getRecentRatings(id);

    return json({ provider, stats, recentRatings });
  }

  // GET /v1/providers
  if (req.method === "GET" && url.pathname === "/v1/providers") {
    const q = url.searchParams.get("q") ?? undefined;
    const category = url.searchParams.get("category") ?? undefined;
    const sortBy = url.searchParams.get("sortBy") ?? undefined;
    const limit = url.searchParams.get("limit")
      ? parseInt(url.searchParams.get("limit")!)
      : undefined;
    const offset = url.searchParams.get("offset")
      ? parseInt(url.searchParams.get("offset")!)
      : undefined;

    const result = listProviders({ q, category, sortBy, limit, offset });
    return json(result);
  }

  // PATCH /v1/providers/:id
  if (req.method === "PATCH" && url.pathname.startsWith("/v1/providers/")) {
    const id = url.pathname.slice("/v1/providers/".length);
    if (!id) return err("Provider ID required", 400);

    let body: any;
    try {
      body = await req.json();
    } catch {
      return err("Invalid JSON body");
    }

    const updated = updateProvider(id, {
      name: body.name,
      description: body.description,
      category: body.category,
      metadata: body.metadata,
    });

    if (!updated) return err("Provider not found", 404);
    return json({ provider: updated });
  }

  // GET /v1/events
  if (req.method === "GET" && url.pathname === "/v1/events") {
    const type = url.searchParams.get("type") ?? undefined;
    const providerUrl = url.searchParams.get("providerUrl") ?? undefined;
    const since = url.searchParams.get("since")
      ? parseInt(url.searchParams.get("since")!)
      : undefined;
    const limit = url.searchParams.get("limit")
      ? parseInt(url.searchParams.get("limit")!)
      : undefined;

    const events = queryEvents({ type, providerUrl, since, limit });
    return json({ events });
  }

  // Not a rating route
  return null;
}
