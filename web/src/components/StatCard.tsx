import { Sparkline } from "./Sparkline";

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function StatCard({
  label,
  value,
  prefix = "",
  series,
  color,
  delay = 0,
}: {
  label: string;
  value: number;
  prefix?: string;
  series: number[];
  color: string;
  delay?: number;
}) {
  return (
    <div className="stat-card" style={{ animationDelay: `${delay}ms` }}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">
        {prefix && <span className="stat-prefix">{prefix}</span>}
        {formatNum(value)}
      </span>
      <div className="stat-chart">
        <Sparkline data={series} width={200} height={56} color={color} />
      </div>
    </div>
  );
}
