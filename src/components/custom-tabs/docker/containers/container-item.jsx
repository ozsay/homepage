import classNames from "classnames";
import { useEffect, useState } from "react";

import ContainerDetail from "./container-detail";

const stateColors = {
  running: "bg-emerald-500/80",
  exited: "bg-orange-400/50 dark:bg-orange-400/80",
  dead: "bg-rose-500/80",
  removing: "bg-rose-500/80",
  created: "bg-theme-400",
  paused: "bg-theme-400",
};

function Block({ label, value }) {
  return (
    <div className="bg-theme-200/50 dark:bg-theme-900/20 rounded-sm m-1 flex-1 flex flex-col items-center justify-center text-center p-1">
      <span className="font-bold text-xs uppercase">{label}</span>
      <span className="font-thin text-sm">{value ?? "-"}</span>
    </div>
  );
}

function formatBytes(bytes) {
  if (bytes == null || Number.isNaN(bytes)) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function calcCpuPercent(stats) {
  if (!stats?.cpu_stats?.cpu_usage || !stats?.precpu_stats?.cpu_usage) return null;
  const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
  const sysDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
  const cpuCount = stats.cpu_stats.online_cpus || stats.cpu_stats.cpu_usage.percpu_usage?.length || 1;
  if (sysDelta > 0 && cpuDelta >= 0) {
    return ((cpuDelta / sysDelta) * cpuCount * 100).toFixed(1);
  }
  return null;
}

function calcMemUsage(stats) {
  if (!stats?.memory_stats?.usage) return null;
  const used = stats.memory_stats.usage - (stats.memory_stats.stats?.cache || 0);
  return formatBytes(used);
}

function calcNetworkRx(stats) {
  if (!stats?.networks) return null;
  const total = Object.values(stats.networks).reduce((sum, n) => sum + (n.rx_bytes || 0), 0);
  return formatBytes(total);
}

function calcNetworkTx(stats) {
  if (!stats?.networks) return null;
  const total = Object.values(stats.networks).reduce((sum, n) => sum + (n.tx_bytes || 0), 0);
  return formatBytes(total);
}

export default function ContainerItem({ container, server, expanded, onToggle }) {
  const [stats, setStats] = useState(null);

  // Fetch stats for running containers
  useEffect(() => {
    if (container.state !== "running") {
      setStats(null);
      return undefined;
    }

    let cancelled = false;

    const fetchStats = () => {
      fetch(`/api/docker/stats/${encodeURIComponent(container.name)}/${encodeURIComponent(server)}`)
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled && data?.stats) setStats(data.stats);
        })
        .catch(() => {});
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [container.name, container.state, server]);

  return (
    <li className="service">
      <div
        className={classNames(
          "transition-all mb-2 p-1 rounded-md font-medium",
          "text-theme-700 dark:text-theme-200 dark:hover:text-theme-300",
          "shadow-md shadow-theme-900/10 dark:shadow-theme-900/20",
          "bg-theme-100/20 hover:bg-theme-300/20 dark:bg-white/5 dark:hover:bg-white/10",
          "relative overflow-clip",
        )}
      >
        {/* Title row */}
        <div className="flex select-none items-center">
          <div className="shrink-0 flex items-center justify-center w-12">
            <span className={classNames("rounded-full h-3 w-3", stateColors[container.state] || "bg-theme-400")} />
          </div>

          <button type="button" onClick={onToggle} className="flex-1 flex items-center justify-between">
            <div className="flex-1 px-2 py-2 text-sm text-left">
              {container.name}
              <p className="text-theme-500 dark:text-theme-300 text-xs font-light">
                {container.image}
              </p>
            </div>
          </button>

          <div className="flex items-center gap-2 mr-2">
            <span className="text-xs text-theme-500 dark:text-theme-400">{container.status}</span>
          </div>
        </div>

        {/* Stats row for running containers */}
        {container.state === "running" && (
          <div className="relative flex flex-row w-full">
            <Block label="CPU" value={stats ? `${calcCpuPercent(stats)}%` : "-"} />
            <Block label="MEM" value={stats ? calcMemUsage(stats) : "-"} />
            <Block label="RX" value={stats ? calcNetworkRx(stats) : "-"} />
            <Block label="TX" value={stats ? calcNetworkTx(stats) : "-"} />
          </div>
        )}

        {/* Expandable detail panel */}
        {expanded && <ContainerDetail container={container} server={server} />}
      </div>
    </li>
  );
}
