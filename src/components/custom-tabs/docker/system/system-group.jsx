import { useEffect, useState } from "react";

import DockerGroup from "../docker-group";

function formatBytes(bytes) {
  if (bytes == null) return "-";
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function InfoTable({ title, rows }) {
  return (
    <div className="rounded-md bg-theme-100/20 dark:bg-white/5 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-theme-200/50 dark:border-white/10 flex items-center gap-2">
        <span className="font-medium text-theme-700 dark:text-theme-200">{title}</span>
      </div>
      <div className="divide-y divide-theme-200/30 dark:divide-white/5">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex px-4 py-2.5 text-sm">
            <span className="w-1/3 text-theme-500 dark:text-theme-400">{label}</span>
            <span className="w-2/3 text-theme-700 dark:text-theme-200">{value || "-"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SystemGroup({ icon, server }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/docker/system?server=${encodeURIComponent(server)}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [server]);

  return (
    <DockerGroup icon={icon} title="System">
      {loading && (
        <div className="text-theme-500 dark:text-theme-400 text-sm text-center py-8">Loading...</div>
      )}
      {!loading && !data && (
        <div className="text-theme-500 dark:text-theme-400 text-sm text-center py-8">Failed to load system info</div>
      )}
      {!loading && data && (
        <div className="space-y-4">
          <InfoTable
            title="Host Details"
            rows={[
              { label: "Hostname", value: data.host?.hostname },
              { label: "OS Information", value: `${data.host?.architecture} ${data.host?.os}` },
              { label: "Kernel Version", value: data.host?.kernelVersion },
              { label: "Total CPU", value: data.host?.totalCpu },
              { label: "Total Memory", value: formatBytes(data.host?.totalMemory) },
            ]}
          />
          <InfoTable
            title="Engine Details"
            rows={[
              { label: "Version", value: data.engine ? `${data.engine.version} (API: ${data.engine.apiVersion})` : null },
              { label: "Root Directory", value: data.engine?.rootDir },
              { label: "Storage Driver", value: data.engine?.storageDriver },
              { label: "Logging Driver", value: data.engine?.loggingDriver },
              { label: "Volume Plugins", value: data.engine?.volumePlugins?.join(", ") },
              { label: "Network Plugins", value: data.engine?.networkPlugins?.join(", ") },
            ]}
          />
        </div>
      )}
    </DockerGroup>
  );
}
