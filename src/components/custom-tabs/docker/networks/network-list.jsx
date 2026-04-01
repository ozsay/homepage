import { useMemo, useState } from "react";

import NetworkItem from "./network-item";

export default function NetworkList({ networks }) {
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    if (!Array.isArray(networks)) return [];
    if (!filter) return networks;

    const lower = filter.toLowerCase();
    return networks.filter((n) =>
      n.name?.toLowerCase().includes(lower) ||
      n.driver?.toLowerCase().includes(lower),
    );
  }, [networks, filter]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <input
          type="text"
          placeholder="Filter networks..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-1.5 text-sm rounded bg-theme-200/30 dark:bg-white/5 border border-theme-200/50 dark:border-white/10 text-theme-700 dark:text-theme-200 placeholder:text-theme-400 dark:placeholder:text-theme-500 focus:outline-none focus:ring-1 focus:ring-theme-300 dark:focus:ring-white/20 w-64"
        />
      </div>
      <ul className="flex flex-col">
        {filtered.map((n) => (
          <NetworkItem key={n.id} network={n} />
        ))}
      </ul>
    </div>
  );
}
