import classNames from "classnames";
import { useState } from "react";

import LogViewer from "../log-viewer/log-viewer";
import ContainerInspect from "./container-inspect";
import ContainerStats from "./container-stats";

const TABS = ["Logs", "Inspect", "Stats"];

export default function ContainerDetail({ container, server }) {
  const [activeTab, setActiveTab] = useState("Logs");

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex gap-1 px-3 py-2 border-b border-theme-200/50 dark:border-white/10">
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
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === "Logs" && <LogViewer container={container} server={server} />}
        {activeTab === "Inspect" && <ContainerInspect container={container} server={server} />}
        {activeTab === "Stats" && <ContainerStats container={container} server={server} />}
      </div>
    </div>
  );
}
