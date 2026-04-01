const RANGES = ["1h", "6h", "24h", "7d"];

export default function TimeRangeSelector({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {RANGES.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={`px-2 py-0.5 text-xs rounded transition-colors ${
            r === value
              ? "bg-theme-500/20 text-theme-700 dark:text-theme-200 font-medium"
              : "text-theme-500 dark:text-theme-400 hover:bg-theme-500/10"
          }`}
        >
          {r}
        </button>
      ))}
    </div>
  );
}
