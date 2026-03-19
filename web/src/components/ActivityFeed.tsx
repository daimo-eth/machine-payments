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

function shortHost(url: string | null): string {
  if (!url) return "—";
  try {
    const h = new URL(url).hostname;
    return h.replace(/^(www|api|mpp)\./, "");
  } catch { return url; }
}

function shortAddr(addr: string | null): string {
  if (!addr) return "";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function shortTx(hash: string | null): string {
  if (!hash) return "";
  return hash.slice(0, 10) + "...";
}

/** Decode base64url MPP request to extract amount. */
function decodeAmount(request: string | null): string | null {
  if (!request) return null;
  try {
    let b64 = request.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const json = JSON.parse(atob(b64));
    const atomic = BigInt(json.amount);
    const units = Number(atomic) / 1e6;
    if (units < 0.01) return "<$0.01";
    return "$" + units.toFixed(2);
  } catch { return null; }
}

function statusInfo(status: string): { label: string; cls: string } {
  switch (status) {
    case "succeeded": return { label: "PAID", cls: "tk-paid" };
    case "pending": return { label: "PENDING", cls: "tk-pending" };
    case "failed": return { label: "FAILED", cls: "tk-failed" };
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
        <span className="ticker-col ticker-col-amount">Amount</span>
        <span className="ticker-col ticker-col-desc">Description</span>
        <span className="ticker-col ticker-col-tx">Tx</span>
        <span className="ticker-col ticker-col-time">Age</span>
      </div>
      {payments.map((p, i) => {
        const { label, cls } = statusInfo(p.status);
        const amount = decodeAmount(p.challenge_request);
        const host = shortHost(p.original_url);
        const desc = p.challenge_description || "—";
        const method = p.original_method?.toUpperCase() || "—";
        const tx = p.output_tx_hash ? shortTx(p.output_tx_hash) : "—";

        return (
          <div key={p.id} className="ticker-row" style={{ animationDelay: `${i * 25}ms` }}>
            <span className={`ticker-col ticker-col-status`}>
              <span className={`ticker-badge ${cls}`}>{label}</span>
            </span>
            <span className="ticker-col ticker-col-service">{host}</span>
            <span className="ticker-col ticker-col-method ticker-mono">{method}</span>
            <span className="ticker-col ticker-col-amount ticker-mono">{amount ?? "—"}</span>
            <span className="ticker-col ticker-col-desc ticker-desc-text" title={desc}>{desc}</span>
            <span className="ticker-col ticker-col-tx ticker-mono">{tx}</span>
            <span className="ticker-col ticker-col-time">{timeAgo(p.created_at)}</span>
          </div>
        );
      })}
    </div>
  );
}
