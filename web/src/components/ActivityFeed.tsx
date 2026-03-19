import type { RecentPayment } from "../types";

function timeAgo(ts: string): string {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function shortUrl(url: string | null): string {
  if (!url) return "unknown";
  try { return new URL(url).hostname; } catch { return url; }
}

function statusBadge(status: string): { text: string; cls: string } {
  switch (status) {
    case "succeeded": return { text: "Success", cls: "ev-success" };
    case "pending": return { text: "Pending", cls: "ev-pending" };
    case "failed": return { text: "Failed", cls: "ev-fail" };
    default: return { text: status, cls: "" };
  }
}

export function ActivityFeed({ payments }: { payments: RecentPayment[] }) {
  if (payments.length === 0) {
    return (
      <div className="feed-empty">
        <span className="feed-empty-dot" />
        Waiting for activity...
      </div>
    );
  }

  return (
    <div className="feed">
      {payments.map((p, i) => {
        const { text, cls } = statusBadge(p.status);
        return (
          <div key={p.id} className="feed-item" style={{ animationDelay: `${i * 30}ms` }}>
            <span className={`feed-badge ${cls}`}>{text}</span>
            <span className="feed-provider">{shortUrl(p.original_url)}</span>
            <span className="feed-time">{timeAgo(p.created_at)}</span>
          </div>
        );
      })}
    </div>
  );
}
