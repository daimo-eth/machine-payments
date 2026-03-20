import { useState, useEffect, useCallback } from "react";
import { fetchStats, fetchProviders } from "../api";
import type { DashboardStats, ProviderWithStats, TimeRange, SortOption } from "../types";
import { StatCard } from "./StatCard";
import { TimeRangeToggle } from "./TimeRangeToggle";
import { ProviderTable } from "./ProviderTable";
import { ActivityFeed } from "./ActivityFeed";
import { SearchBar } from "./SearchBar";
import { Globe } from "./Globe";

const SKILL_PROMPT = `Read ${window.location.origin}/skill.md and follow the instructions.`

export function Dashboard({ onSelectProvider }: { onSelectProvider: (id: string) => void }) {
  const [range, setRange] = useState<TimeRange>("24h");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [providers, setProviders] = useState<ProviderWithStats[]>([]);
  const [query, setQuery] = useState("");
  const [sortBy] = useState<SortOption>("total_payments");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchStats(range).then(setStats).catch(() => { });
  }, [range]);

  useEffect(() => {
    fetchProviders({ q: query || undefined, sortBy })
      .then(setProviders)
      .catch(() => setProviders([]));
  }, [query, sortBy]);

  const copyPrompt = useCallback(() => {
    navigator.clipboard.writeText(SKILL_PROMPT).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  return (
    <div className="dashboard">
      <div className="dash-hero">
        <div className="dash-hero-text">
          <h1 className="dash-title">Universal MPP</h1>
          <p className="dash-subtitle">Explorer</p>
        </div>
      </div>

      {/* CTA */}
      <div className="cta-card">
        <div className="cta-glow" />
        <div className="cta-content">
          <h2 className="cta-heading">Onboard your AI</h2>
          <p className="cta-prompt">{SKILL_PROMPT}</p>
          <button className="cta-copy" onClick={copyPrompt}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              {copied ? (
                <path d="M4 8.5l2.5 2.5L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <>
                  <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M3 11V3.5A1.5 1.5 0 014.5 2H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </>
              )}
            </svg>
            {copied ? "Copied!" : "Copy to Clipboard"}
          </button>
          <p className="cta-footer">Pay for any MPP-enabled API, with any asset, on any chain.</p>
        </div>
      </div>

      <section className="dash-section">
        <div className="dash-section-header">
          <h2 className="section-title">Usage</h2>
          <TimeRangeToggle value={range} onChange={setRange} />
        </div>

        <div className="stat-grid">
          <StatCard
            label="Transactions"
            value={stats?.totals.transactions ?? 0}
            series={stats?.series.transactions ?? []}
            color="#555"
            delay={0}
          />
          <StatCard
            label="Providers"
            value={stats?.totals.providers ?? 0}
            series={stats?.series.transactions ?? []}
            color="#555"
            delay={80}
          />
          <StatCard
            label="Ratings"
            value={stats?.totals.ratings ?? 0}
            series={stats?.series.ratings ?? []}
            color="#555"
            delay={160}
          />
        </div>

        {(() => {
          const rated = providers.filter((p) => p.total_ratings > 0 && p.avg_score != null);
          if (rated.length === 0) return null;
          const sorted = [...rated].sort((a, b) => Number(b.avg_score) - Number(a.avg_score));
          const top = sorted[0];
          const low = sorted[sorted.length - 1];
          return (
            <div className="review-summary">
              <div className="review-card" onClick={() => onSelectProvider(top.id)}>
                <span className="review-label">Top Rated</span>
                <span className="review-name">{top.name || top.url}</span>
                <span className="review-score">{Number(top.avg_score).toFixed(1)} / 5</span>
                <span className="review-count">{top.total_ratings} review{top.total_ratings !== 1 ? "s" : ""}</span>
              </div>
              {low.id !== top.id && (
                <div className="review-card" onClick={() => onSelectProvider(low.id)}>
                  <span className="review-label">Lowest Rated</span>
                  <span className="review-name">{low.name || low.url}</span>
                  <span className="review-score">{Number(low.avg_score).toFixed(1)} / 5</span>
                  <span className="review-count">{low.total_ratings} review{low.total_ratings !== 1 ? "s" : ""}</span>
                </div>
              )}
            </div>
          );
        })()}
      </section>

      <section className="dash-section">
        <h2 className="section-title">
          Payment Ticker
          <span className="live-dot" />
        </h2>
        <ActivityFeed payments={stats?.recentPayments ?? []} />
      </section>

      <section className="dash-section">
        <div className="dash-section-header">
          <h2 className="section-title">Servers</h2>
          <SearchBar value={query} onChange={setQuery} />
        </div>
        <ProviderTable providers={providers} onSelect={onSelectProvider} />
      </section>
    </div>
  );
}
