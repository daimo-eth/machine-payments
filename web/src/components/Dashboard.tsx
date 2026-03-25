import { useState, useEffect, useCallback } from "react";
import { fetchStats, fetchProviders } from "../api";
import type { DashboardStats, ProviderWithStats, TimeRange, SortOption } from "../types";
import { StatCard } from "./StatCard";
import { TimeRangeToggle } from "./TimeRangeToggle";
import { ProviderTable } from "./ProviderTable";
import { ActivityFeed } from "./ActivityFeed";
import { SearchBar } from "./SearchBar";
import { DEMOS, ClaudeButton } from "./Demo";

const AGENTS = [
  { id: "claude", label: "Claude", command: "claude" },
  { id: "codex", label: "Codex", command: "codex" },
  { id: "opencode", label: "OpenCode", command: "opencode" },
  { id: "cursor", label: "Cursor", command: "cursor" },
] as const;

function buildCommand(agentCommand: string) {
  return `${agentCommand} "Read https://mpp.daimo.com/skill.md and follow the instructions"`;
}

export function Dashboard({ onSelectProvider }: { onSelectProvider: (id: string) => void }) {
  const [range, setRange] = useState<TimeRange>("all");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [providers, setProviders] = useState<ProviderWithStats[]>([]);
  const [query, setQuery] = useState("");
  const [sortBy] = useState<SortOption>("total_payments");
  const [copied, setCopied] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState("claude");

  useEffect(() => {
    fetchStats(range).then(setStats).catch(() => { });
  }, [range]);

  useEffect(() => {
    fetchProviders({ q: query || undefined, sortBy })
      .then(setProviders)
      .catch(() => setProviders([]));
  }, [query, sortBy]);

  const agent = AGENTS.find((a) => a.id === selectedAgent) ?? AGENTS[0];
  const commandText = buildCommand(agent.command);

  const copyPrompt = useCallback(() => {
    const text = buildCommand(
      (AGENTS.find((a) => a.id === selectedAgent) ?? AGENTS[0]).command
    );
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [selectedAgent]);

  return (
    <div className="dashboard">
      <div className="dash-hero">
        <div className="dash-hero-text">
          <h1 className="dash-title">Daimo Machine Payments</h1>
          <p className="dash-subtitle">Explorer</p>
        </div>
      </div>

      {/* CTA — Agent selector terminal */}
      <div className="cta-terminal-card">
        <div className="cta-agent-tabs">
          {AGENTS.map((a) => (
            <button
              key={a.id}
              className={`cta-agent-tab ${selectedAgent === a.id ? "active" : ""}`}
              onClick={() => setSelectedAgent(a.id)}
            >
              {a.label}
            </button>
          ))}
        </div>
        <div className="cta-terminal-body">
          <div className="cta-terminal-line">
            <span className="cta-terminal-prompt">$</span>
            <code className="cta-terminal-text">{commandText}</code>
          </div>
          <button className="cta-try-btn" onClick={copyPrompt}>
            {copied ? "Copied!" : "Try with your agent"}
          </button>
        </div>
      </div>
      <p className="cta-footer">Pay for any MPP-enabled API, with any asset, on any chain.</p>

      {/* Quick Demos */}
      <section className="dash-section">
        <h2 className="section-title">Quick Demos</h2>
        <div className="demo-cards">
          {DEMOS.map((d) => {
            const ready = d.href !== "#";
            return (
              <div key={d.title} className={`demo-card${!ready ? " demo-card-soon" : ""}`}>
                <span className="demo-card-emoji">{d.emoji}</span>
                <span className="demo-card-title">{d.title}</span>
                {ready ? (
                  <ClaudeButton href={d.href} label="Claude" />
                ) : (
                  <span className="demo-card-badge">Soon</span>
                )}
              </div>
            );
          })}
        </div>
      </section>

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
            color="#ccc"
            delay={0}
          />
          <StatCard
            label="Providers"
            value={stats?.totals.providers ?? 0}
            series={stats?.series.transactions ?? []}
            color="#ccc"
            delay={80}
          />
          <StatCard
            label="Ratings"
            value={stats?.totals.ratings ?? 0}
            series={stats?.series.ratings ?? []}
            color="#ccc"
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
              <div className="review-card review-card-gold" onClick={() => onSelectProvider(top.id)}>
                <span className="review-label">Top Rated</span>
                <span className="review-name">{top.name || top.url}</span>
                <span className="review-score">{Number(top.avg_score).toFixed(1)} / 5</span>
                <span className="review-count">{top.total_ratings} review{top.total_ratings !== 1 ? "s" : ""}</span>
              </div>
              {low.id !== top.id && (
                <div className="review-card review-card-red" onClick={() => onSelectProvider(low.id)}>
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
