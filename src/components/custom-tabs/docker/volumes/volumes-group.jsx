import classNames from "classnames";
import { useMemo, useState } from "react";
import { FiTrash2 } from "react-icons/fi";

import useWidgetWS from "utils/proxy/use-widget-ws";

import DockerGroup from "../docker-group";

function formatBytes(bytes) {
  if (bytes == null || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function Section({ title, children }) {
  return (
    <div>
      <h4 className="text-xs font-bold uppercase text-theme-700 dark:text-theme-200 mb-1">{title}</h4>
      <div className="text-theme-500 dark:text-theme-300 font-light">{children}</div>
    </div>
  );
}

function KV({ label, value }) {
  return (
    <div className="flex gap-2 py-0.5">
      <span className="font-medium text-theme-600 dark:text-theme-300 min-w-[80px] shrink-0">{label}</span>
      <span className="break-all">{value}</span>
    </div>
  );
}

function VolumeContent({ volume }) {
  if (!volume) {
    return (
      <div className="flex-1 flex items-center justify-center text-theme-500 dark:text-theme-400 text-sm">
        Select a volume
      </div>
    );
  }

  const sizeStr = formatBytes(volume.size);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 py-2 border-b border-theme-200/50 dark:border-white/10">
        <span className="font-medium text-theme-700 dark:text-theme-200 break-all">{volume.name}</span>
      </div>
      <div className="px-4 py-3 space-y-3 text-xs">
        <Section title="General">
          <KV label="Driver" value={volume.driver} />
          <KV label="Mountpoint" value={volume.mountpoint} />
          {volume.created && <KV label="Created" value={new Date(volume.created).toLocaleString()} />}
          {sizeStr && <KV label="Size" value={sizeStr} />}
        </Section>

        <Section title={`Containers (${volume.containers?.length || 0})`}>
          {volume.containers?.length > 0 ? (
            volume.containers.map((name) => (
              <div key={name} className="py-0.5">{name}</div>
            ))
          ) : (
            <div className="text-theme-400 italic">No containers using this volume</div>
          )}
        </Section>
      </div>
    </div>
  );
}

export default function VolumesGroup({ icon, server }) {
  const [selectedName, setSelectedName] = useState(null);
  const [filter, setFilter] = useState("");
  const [pruning, setPruning] = useState(false);
  const [pruneResult, setPruneResult] = useState(null);

  const topic = `docker:volumes:${server}`;
  const fallbackUrl = `/api/docker/volumes?server=${encodeURIComponent(server)}`;
  const { data: volumes, mutate } = useWidgetWS(topic, fallbackUrl);

  const selected = useMemo(
    () => (Array.isArray(volumes) ? volumes.find((v) => v.name === selectedName) : null),
    [volumes, selectedName],
  );

  const filtered = useMemo(() => {
    if (!Array.isArray(volumes)) return [];
    // Always hide unused in the sidebar
    let list = volumes.filter((v) => v.usedBy > 0);
    if (filter) {
      const lower = filter.toLowerCase();
      list = list.filter((v) => v.name?.toLowerCase().includes(lower));
    }
    return list;
  }, [volumes, filter]);

  const count = Array.isArray(volumes) ? volumes.length : null;
  const unusedCount = Array.isArray(volumes) ? volumes.filter((v) => v.usedBy === 0).length : 0;

  async function handlePruneUnused() {
    setPruning(true);
    setPruneResult(null);
    try {
      const r = await fetch(`/api/docker/volumes/prune?server=${encodeURIComponent(server)}`, { method: "POST" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error?.message || "Prune failed");
      setPruneResult(`Removed ${data.deleted} volume${data.deleted !== 1 ? "s" : ""}, reclaimed ${formatBytes(data.spaceReclaimed) || "0 B"}`);
      mutate();
    } catch (e) {
      setPruneResult(e.message);
    } finally {
      setPruning(false);
    }
  }

  return (
    <DockerGroup icon={icon} title="Volumes" count={count}>
      <div className="flex gap-4 h-[28rem]">
        <aside className="w-72 flex-shrink-0 rounded-md bg-theme-100/20 dark:bg-white/5 flex flex-col overflow-hidden">
          <div className="p-2 space-y-1">
            <input
              type="text"
              placeholder="Filter volumes..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-sm rounded bg-theme-200/30 dark:bg-white/5 border border-theme-200/50 dark:border-white/10 text-theme-700 dark:text-theme-200 placeholder:text-theme-400 dark:placeholder:text-theme-500 focus:outline-none focus:ring-1 focus:ring-theme-300 dark:focus:ring-white/20"
            />
            <button
              type="button"
              disabled={pruning || unusedCount === 0}
              onClick={handlePruneUnused}
              className="flex items-center gap-1 w-full px-2 py-1 text-xs rounded text-rose-500 hover:bg-rose-500/10 transition-colors disabled:opacity-40"
            >
              <FiTrash2 className="text-[10px]" />
              {pruning ? "Pruning..." : `Prune ${unusedCount} volume${unusedCount !== 1 ? "s" : ""}`}
            </button>
            {pruneResult && (
              <div className="px-2 text-xs text-theme-500 dark:text-theme-400">{pruneResult}</div>
            )}
          </div>
          <ul className="flex-1 overflow-y-auto px-1 pb-1 space-y-0.5">
            {filtered.map((v) => {
              const short = v.name?.length > 32 ? `${v.name.slice(0, 29)}...` : v.name;
              const sizeStr = formatBytes(v.size);
              return (
                <li key={v.name}>
                  <button
                    type="button"
                    className={classNames(
                      "w-full text-left px-3 py-2 cursor-pointer rounded transition-colors",
                      selectedName === v.name
                        ? "bg-theme-300/20 dark:bg-white/10"
                        : "hover:bg-theme-200/20 dark:hover:bg-white/5",
                    )}
                    onClick={() => setSelectedName(v.name)}
                  >
                    <span className="text-sm font-medium truncate block text-theme-700 dark:text-theme-200" title={v.name}>{short}</span>
                    <span className="text-xs text-theme-500 dark:text-theme-400">
                      {v.driver}
                      {v.usedBy > 0 ? ` \u00b7 ${v.usedBy} in use` : " \u00b7 unused"}
                      {sizeStr ? ` \u00b7 ${sizeStr}` : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
        <div className="flex-1 flex flex-col rounded-md bg-theme-100/20 dark:bg-white/5 overflow-hidden">
          <VolumeContent volume={selected} />
        </div>
      </div>
    </DockerGroup>
  );
}
