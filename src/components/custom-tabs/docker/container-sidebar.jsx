import { useMemo, useState } from "react";

import useWidgetWS from "utils/proxy/use-widget-ws";

import ContainerItem from "./container-item";

export default function ContainerSidebar({ server, selected, onSelect }) {
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

    return list.sort((a, b) => {
      // Running containers first
      if (a.state === "running" && b.state !== "running") return -1;
      if (a.state !== "running" && b.state === "running") return 1;
      return a.name.localeCompare(b.name);
    });
  }, [containers, filter]);

  return (
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
          <ContainerItem
            key={c.id}
            container={c}
            selected={selected?.id === c.id}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </aside>
  );
}
