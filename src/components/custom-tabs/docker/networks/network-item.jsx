import { useState } from "react";

export default function NetworkItem({ network }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="service">
      <div className="transition-all mb-2 p-1 rounded-md font-medium text-theme-700 dark:text-theme-200 dark:hover:text-theme-300 shadow-md shadow-theme-900/10 dark:shadow-theme-900/20 bg-theme-100/20 hover:bg-theme-300/20 dark:bg-white/5 dark:hover:bg-white/10">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex w-full select-none items-center"
        >
          <div className="shrink-0 flex items-center justify-center w-12">
            <span className="text-lg text-theme-500 dark:text-theme-400">N</span>
          </div>

          <div className="flex-1 px-2 py-2 text-sm text-left">
            {network.name}
            <p className="text-theme-500 dark:text-theme-300 text-xs font-light">
              {network.driver} &middot; {network.scope}
            </p>
          </div>

          <div className="flex items-center gap-3 mr-3">
            {network.subnet && (
              <span className="text-xs text-theme-500 dark:text-theme-400">{network.subnet}</span>
            )}
            <span className="text-xs px-1.5 py-0.5 rounded bg-theme-200/50 dark:bg-theme-900/30 text-theme-600 dark:text-theme-300">
              {network.containerCount} container{network.containerCount !== 1 ? "s" : ""}
            </span>
          </div>
        </button>

        {expanded && network.containers?.length > 0 && (
          <div className="border-t border-theme-200/50 dark:border-white/10 mt-1 pt-2 px-3 pb-2">
            <h4 className="text-xs font-bold uppercase text-theme-700 dark:text-theme-200 mb-1">Connected Containers</h4>
            <div className="text-xs text-theme-500 dark:text-theme-300 font-light space-y-0.5">
              {network.containers.map((c) => (
                <div key={c.id} className="flex gap-2">
                  <span className="font-medium text-theme-600 dark:text-theme-300">{c.name}</span>
                  <span>{c.ip}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
