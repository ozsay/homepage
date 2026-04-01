import useWidgetWS from "utils/proxy/use-widget-ws";

import UsageBar from "components/widgets/resources/usage-bar";

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
}

function formatUptime(seconds) {
  if (!seconds) return "N/A";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function GaugeCard({ title, children }) {
  return (
    <div className="rounded-md shadow-md bg-theme-100/20 dark:bg-white/5 backdrop-blur p-4">
      <p className="text-xs font-medium uppercase text-theme-500 dark:text-theme-400 mb-2">{title}</p>
      {children}
    </div>
  );
}

export default function RealtimeGauges({ config }) {
  const { data, error } = useWidgetWS("metrics:realtime", "/api/metrics/realtime");

  if (error) {
    return (
      <div className="rounded-md shadow-md bg-theme-100/20 dark:bg-white/5 p-4">
        <p className="text-sm text-rose-500">Failed to load metrics: {typeof error === "string" ? error : error.message || "Unknown error"}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-md shadow-md bg-theme-100/20 dark:bg-white/5 backdrop-blur p-4 h-20 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      <GaugeCard title="CPU">
        <p className="text-2xl font-semibold text-theme-700 dark:text-theme-200">
          {data.cpu.usage.toFixed(1)}%
        </p>
        <UsageBar percent={data.cpu.usage} />
        <p className="text-xs text-theme-500 dark:text-theme-400 mt-1">{data.cpu.cores} cores</p>
      </GaugeCard>

      <GaugeCard title="Memory">
        <p className="text-2xl font-semibold text-theme-700 dark:text-theme-200">
          {data.memory.usagePercent.toFixed(1)}%
        </p>
        <UsageBar percent={data.memory.usagePercent} />
        <p className="text-xs text-theme-500 dark:text-theme-400 mt-1">
          {formatBytes(data.memory.used)} / {formatBytes(data.memory.total)}
        </p>
      </GaugeCard>

      {data.disk.slice(0, 1).map((d) => (
        <GaugeCard key={d.mount} title={`Disk ${d.mount}`}>
          <p className="text-2xl font-semibold text-theme-700 dark:text-theme-200">
            {d.usagePercent.toFixed(1)}%
          </p>
          <UsageBar percent={d.usagePercent} />
          <p className="text-xs text-theme-500 dark:text-theme-400 mt-1">
            {formatBytes(d.used)} / {formatBytes(d.total)}
          </p>
        </GaugeCard>
      ))}

      <GaugeCard title="Temperature">
        <p className="text-2xl font-semibold text-theme-700 dark:text-theme-200">
          {data.temperature.cpu != null ? `${data.temperature.cpu.toFixed(0)}°C` : "N/A"}
        </p>
      </GaugeCard>

      <GaugeCard title="Uptime">
        <p className="text-2xl font-semibold text-theme-700 dark:text-theme-200">
          {formatUptime(data.uptime)}
        </p>
      </GaugeCard>
    </div>
  );
}
