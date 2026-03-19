import type { TimeRange } from "../types";

const RANGES: { value: TimeRange; label: string }[] = [
  { value: "1m", label: "1m" },
  { value: "5m", label: "5m" },
  { value: "1h", label: "1h" },
  { value: "24h", label: "24h" },
  { value: "all", label: "All" },
];

export function TimeRangeToggle({ value, onChange }: { value: TimeRange; onChange: (v: TimeRange) => void }) {
  return (
    <div className="time-range">
      {RANGES.map((r) => (
        <button
          key={r.value}
          className={`time-range-btn ${value === r.value ? "active" : ""}`}
          onClick={() => onChange(r.value)}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
