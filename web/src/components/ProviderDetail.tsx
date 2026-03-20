import { useState, useEffect } from "react";
import { fetchProviderDetail } from "../api";
import type { ProviderDetailResponse, ProviderEndpoint } from "../types";
import { StarRating } from "./StarRating";
import { TagChip } from "./TagChip";
import { RatingItem } from "./RatingItem";

function displayName(p: { name: string | null; url: string }): string {
  if (p.name) return p.name;
  try { return new URL(p.url).hostname; } catch { return p.url; }
}

function EndpointsTable({ endpoints }: { endpoints: ProviderEndpoint[] }) {
  const paid = endpoints.filter((e) => e.intent);
  const free = endpoints.filter((e) => !e.intent);

  return (
    <div className="endpoints-wrap">
      {paid.length > 0 && (
        <table className="endpoints-table">
          <thead>
            <tr>
              <th className="ep-col-method">Method</th>
              <th className="ep-col-path">Endpoint</th>
              <th className="ep-col-desc">Description</th>
              <th className="ep-col-price">Price</th>
            </tr>
          </thead>
          <tbody>
            {paid.map((e, i) => (
              <tr key={i} className="ep-row">
                <td className="ep-col-method"><span className="ep-method">{e.method}</span></td>
                <td className="ep-col-path ep-mono">{e.path}</td>
                <td className="ep-col-desc">{e.description}</td>
                <td className="ep-col-price ep-mono">{e.price ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {free.length > 0 && (
        <>
          <h3 className="ep-free-label">Free endpoints</h3>
          <table className="endpoints-table">
            <tbody>
              {free.map((e, i) => (
                <tr key={i} className="ep-row ep-row-free">
                  <td className="ep-col-method"><span className="ep-method">{e.method}</span></td>
                  <td className="ep-col-path ep-mono">{e.path}</td>
                  <td className="ep-col-desc">{e.description}</td>
                  <td className="ep-col-price">—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

export function ProviderDetail({ providerId, onBack }: { providerId: string; onBack: () => void }) {
  const [data, setData] = useState<ProviderDetailResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchProviderDetail(providerId)
      .then(setData)
      .catch(() => setError(true));
  }, [providerId]);

  if (error) {
    return (
      <div className="detail">
        <button className="back-btn" onClick={onBack}>&larr; Back</button>
        <div className="empty-table"><p>Provider not found.</p></div>
      </div>
    );
  }
  if (!data) return <div className="loading">Loading...</div>;

  const { provider, stats, recentRatings } = data;
  const endpoints = provider.endpoints ?? [];

  return (
    <div className="detail fade-in">
      <button className="back-btn" onClick={onBack}>&larr; Back</button>

      <div className="detail-header">
        <h1 className="detail-name">{displayName(provider)}</h1>
        <div className="detail-meta">
          <a href={provider.url} target="_blank" rel="noopener noreferrer" className="detail-url">{provider.url}</a>
          {provider.category && <span className="badge">{provider.category}</span>}
        </div>
        <StarRating score={stats.avgScore} />
        {provider.description && <p className="detail-desc">{provider.description}</p>}
      </div>

      {endpoints.length > 0 && (
        <section className="detail-section">
          <h2>Endpoints</h2>
          <EndpointsTable endpoints={endpoints} />
        </section>
      )}

      <section className="detail-section">
        <h2>Stats</h2>
        <div className="detail-stats-row">
          <div className="detail-stat-box">
            <span className="detail-stat-num">{stats.totalPayments}</span>
            <span className="detail-stat-label">Payments</span>
          </div>
          <div className="detail-stat-box">
            <span className="detail-stat-num">{stats.totalRatings}</span>
            <span className="detail-stat-label">Ratings</span>
          </div>
        </div>
      </section>

      {stats.topTags.length > 0 && (
        <section className="detail-section">
          <h2>Tags</h2>
          <div className="detail-tags">
            {stats.topTags.map((t) => <TagChip key={t.tag} tag={t.tag} count={t.count} />)}
          </div>
        </section>
      )}

      <section className="detail-section">
        <h2>Recent Ratings</h2>
        {recentRatings.length === 0 ? (
          <div className="empty-table"><p>No ratings yet.</p></div>
        ) : (
          <div className="ratings-list">
            {recentRatings.map((r) => <RatingItem key={r.id} rating={r} />)}
          </div>
        )}
      </section>
    </div>
  );
}
