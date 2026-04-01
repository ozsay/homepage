import { useMemo, useState } from "react";
import useSWR from "swr";

const QUERY_CPU = "topk(10, rate(namedprocess_namegroup_cpu_seconds_total[5m]) * 100)";
const QUERY_MEM = 'topk(10, namedprocess_namegroup_memory_bytes{memtype="resident"})';

const COLUMNS = [
  { key: "name", label: "Process", align: "left" },
  { key: "cpu", label: "CPU %", align: "right" },
  { key: "memory", label: "Memory", align: "right" },
];

function formatBytes(bytes) {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes.toFixed(0)} B`;
}

export default function ProcessTable() {
  const [sortKey, setSortKey] = useState("cpu");
  const [sortAsc, setSortAsc] = useState(false);

  const cpuKey = `/api/metrics/history?query=${encodeURIComponent(QUERY_CPU)}`;
  const memKey = `/api/metrics/history?query=${encodeURIComponent(QUERY_MEM)}`;

  const { data: cpuData } = useSWR(cpuKey, { refreshInterval: 30000 });
  const { data: memData } = useSWR(memKey, { refreshInterval: 30000 });

  const processes = useMemo(() => {
    const cpuResults = cpuData?.data?.result || [];
    const memResults = memData?.data?.result || [];

    const memMap = new Map();
    for (const r of memResults) {
      const name = r.metric.groupname || r.metric.name || "unknown";
      const val = r.value?.[1];
      if (val) {
        const parsed = parseFloat(val);
        memMap.set(name, Math.max(memMap.get(name) || 0, parsed));
      }
    }

    const procMap = new Map();
    for (const r of cpuResults) {
      const name = r.metric.groupname || r.metric.name || "unknown";
      const val = r.value?.[1];
      if (val) {
        const parsed = parseFloat(val);
        const existing = procMap.get(name);
        if (!existing || parsed > existing.cpu) {
          procMap.set(name, { name, cpu: parsed, memory: memMap.get(name) || 0 });
        }
      }
    }

    return [...procMap.values()];
  }, [cpuData, memData]);

  const sorted = useMemo(() => {
    const dir = sortAsc ? 1 : -1;
    return [...processes].sort((a, b) => {
      if (sortKey === "name") return dir * a.name.localeCompare(b.name);
      return dir * (a[sortKey] - b[sortKey]);
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
      <p className="text-xs font-medium uppercase text-theme-500 dark:text-theme-400 mb-3">
        Top Processes <span className="normal-case font-normal">(5m avg)</span>
      </p>
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
                  key={p.name}
                  className="border-b border-theme-200/10 dark:border-white/5 last:border-0"
                >
                  <td className="py-1.5 text-theme-700 dark:text-theme-200 font-mono text-xs truncate max-w-[200px]" title={p.name}>
                    {p.name}
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
