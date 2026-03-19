export function TagChip({ tag, count }: { tag: string; count?: number }) {
  return (
    <span className="tag-chip">
      {tag}
      {count != null && count > 1 && <span className="tag-count">{count}</span>}
    </span>
  );
}
