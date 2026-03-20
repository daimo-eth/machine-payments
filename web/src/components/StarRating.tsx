export function StarRating({ score, max = 5, compact = false }: { score: number | string | null; max?: number; compact?: boolean }) {
  if (score == null) return <span className="star-rating no-score">{compact ? "--" : "No ratings"}</span>;

  const n = typeof score === "string" ? parseFloat(score) : score;
  if (isNaN(n)) return <span className="star-rating no-score">{compact ? "--" : "No ratings"}</span>;

  const filled = Math.round(n);

  if (compact) {
    return (
      <span className="star-rating compact" title={`${n.toFixed(1)} / ${max}`}>
        <span className="star filled">{"\u2605"}</span>
        <span className="score-num">{n.toFixed(1)}</span>
      </span>
    );
  }

  return (
    <span className="star-rating" title={`${n.toFixed(1)} / ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < filled ? "star filled" : "star"}>{i < filled ? "\u2605" : "\u2606"}</span>
      ))}
      <span className="score-num">{n.toFixed(1)}</span>
    </span>
  );
}
