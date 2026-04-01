export default function LogLine({ line }) {
  return (
    <div className="flex gap-2 leading-5 hover:bg-white/5">
      {line.timestamp && (
        <span className="text-theme-400 dark:text-theme-500 flex-shrink-0 select-none">{line.timestamp}</span>
      )}
      <span className={line.stream === "stderr" ? "text-rose-400" : "text-theme-700 dark:text-theme-200"}>
        {line.content}
      </span>
    </div>
  );
}
