export function StarRating({ score, max = 5, compact = false }: { score: number | null; max?: number; compact?: boolean }) {
  if (score == null) return <span className="star-rating no-score">{compact ? "--" : "No ratings"}</span>;

  const filled = Math.round(score);

  if (compact) {
    return (
      <span className="star-rating compact" title={`${score.toFixed(1)} / ${max}`}>
        <span className="star filled">{"\u2605"}</span>
        <span className="score-num">{score.toFixed(1)}</span>
      </span>
    );
  }

  return (
    <span className="star-rating" title={`${score.toFixed(1)} / ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < filled ? "star filled" : "star"}>{i < filled ? "\u2605" : "\u2606"}</span>
      ))}
      <span className="score-num">{score.toFixed(1)}</span>
    </span>
  );
}
