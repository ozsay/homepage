import LogViewer from "./log-viewer/log-viewer";

export default function ContainerContent({ container, server }) {
  if (!container) {
    return (
      <div className="flex-1 flex items-center justify-center text-theme-500 dark:text-theme-400">
        Select a container
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col rounded-md bg-theme-100/20 dark:bg-white/5 overflow-hidden relative">
      <div className="px-4 py-2 border-b border-theme-200/50 dark:border-white/10 flex items-center gap-2">
        <span className="font-medium text-theme-700 dark:text-theme-200">{container.name}</span>
        <span className="text-xs text-theme-500 dark:text-theme-400">{container.status}</span>
      </div>
      <LogViewer container={container} server={server} />
    </div>
  );
}
