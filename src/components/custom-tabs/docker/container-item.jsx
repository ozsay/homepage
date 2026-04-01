import classNames from "classnames";

const stateColors = {
  running: "bg-emerald-500",
  exited: "bg-amber-500",
  dead: "bg-rose-500",
  removing: "bg-rose-500",
  created: "bg-theme-400",
  paused: "bg-theme-400",
};

export default function ContainerItem({ container, selected, onSelect }) {
  return (
    <li>
      <button
        type="button"
        className={classNames(
          "w-full text-left px-3 py-2 cursor-pointer rounded transition-colors",
          selected ? "bg-theme-300/20 dark:bg-white/10" : "hover:bg-theme-200/20 dark:hover:bg-white/5",
        )}
        onClick={() => onSelect(container)}
      >
        <div className="flex items-center gap-2">
          <span className={classNames("w-2 h-2 rounded-full flex-shrink-0", stateColors[container.state] || "bg-theme-400")} />
          <span className="text-sm font-medium truncate text-theme-700 dark:text-theme-200">{container.name}</span>
        </div>
        <span className="text-xs text-theme-500 dark:text-theme-400 truncate block ml-4">{container.image}</span>
      </button>
    </li>
  );
}
