import classNames from "classnames";
import { useMemo, useState } from "react";

import useWidgetWS from "utils/proxy/use-widget-ws";

import DockerGroup from "../docker-group";
import ContainerDetail from "./container-detail";

const stateColors = {
  running: "bg-emerald-500",
  exited: "bg-amber-500",
  dead: "bg-rose-500",
  removing: "bg-rose-500",
  created: "bg-theme-400",
  paused: "bg-theme-400",
};

export default function ContainersGroup({ icon, server, defaultOpen }) {
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("");

  const topic = `docker:containers:${server}`;
  const fallbackUrl = `/api/docker/containers?server=${encodeURIComponent(server)}`;
  const { data: containers } = useWidgetWS(topic, fallbackUrl);

  const sorted = useMemo(() => {
    if (!Array.isArray(containers)) return [];
    let list = containers;
    if (filter) {
      const lower = filter.toLowerCase();
      list = list.filter(
        (c) => c.name.toLowerCase().includes(lower) || c.image.toLowerCase().includes(lower),
      );
    }
    return [...list].sort((a, b) => {
      if (a.state === "running" && b.state !== "running") return -1;
      if (a.state !== "running" && b.state === "running") return 1;
      return a.name.localeCompare(b.name);
    });
  }, [containers, filter]);

  const count = Array.isArray(containers) ? containers.length : null;

  return (
    <DockerGroup icon={icon} title="Containers" count={count} defaultOpen={defaultOpen}>
      <div className="flex gap-4 h-[28rem]">
        <aside className="w-72 flex-shrink-0 rounded-md bg-theme-100/20 dark:bg-white/5 flex flex-col overflow-hidden">
          <div className="p-2">
            <input
              type="text"
              placeholder="Filter containers..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-sm rounded bg-theme-200/30 dark:bg-white/5 border border-theme-200/50 dark:border-white/10 text-theme-700 dark:text-theme-200 placeholder:text-theme-400 dark:placeholder:text-theme-500 focus:outline-none focus:ring-1 focus:ring-theme-300 dark:focus:ring-white/20"
            />
          </div>
          <ul className="flex-1 overflow-y-auto px-1 pb-1 space-y-0.5">
            {sorted.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={classNames(
                    "w-full text-left px-3 py-2 cursor-pointer rounded transition-colors",
                    selected?.id === c.id
                      ? "bg-theme-300/20 dark:bg-white/10"
                      : "hover:bg-theme-200/20 dark:hover:bg-white/5",
                  )}
                  onClick={() => setSelected(c)}
                >
                  <div className="flex items-center gap-2">
                    <span className={classNames("w-2 h-2 rounded-full flex-shrink-0", stateColors[c.state] || "bg-theme-400")} />
                    <span className="text-sm font-medium truncate text-theme-700 dark:text-theme-200">{c.name}</span>
                  </div>
                  <span className="text-xs text-theme-500 dark:text-theme-400 truncate block ml-4">{c.image}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <div className="flex-1 flex flex-col rounded-md bg-theme-100/20 dark:bg-white/5 overflow-hidden relative">
          {selected ? (
            <>
              <div className="px-4 py-2 border-b border-theme-200/50 dark:border-white/10 flex items-center gap-2">
                <span className={classNames("w-2 h-2 rounded-full flex-shrink-0", stateColors[selected.state] || "bg-theme-400")} />
                <span className="font-medium text-theme-700 dark:text-theme-200">{selected.name}</span>
                <span className="text-xs text-theme-500 dark:text-theme-400">{selected.status}</span>
              </div>
              <ContainerDetail container={selected} server={server} />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-theme-500 dark:text-theme-400 text-sm">
              Select a container
            </div>
          )}
        </div>
      </div>
    </DockerGroup>
  );
}
