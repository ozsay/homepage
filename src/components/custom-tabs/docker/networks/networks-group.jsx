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
      <span>{value}</span>
    </div>
  );
}

function NetworkContent({ network }) {
  if (!network) {
    return (
      <div className="flex-1 flex items-center justify-center text-theme-500 dark:text-theme-400 text-sm">
        Select a network
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 py-2 border-b border-theme-200/50 dark:border-white/10">
        <span className="font-medium text-theme-700 dark:text-theme-200">{network.name}</span>
      </div>
      <div className="px-4 py-3 space-y-3 text-xs">
        <Section title="General">
          <KV label="ID" value={network.id?.slice(0, 12)} />
          <KV label="Driver" value={network.driver} />
          <KV label="Scope" value={network.scope} />
          {network.subnet && <KV label="Subnet" value={network.subnet} />}
          {network.gateway && <KV label="Gateway" value={network.gateway} />}
        </Section>
        <Section title={`Containers (${network.containers?.length || 0})`}>
          {network.containers?.length > 0 ? (
            network.containers.map((c) => (
              <div key={c.id} className="flex gap-2 py-0.5">
                <span className="font-medium text-theme-600 dark:text-theme-300">{c.name}</span>
                <span>{c.ip}</span>
              </div>
            ))
          ) : (
            <div className="text-theme-400 italic">No containers connected</div>
          )}
        </Section>
      </div>
    </div>
  );
}

export default function NetworksGroup({ icon, server }) {
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState("");

  const topic = `docker:networks:${server}`;
  const fallbackUrl = `/api/docker/networks?server=${encodeURIComponent(server)}`;
  const { data: networks } = useWidgetWS(topic, fallbackUrl);

  // Resolve selected from current data so it stays fresh on poll updates
  const selected = useMemo(
    () => (Array.isArray(networks) ? networks.find((n) => n.id === selectedId) : null),
    [networks, selectedId],
  );

  const filtered = useMemo(() => {
    if (!Array.isArray(networks)) return [];
    if (!filter) return networks;
    const lower = filter.toLowerCase();
    return networks.filter((n) =>
      n.name?.toLowerCase().includes(lower) || n.driver?.toLowerCase().includes(lower),
    );
  }, [networks, filter]);

  const count = Array.isArray(networks) ? networks.length : null;

  return (
    <DockerGroup icon={icon} title="Networks" count={count}>
      <div className="flex gap-4 h-[28rem]">
        <aside className="w-72 flex-shrink-0 rounded-md bg-theme-100/20 dark:bg-white/5 flex flex-col overflow-hidden">
          <div className="p-2">
            <input
              type="text"
              placeholder="Filter networks..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-sm rounded bg-theme-200/30 dark:bg-white/5 border border-theme-200/50 dark:border-white/10 text-theme-700 dark:text-theme-200 placeholder:text-theme-400 dark:placeholder:text-theme-500 focus:outline-none focus:ring-1 focus:ring-theme-300 dark:focus:ring-white/20"
            />
          </div>
          <ul className="flex-1 overflow-y-auto px-1 pb-1 space-y-0.5">
            {filtered.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className={classNames(
                    "w-full text-left px-3 py-2 cursor-pointer rounded transition-colors",
                    selectedId === n.id
                      ? "bg-theme-300/20 dark:bg-white/10"
                      : "hover:bg-theme-200/20 dark:hover:bg-white/5",
                  )}
                  onClick={() => setSelectedId(n.id)}
                >
                  <span className="text-sm font-medium truncate block text-theme-700 dark:text-theme-200">{n.name}</span>
                  <span className="text-xs text-theme-500 dark:text-theme-400">
                    {n.driver} &middot; {n.containerCount} container{n.containerCount !== 1 ? "s" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <div className="flex-1 flex flex-col rounded-md bg-theme-100/20 dark:bg-white/5 overflow-hidden">
          <NetworkContent network={selected} />
        </div>
      </div>
    </DockerGroup>
  );
}
