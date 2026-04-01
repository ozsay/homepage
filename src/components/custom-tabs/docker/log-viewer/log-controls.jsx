import classNames from "classnames";

const tailOptions = [100, 500, 1000];

export default function LogControls({ autoScroll, setAutoScroll, onClear, search, setSearch, tail, setTail }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-theme-200/50 dark:border-white/10 bg-theme-100/10 dark:bg-white/[0.02]">
      <input
        type="text"
        placeholder="Search logs..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="px-2 py-1 text-xs rounded bg-theme-200/30 dark:bg-white/5 border border-theme-200/50 dark:border-white/10 text-theme-700 dark:text-theme-200 placeholder:text-theme-400 dark:placeholder:text-theme-500 focus:outline-none focus:ring-1 focus:ring-theme-300 dark:focus:ring-white/20 w-48"
      />
      <div className="flex items-center gap-1">
        {tailOptions.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setTail(n)}
            className={classNames(
              "px-2 py-0.5 text-xs rounded transition-colors",
              tail === n
                ? "bg-theme-300/30 dark:bg-white/15 text-theme-700 dark:text-theme-200"
                : "text-theme-500 dark:text-theme-400 hover:bg-theme-200/20 dark:hover:bg-white/5",
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex-1" />
      <button
        type="button"
        onClick={() => setAutoScroll(!autoScroll)}
        className={classNames(
          "px-2 py-0.5 text-xs rounded transition-colors",
          autoScroll
            ? "bg-theme-300/30 dark:bg-white/15 text-theme-700 dark:text-theme-200"
            : "text-theme-500 dark:text-theme-400 hover:bg-theme-200/20 dark:hover:bg-white/5",
        )}
      >
        Auto-scroll
      </button>
      <button
        type="button"
        onClick={onClear}
        className="px-2 py-0.5 text-xs rounded text-theme-500 dark:text-theme-400 hover:bg-theme-200/20 dark:hover:bg-white/5 transition-colors"
      >
        Clear
      </button>
    </div>
  );
}
