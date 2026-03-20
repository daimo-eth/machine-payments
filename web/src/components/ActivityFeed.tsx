import type { RecentPayment } from "../types";

function timeAgo(ts: string): string {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function apiPath(url: string | null): string {
  if (!url) return "—";
  try { return new URL(url).pathname; } catch { return "—"; }
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function statusInfo(status: string): { label: string; cls: string } {
  switch (status) {
    case "succeeded": return { label: "OK", cls: "tk-paid" };
    case "pending": return { label: "402", cls: "tk-pending" };
    case "failed": return { label: "ERR", cls: "tk-failed" };
    default: return { label: status.toUpperCase(), cls: "" };
  }
}

export function ActivityFeed({ payments }: { payments: RecentPayment[] }) {
  if (payments.length === 0) {
    return (
      <div className="feed-empty">
        <span className="feed-empty-dot" />
        Waiting for payments...
      </div>
    );
  }

  return (
    <div className="ticker">
      <div className="ticker-header">
        <span className="ticker-col ticker-col-status">Status</span>
        <span className="ticker-col ticker-col-service">Service</span>
        <span className="ticker-col ticker-col-method">Method</span>
        <span className="ticker-col ticker-col-path">Path</span>
        <span className="ticker-col ticker-col-duration">Latency</span>
        <span className="ticker-col ticker-col-time">Age</span>
      </div>
      {payments.map((p, i) => {
        const { label, cls } = statusInfo(p.status);
        const path = apiPath(p.original_url);
        const method = p.original_method?.toUpperCase() || "—";

        return (
          <div key={p.id} className="ticker-row" style={{ animationDelay: `${i * 25}ms` }}>
            <span className="ticker-col ticker-col-status">
              <span className={`ticker-badge ${cls}`}>{label}</span>
            </span>
            <span className="ticker-col ticker-col-service">{p.provider_name || "—"}</span>
            <span className="ticker-col ticker-col-method ticker-mono">{method}</span>
            <span className="ticker-col ticker-col-path ticker-mono" title={path}>{path}</span>
            <span className="ticker-col ticker-col-duration ticker-mono">{formatDuration(p.duration_ms)}</span>
            <span className="ticker-col ticker-col-time">{timeAgo(p.created_at)}</span>
          </div>
        );
      })}
    </div>
  );
}
