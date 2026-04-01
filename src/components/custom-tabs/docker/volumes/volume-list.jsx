import { useMemo, useState } from "react";

import VolumeItem from "./volume-item";

export default function VolumeList({ volumes }) {
  const [filter, setFilter] = useState("");
  const [showDangling, setShowDangling] = useState(false);

  const filtered = useMemo(() => {
    if (!Array.isArray(volumes)) return [];

    let list = volumes;

    if (!showDangling) {
      list = list.filter((v) => v.usedBy > 0);
    }

    if (filter) {
      const lower = filter.toLowerCase();
      list = list.filter((v) =>
        v.name?.toLowerCase().includes(lower) ||
        v.driver?.toLowerCase().includes(lower),
      );
    }

    return list;
  }, [volumes, filter, showDangling]);

  const totalCount = Array.isArray(volumes) ? volumes.length : 0;
  const danglingCount = totalCount - (Array.isArray(volumes) ? volumes.filter((v) => v.usedBy > 0).length : 0);

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <input
          type="text"
          placeholder="Filter volumes..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-1.5 text-sm rounded bg-theme-200/30 dark:bg-white/5 border border-theme-200/50 dark:border-white/10 text-theme-700 dark:text-theme-200 placeholder:text-theme-400 dark:placeholder:text-theme-500 focus:outline-none focus:ring-1 focus:ring-theme-300 dark:focus:ring-white/20 w-64"
        />
        <label className="flex items-center gap-1 text-xs text-theme-500 dark:text-theme-400 ml-auto cursor-pointer">
          <input
            type="checkbox"
            checked={showDangling}
            onChange={(e) => setShowDangling(e.target.checked)}
            className="rounded"
          />
          Show unused ({danglingCount})
        </label>
      </div>
      <ul className="flex flex-col">
        {filtered.map((v) => (
          <VolumeItem key={v.name} volume={v} />
        ))}
      </ul>
    </div>
  );
}
