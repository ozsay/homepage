import classNames from "classnames";
import { useMemo, useState } from "react";

import useWidgetWS from "utils/proxy/use-widget-ws";

import DockerGroup from "../docker-group";

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
          <KV label="Used by" value={`${volume.usedBy} container${volume.usedBy !== 1 ? "s" : ""}`} />
        </Section>
      </div>
    </div>
  );
}

export default function VolumesGroup({ icon, server }) {
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("");
  const [showUnused, setShowUnused] = useState(false);

  const topic = `docker:volumes:${server}`;
  const fallbackUrl = `/api/docker/volumes?server=${encodeURIComponent(server)}`;
  const { data: volumes } = useWidgetWS(topic, fallbackUrl);

  const filtered = useMemo(() => {
    if (!Array.isArray(volumes)) return [];
    let list = volumes;
    if (!showUnused) {
      list = list.filter((v) => v.usedBy > 0);
    }
    if (filter) {
      const lower = filter.toLowerCase();
      list = list.filter((v) => v.name?.toLowerCase().includes(lower));
    }
    return list;
  }, [volumes, filter, showUnused]);

  const count = Array.isArray(volumes) ? volumes.length : null;
  const unusedCount = Array.isArray(volumes) ? volumes.filter((v) => v.usedBy === 0).length : 0;

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
            <label className="flex items-center gap-1 text-xs text-theme-500 dark:text-theme-400 px-1 cursor-pointer">
              <input type="checkbox" checked={showUnused} onChange={(e) => setShowUnused(e.target.checked)} className="rounded" />
              Show unused ({unusedCount})
            </label>
          </div>
          <ul className="flex-1 overflow-y-auto px-1 pb-1 space-y-0.5">
            {filtered.map((v) => {
              const short = v.name?.length > 32 ? `${v.name.slice(0, 29)}...` : v.name;
              return (
                <li key={v.name}>
                  <button
                    type="button"
                    className={classNames(
                      "w-full text-left px-3 py-2 cursor-pointer rounded transition-colors",
                      selected?.name === v.name
                        ? "bg-theme-300/20 dark:bg-white/10"
                        : "hover:bg-theme-200/20 dark:hover:bg-white/5",
                    )}
                    onClick={() => setSelected(v)}
                  >
                    <span className="text-sm font-medium truncate block text-theme-700 dark:text-theme-200" title={v.name}>{short}</span>
                    <span className="text-xs text-theme-500 dark:text-theme-400">
                      {v.driver}{v.usedBy > 0 ? ` \u00b7 ${v.usedBy} in use` : " \u00b7 unused"}
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
