import classNames from "classnames";
import { useState } from "react";
import { FiPlay, FiSquare, FiXCircle, FiRefreshCw, FiTrash2 } from "react-icons/fi";

import LogViewer from "../log-viewer/log-viewer";
import ContainerInspect from "./container-inspect";
import ContainerStats from "./container-stats";

const TABS = ["Logs", "Inspect", "Stats"];

export default function ContainerDetail({ container, server }) {
  const [activeTab, setActiveTab] = useState("Logs");
  const [loading, setLoading] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState(null);

  async function handleAction(action) {
    if (action === "remove" && !confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    setLoading(action);
    setError(null);
    try {
      const r = await fetch(
        `/api/docker/containers/${encodeURIComponent(container.id)}/action?server=${encodeURIComponent(server)}&action=${action}`,
        { method: "POST" },
      );
      if (!r.ok && r.status !== 204) {
        const data = await r.json();
        throw new Error(data.error?.message || `${action} failed`);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(null);
      setConfirmRemove(false);
    }
  }

  const isRunning = container.state === "running";

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-1 px-3 py-2 border-b border-theme-200/50 dark:border-white/10">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={classNames(
              "px-3 py-1 text-xs rounded-md transition-colors",
              activeTab === tab
                ? "bg-theme-300/20 dark:bg-white/10"
                : "hover:bg-theme-100/20 dark:hover:bg-white/5",
            )}
          >
            {tab}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            disabled={isRunning || !!loading}
            onClick={() => handleAction("start")}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors text-theme-500 dark:text-theme-400 hover:bg-theme-200/20 dark:hover:bg-white/5 disabled:opacity-40"
            title="Start"
          >
            <FiPlay className={loading === "start" ? "animate-pulse" : ""} />
            {loading === "start" ? "Starting..." : "Start"}
          </button>
          <button
            type="button"
            disabled={!isRunning || !!loading}
            onClick={() => handleAction("stop")}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors text-theme-500 dark:text-theme-400 hover:bg-theme-200/20 dark:hover:bg-white/5 disabled:opacity-40"
            title="Stop"
          >
            <FiSquare className={loading === "stop" ? "animate-pulse" : ""} />
            {loading === "stop" ? "Stopping..." : "Stop"}
          </button>
          <button
            type="button"
            disabled={!isRunning || !!loading}
            onClick={() => handleAction("kill")}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors text-theme-500 dark:text-theme-400 hover:bg-theme-200/20 dark:hover:bg-white/5 disabled:opacity-40"
            title="Kill"
          >
            <FiXCircle className={loading === "kill" ? "animate-pulse" : ""} />
            {loading === "kill" ? "Killing..." : "Kill"}
          </button>
          <button
            type="button"
            disabled={!!loading}
            onClick={() => handleAction("restart")}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors text-theme-500 dark:text-theme-400 hover:bg-theme-200/20 dark:hover:bg-white/5 disabled:opacity-40"
            title="Restart"
          >
            <FiRefreshCw className={loading === "restart" ? "animate-spin" : ""} />
            {loading === "restart" ? "Restarting..." : "Restart"}
          </button>
          <button
            type="button"
            disabled={isRunning || !!loading}
            onClick={() => handleAction("remove")}
            className={classNames(
              "flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors disabled:opacity-40",
              confirmRemove
                ? "bg-rose-500/20 text-rose-500"
                : "text-theme-500 dark:text-theme-400 hover:bg-theme-200/20 dark:hover:bg-white/5",
            )}
            title={isRunning ? "Stop container first" : "Remove container"}
          >
            <FiTrash2 />
            {confirmRemove ? "Confirm?" : loading === "remove" ? "Removing..." : "Remove"}
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-1.5 text-xs text-rose-500 bg-rose-500/10">{error}</div>
      )}

      <div className="flex-1 overflow-hidden">
        {activeTab === "Logs" && <LogViewer container={container} server={server} />}
        {activeTab === "Inspect" && <ContainerInspect container={container} server={server} />}
        {activeTab === "Stats" && <ContainerStats container={container} server={server} />}
      </div>
    </div>
  );
}
