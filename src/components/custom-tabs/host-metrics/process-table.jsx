import useSWR from "swr";

const QUERY_CPU = "topk(10, rate(namedprocess_namegroup_cpu_seconds_total[5m]) * 100)";
const QUERY_MEM = "topk(10, namedprocess_namegroup_memory_bytes{memtype=\"resident\"})";

function formatBytes(bytes) {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes.toFixed(0)} B`;
}

export default function ProcessTable() {
  const now = Math.floor(Date.now() / 1000);
  const cpuParams = new URLSearchParams({
    query: QUERY_CPU,
    start: (now - 60).toString(),
    end: now.toString(),
    step: "60",
  });
  const memParams = new URLSearchParams({
    query: QUERY_MEM,
    start: (now - 60).toString(),
    end: now.toString(),
    step: "60",
  });

  const { data: cpuData } = useSWR(`/api/metrics/history?${cpuParams}`, { refreshInterval: 30000 });
  const { data: memData } = useSWR(`/api/metrics/history?${memParams}`, { refreshInterval: 30000 });

  const processes = [];
  const cpuResults = cpuData?.data?.result || [];
  const memResults = memData?.data?.result || [];

  const memMap = new Map();
  for (const r of memResults) {
    const name = r.metric.groupname || r.metric.name || "unknown";
    const lastVal = r.values?.[r.values.length - 1]?.[1];
    if (lastVal) memMap.set(name, parseFloat(lastVal));
  }

  for (const r of cpuResults) {
    const name = r.metric.groupname || r.metric.name || "unknown";
    const lastVal = r.values?.[r.values.length - 1]?.[1];
    if (lastVal) {
      processes.push({
        name,
        cpu: parseFloat(lastVal),
        memory: memMap.get(name) || 0,
      });
    }
  }

  processes.sort((a, b) => b.cpu - a.cpu);

  const hasData = processes.length > 0;

  return (
    <div className="rounded-md shadow-md bg-theme-100/20 dark:bg-white/5 backdrop-blur p-4">
      <p className="text-xs font-medium uppercase text-theme-500 dark:text-theme-400 mb-3">
        Top Processes
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
                <th className="pb-2 font-medium">Process</th>
                <th className="pb-2 font-medium text-right">CPU %</th>
                <th className="pb-2 font-medium text-right">Memory</th>
              </tr>
            </thead>
            <tbody>
              {processes.slice(0, 10).map((p) => (
                <tr
                  key={p.name}
                  className="border-b border-theme-200/10 dark:border-white/5 last:border-0"
                >
                  <td className="py-1.5 text-theme-700 dark:text-theme-200 font-mono text-xs">
                    {p.name}
                  </td>
                  <td className="py-1.5 text-right text-theme-700 dark:text-theme-200 text-xs">
                    {p.cpu.toFixed(1)}%
                  </td>
                  <td className="py-1.5 text-right text-theme-700 dark:text-theme-200 text-xs">
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
