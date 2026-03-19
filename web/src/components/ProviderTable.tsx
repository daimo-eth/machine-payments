import type { ProviderWithStats } from "../types";
import { StarRating } from "./StarRating";

function displayName(p: ProviderWithStats): string {
  if (p.name) return p.name;
  try { return new URL(p.url).hostname; } catch { return p.url; }
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function ProviderTable({
  providers,
  onSelect,
}: {
  providers: ProviderWithStats[];
  onSelect: (id: string) => void;
}) {
  if (providers.length === 0) {
    return (
      <div className="empty-table">
        <div className="empty-table-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect x="4" y="8" width="40" height="32" rx="4" stroke="var(--color-border)" strokeWidth="2" fill="none"/>
            <line x1="4" y1="18" x2="44" y2="18" stroke="var(--color-border)" strokeWidth="2"/>
            <line x1="20" y1="18" x2="20" y2="40" stroke="var(--color-border)" strokeWidth="1.5"/>
          </svg>
        </div>
        <p>No providers registered yet.</p>
        <p className="empty-table-sub">Providers appear automatically when agents make payments via the API.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="provider-table">
        <thead>
          <tr>
            <th className="col-server">Server</th>
            <th className="col-num">Txns</th>
            <th className="col-num">Rating</th>
            <th className="col-num">Ratings</th>
            <th className="col-time">Latest</th>
          </tr>
        </thead>
        <tbody>
          {providers.map((p, i) => (
            <tr
              key={p.id}
              className="provider-row"
              onClick={() => onSelect(p.id)}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <td className="col-server">
                <div className="server-info">
                  <span className="server-name">{displayName(p)}</span>
                  <span className="server-url">{p.url}</span>
                </div>
              </td>
              <td className="col-num">
                <span className="num-value">{p.total_payments}</span>
              </td>
              <td className="col-num">
                <StarRating score={p.avg_score} compact />
              </td>
              <td className="col-num">
                <span className="num-value">{p.total_ratings}</span>
              </td>
              <td className="col-time">
                <span className="time-value">{timeAgo(p.updated_at)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
