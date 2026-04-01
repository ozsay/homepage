import classNames from "classnames";
import { useState } from "react";

import LogViewer from "../log-viewer/log-viewer";
import ContainerInspect from "./container-inspect";
import ContainerStats from "./container-stats";

const TABS = ["Logs", "Inspect", "Stats"];

export default function ContainerDetail({ container, server }) {
  const [activeTab, setActiveTab] = useState("Logs");

  return (
    <div className="border-t border-theme-200/50 dark:border-white/10 mt-1 pt-2">
      <div className="flex gap-1 px-2 mb-2">
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

      <div className="min-h-[16rem]">
        {activeTab === "Logs" && <LogViewer container={container} server={server} />}
        {activeTab === "Inspect" && <ContainerInspect container={container} server={server} />}
        {activeTab === "Stats" && <ContainerStats container={container} server={server} />}
      </div>
    </div>
  );
}
