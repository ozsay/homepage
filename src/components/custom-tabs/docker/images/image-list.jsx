import { useMemo, useState } from "react";

import ImageItem from "./image-item";

export default function ImageList({ images }) {
  const [filter, setFilter] = useState("");
  const [showDangling, setShowDangling] = useState(false);
  const [sort, setSort] = useState("repository");

  const sorted = useMemo(() => {
    if (!Array.isArray(images)) return [];

    let list = images;

    if (!showDangling) {
      list = list.filter((img) => img.repoTags?.length > 0 && img.repoTags[0] !== "<none>:<none>");
    }

    if (filter) {
      const lower = filter.toLowerCase();
      list = list.filter((img) =>
        img.repoTags?.some((t) => t.toLowerCase().includes(lower)) ||
        img.id?.toLowerCase().includes(lower),
      );
    }

    return [...list].sort((a, b) => {
      if (sort === "size") return (b.size || 0) - (a.size || 0);
      if (sort === "created") return (b.created || 0) - (a.created || 0);
      const aName = a.repoTags?.[0] || a.id;
      const bName = b.repoTags?.[0] || b.id;
      return aName.localeCompare(bName);
    });
  }, [images, filter, showDangling, sort]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <input
          type="text"
          placeholder="Filter images..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-1.5 text-sm rounded bg-theme-200/30 dark:bg-white/5 border border-theme-200/50 dark:border-white/10 text-theme-700 dark:text-theme-200 placeholder:text-theme-400 dark:placeholder:text-theme-500 focus:outline-none focus:ring-1 focus:ring-theme-300 dark:focus:ring-white/20 w-64"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="px-2 py-1.5 text-xs rounded bg-theme-200/30 dark:bg-white/5 border border-theme-200/50 dark:border-white/10 text-theme-700 dark:text-theme-200 focus:outline-none"
        >
          <option value="repository">Repository</option>
          <option value="size">Size</option>
          <option value="created">Created</option>
        </select>
        <label className="flex items-center gap-1 text-xs text-theme-500 dark:text-theme-400 ml-auto cursor-pointer">
          <input
            type="checkbox"
            checked={showDangling}
            onChange={(e) => setShowDangling(e.target.checked)}
            className="rounded"
          />
          Show dangling
        </label>
      </div>
      <ul className="flex flex-col">
        {sorted.map((img) => (
          <ImageItem key={img.id} image={img} />
        ))}
      </ul>
    </div>
  );
}
