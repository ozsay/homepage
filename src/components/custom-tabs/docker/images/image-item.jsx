function formatBytes(bytes) {
  if (bytes == null || Number.isNaN(bytes)) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(ts) {
  if (!ts) return "-";
  return new Date(ts * 1000).toLocaleDateString();
}

export default function ImageItem({ image }) {
  const tag = image.repoTags?.[0] || "<none>:<none>";
  const shortId = image.id?.replace("sha256:", "").slice(0, 12);

  return (
    <li className="service">
      <div className="transition-all mb-2 p-1 rounded-md font-medium text-theme-700 dark:text-theme-200 dark:hover:text-theme-300 shadow-md shadow-theme-900/10 dark:shadow-theme-900/20 bg-theme-100/20 hover:bg-theme-300/20 dark:bg-white/5 dark:hover:bg-white/10">
        <div className="flex select-none items-center">
          <div className="shrink-0 flex items-center justify-center w-12">
            <span className="text-lg text-theme-500 dark:text-theme-400">
              {tag.charAt(0).toUpperCase()}
            </span>
          </div>

          <div className="flex-1 px-2 py-2 text-sm text-left">
            {tag}
            <p className="text-theme-500 dark:text-theme-300 text-xs font-light">
              {shortId}
            </p>
          </div>

          <div className="flex items-center gap-3 mr-3">
            <span className="text-xs text-theme-500 dark:text-theme-400">
              {formatBytes(image.size)}
            </span>
            {image.usedBy > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-theme-200/50 dark:bg-theme-900/30 text-theme-600 dark:text-theme-300">
                Used by {image.usedBy}
              </span>
            )}
            <span className="text-xs text-theme-400">{formatDate(image.created)}</span>
          </div>
        </div>
      </div>
    </li>
  );
}
