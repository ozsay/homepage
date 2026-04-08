import { useMemo, useState } from "react";
import useSWR from "swr";

const MODES = {
  live: {
    label: "Live",
    cpu: "topk(10, rate(namedprocess_namegroup_cpu_seconds_total[1m]) * 100)",
    mem: 'namedprocess_namegroup_memory_bytes{memtype="resident"}',
    refresh: 10000,
  },
  "1h": {
    label: "1h",
    cpu: "topk(10, rate(namedprocess_namegroup_cpu_seconds_total[1h]) * 100)",
    mem: 'avg_over_time(namedprocess_namegroup_memory_bytes{memtype="resident"}[1h])',
    refresh: 60000,
  },
  "12h": {
    label: "12h",
    cpu: "topk(10, rate(namedprocess_namegroup_cpu_seconds_total[12h]) * 100)",
    mem: 'avg_over_time(namedprocess_namegroup_memory_bytes{memtype="resident"}[12h])',
    refresh: 120000,
  },
  "24h": {
    label: "24h",
    cpu: "topk(10, rate(namedprocess_namegroup_cpu_seconds_total[24h]) * 100)",
    mem: 'avg_over_time(namedprocess_namegroup_memory_bytes{memtype="resident"}[24h])',
    refresh: 300000,
  },
};

const COLUMNS = [
  { key: "name", label: "Process", align: "left" },
  { key: "container", label: "Container", align: "left" },
  { key: "pid", label: "PID", align: "right" },
  { key: "cpu", label: "CPU %", align: "right" },
  { key: "memory", label: "Memory", align: "right" },
];

const TYPE_PRIORITY = { proc: 0, name: 1, compose: 2, image: 3, script: 4, binary: 5 };

const DOCKER_CGROUP_RE = /docker[/-]([a-f0-9]{64})/;

function parseGroupname(raw) {
  const pipeIdx = raw.indexOf("|");
  if (pipeIdx < 0) {
    // No cgroup info — legacy format
    return { display: raw.replace(/\s*\(.*\)\s*$/, "").trim(), containerId: null };
  }
  const display = raw.substring(0, pipeIdx).replace(/\s*\(.*\)\s*$/, "").trim();
  const cgroupPart = raw.substring(pipeIdx + 1);
  const match = DOCKER_CGROUP_RE.exec(cgroupPart);
  return { display, containerId: match?.[1] || null };
}

function pickBest(entries, pn) {
  if (entries.length === 1) return entries[0];

  // Prefer higher-confidence key types
  const sorted = [...entries].sort(
    (a, b) => (TYPE_PRIORITY[a.type] ?? 9) - (TYPE_PRIORITY[b.type] ?? 9),
  );
  if ((TYPE_PRIORITY[sorted[0].type] ?? 9) < (TYPE_PRIORITY[sorted[1].type] ?? 9)) {
    return sorted[0];
  }

  // Among same-type entries, prefer container name that relates to process name
  const nameMatch = entries.find((e) => {
    const cn = e.container.toLowerCase();
    return cn.includes(pn) || pn.includes(cn);
  });
  if (nameMatch) return nameMatch;

  // For proc entries (cgroup-authoritative), combine all containers
  if (sorted[0].type === "proc") {
    const procEntries = entries.filter((e) => e.type === "proc");
    const unique = [...new Set(procEntries.map((e) => e.container))];
    if (unique.length === 1) return procEntries[0];
    return { container: unique.join(", "), pid: null, type: "proc" };
  }

  // For heuristic entries, return null to avoid guessing
  return null;
}

function resolveContainer(displayName, containerId, cMap) {
  // Direct cgroup match — authoritative, from process-exporter {{.Cgroups}}
  if (containerId && cMap._containerIds) {
    const name = cMap._containerIds[containerId];
    if (name) return { container: name, pid: null, type: "cgroup" };
  }

  // Fall back to name-based lookup via /proc or docker-top map
  const pn = displayName.toLowerCase();
  const entries = cMap[pn];
  if (entries?.length) return pickBest(entries, pn);
  return null;
}

function formatBytes(bytes) {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes.toFixed(0)} B`;
}

export default function ProcessTable() {
  const [mode, setMode] = useState("live");
  const [sortKey, setSortKey] = useState("cpu");
  const [sortAsc, setSortAsc] = useState(false);

  const cfg = MODES[mode];
  const cpuKey = `/api/metrics/history?query=${encodeURIComponent(cfg.cpu)}`;
  const memKey = `/api/metrics/history?query=${encodeURIComponent(cfg.mem)}`;

  const { data: cpuData } = useSWR(cpuKey, { refreshInterval: cfg.refresh });
  const { data: memData } = useSWR(memKey, { refreshInterval: cfg.refresh });
  const { data: containerMap } = useSWR("/api/docker/process-map", { refreshInterval: 60000 });

  const processes = useMemo(() => {
    const cpuResults = cpuData?.data?.result || [];
    const memResults = memData?.data?.result || [];
    const cMap = containerMap || {};

    const memMap = new Map();
    for (const r of memResults) {
      const raw = r.metric.groupname || r.metric.name || "unknown";
      const { display } = parseGroupname(raw);
      const val = r.value?.[1];
      if (val) {
        const parsed = parseFloat(val);
        // Use raw key so each container's memory is tracked separately
        memMap.set(raw, Math.max(memMap.get(raw) || 0, parsed));
      }
    }

    const procMap = new Map();
    for (const r of cpuResults) {
      const raw = r.metric.groupname || r.metric.name || "unknown";
      const { display, containerId } = parseGroupname(raw);
      const val = r.value?.[1];
      if (val) {
        const parsed = parseFloat(val);
        // Use raw key to keep per-container entries separate
        const existing = procMap.get(raw);
        if (!existing || parsed > existing.cpu) {
          const metricContainer =
            r.metric.container_name || r.metric.container || null;
          const match = metricContainer ? null : resolveContainer(display, containerId, cMap);
          procMap.set(raw, {
            key: raw,
            name: display,
            cpu: parsed,
            memory: memMap.get(raw) || 0,
            container: metricContainer || match?.container || null,
            pid: match?.pid || null,
          });
        }
      }
    }

    return [...procMap.values()];
  }, [cpuData, memData, containerMap]);

  const sorted = useMemo(() => {
    const dir = sortAsc ? 1 : -1;
    return [...processes].sort((a, b) => {
      if (sortKey === "name" || sortKey === "container") {
        return dir * (a[sortKey] || "").localeCompare(b[sortKey] || "");
      }
      return dir * ((parseFloat(a[sortKey]) || 0) - (parseFloat(b[sortKey]) || 0));
    });
  }, [processes, sortKey, sortAsc]);

  function handleSort(key) {
    if (key === sortKey) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === "name");
    }
  }

  const hasData = sorted.length > 0;

  return (
    <div className="rounded-md shadow-md bg-theme-100/20 dark:bg-white/5 backdrop-blur p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium uppercase text-theme-500 dark:text-theme-400">
          Top Processes
        </p>
        <div className="flex gap-1">
          {Object.entries(MODES).map(([key, m]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                mode === key
                  ? "bg-theme-500/20 text-theme-300"
                  : "text-theme-500 dark:text-theme-500 hover:text-theme-300"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      {!hasData ? (
        <p className="text-xs text-theme-500 dark:text-theme-400">
          No process data available. Requires{" "}
          <span className="font-mono">process-exporter</span> or{" "}
          <span className="font-mono">namedprocess</span> collector.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-xs text-theme-500 dark:text-theme-400 border-b border-theme-200/20 dark:border-white/10">
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={`pb-2 font-medium cursor-pointer select-none hover:text-theme-300 transition-colors ${col.align === "right" ? "text-right" : ""}`}
                    onClick={() => handleSort(col.key)}
                  >
                    {col.label}
                    {sortKey === col.key && (
                      <span className="ml-1">{sortAsc ? "\u25b2" : "\u25bc"}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 10).map((p) => (
                <tr
                  key={p.key || p.name}
                  className="border-b border-theme-200/10 dark:border-white/5 last:border-0"
                >
                  <td className="py-1.5 text-theme-700 dark:text-theme-200 font-mono text-xs truncate max-w-[200px]" title={p.name}>
                    {p.name}
                  </td>
                  <td className="py-1.5 text-theme-700 dark:text-theme-200 font-mono text-xs truncate max-w-[160px]" title={p.container || ""}>
                    {p.container ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="text-blue-400">&#x2B22;</span>
                        {p.container}
                      </span>
                    ) : (
                      <span className="text-theme-500 dark:text-theme-600">&mdash;</span>
                    )}
                  </td>
                  <td className="py-1.5 text-right text-theme-700 dark:text-theme-200 font-mono text-xs whitespace-nowrap">
                    {p.pid ? p.pid : <span className="text-theme-500 dark:text-theme-600">&mdash;</span>}
                  </td>
                  <td className="py-1.5 text-right text-theme-700 dark:text-theme-200 text-xs whitespace-nowrap">
                    {p.cpu.toFixed(1)}%
                  </td>
                  <td className="py-1.5 text-right text-theme-700 dark:text-theme-200 text-xs whitespace-nowrap">
                    {formatBytes(p.memory)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
