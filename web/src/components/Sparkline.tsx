/** SVG bar-chart sparkline. */
export function Sparkline({
  data,
  width = 160,
  height = 48,
  color = "var(--color-accent)",
  className = "",
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}) {
  if (data.length === 0) return null;
  const max = Math.max(...data, 1);
  const barW = Math.max(1, (width - (data.length - 1)) / data.length);
  const gap = data.length > 1 ? (width - barW * data.length) / (data.length - 1) : 0;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`sparkline ${className}`}
      preserveAspectRatio="none"
    >
      {data.map((v, i) => {
        const barH = Math.max(1, (v / max) * (height - 2));
        const x = i * (barW + gap);
        const y = height - barH;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={barH}
            rx={1}
            fill={color}
            opacity={0.4 + (v / max) * 0.6}
            style={{ animationDelay: `${i * 15}ms` }}
            className="sparkline-bar"
          />
        );
      })}
    </svg>
  );
}

/** Tiny inline sparkline for table rows. */
export function MiniSparkline({ data, color = "var(--color-text-muted)" }: { data: number[]; color?: string }) {
  return <Sparkline data={data} width={72} height={24} color={color} className="mini" />;
}
