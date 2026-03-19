import type { ProviderWithStats, ProviderDetailResponse, SortOption, TimeRange, DashboardStats } from "./types";

export async function fetchStats(range: TimeRange = "7d"): Promise<DashboardStats> {
  const res = await fetch(`/v1/stats?range=${range}`);
  return res.json();
}

export async function fetchProviders(params: {
  q?: string;
  category?: string;
  sortBy?: SortOption;
}): Promise<ProviderWithStats[]> {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.category) sp.set("category", params.category);
  if (params.sortBy) sp.set("sortBy", params.sortBy);
  sp.set("limit", "50");

  const res = await fetch(`/v1/providers?${sp}`);
  const data = await res.json();
  return data.providers ?? [];
}

export async function fetchProviderDetail(id: string): Promise<ProviderDetailResponse> {
  const res = await fetch(`/v1/providers/${id}`);
  if (!res.ok) throw new Error("Provider not found");
  return res.json();
}
