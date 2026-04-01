import { useMemo, useState } from "react";

import ContainerItem from "./container-item";

export default function ContainerList({ containers, server }) {
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState("name");
  const [expandedId, setExpandedId] = useState(null);

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
      if (sort === "status") {
        if (a.state === "running" && b.state !== "running") return -1;
        if (a.state !== "running" && b.state === "running") return 1;
        return a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });
  }, [containers, filter, sort]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <input
          type="text"
          placeholder="Filter by name or image..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-1.5 text-sm rounded bg-theme-200/30 dark:bg-white/5 border border-theme-200/50 dark:border-white/10 text-theme-700 dark:text-theme-200 placeholder:text-theme-400 dark:placeholder:text-theme-500 focus:outline-none focus:ring-1 focus:ring-theme-300 dark:focus:ring-white/20 w-64"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="px-2 py-1.5 text-xs rounded bg-theme-200/30 dark:bg-white/5 border border-theme-200/50 dark:border-white/10 text-theme-700 dark:text-theme-200 focus:outline-none"
        >
          <option value="name">Name</option>
          <option value="status">Status</option>
        </select>
      </div>
      <ul className="flex flex-col">
        {sorted.map((c) => (
          <ContainerItem
            key={c.id}
            container={c}
            server={server}
            expanded={expandedId === c.id}
            onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
          />
        ))}
      </ul>
    </div>
  );
}
