import { getSettings } from "utils/config/config";
import createLogger from "utils/logger";

const logger = createLogger("metrics-realtime");

function parsePrometheusText(text) {
  const lines = text.split("\n");
  const metrics = {};

  for (const line of lines) {
    if (line.startsWith("#") || !line.trim()) continue;

    const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*?)(\{(.+?)\})?\s+(.+?)(\s+\d+)?$/);
    if (!match) continue;

    const [, name, , labelsStr, valueStr] = match;
    const value = parseFloat(valueStr);
    if (Number.isNaN(value)) continue;

    const labels = {};
    if (labelsStr) {
      for (const pair of labelsStr.match(/([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\]|\\.)*)"/g) || []) {
        const eqIdx = pair.indexOf("=");
        labels[pair.slice(0, eqIdx)] = pair.slice(eqIdx + 2, -1).replace(/\\(.)/g, "$1");
      }
    }

    if (!metrics[name]) metrics[name] = [];
    metrics[name].push({ labels, value });
  }

  return metrics;
}

function getMetricValue(metrics, name, filterLabels = {}) {
  const entries = metrics[name];
  if (!entries) return null;

  const match = entries.find((e) =>
    Object.entries(filterLabels).every(([k, v]) => e.labels[k] === v),
  );
  return match ? match.value : null;
}

function getAllMetricValues(metrics, name) {
  return metrics[name] || [];
}

// Store previous CPU snapshot for delta-based usage calculation
let prevCpuSnapshot = null;

function buildCpuData(metrics) {
  const cpuSeconds = getAllMetricValues(metrics, "node_cpu_seconds_total");
  const coreMap = new Map();

  for (const entry of cpuSeconds) {
    const cpu = entry.labels.cpu;
    if (!coreMap.has(cpu)) coreMap.set(cpu, {});
    coreMap.get(cpu)[entry.labels.mode] = entry.value;
  }

  const cores = coreMap.size;
  const currentSnapshot = [...coreMap.entries()].sort((a, b) => a[0] - b[0]);

  let perCore = [];
  let totalUsage = 0;

  if (prevCpuSnapshot && prevCpuSnapshot.length === currentSnapshot.length) {
    // Compute delta between current and previous readings
    let totalIdleDelta = 0;
    let totalAllDelta = 0;

    for (let i = 0; i < currentSnapshot.length; i++) {
      const [, curModes] = currentSnapshot[i];
      const [, prevModes] = prevCpuSnapshot[i];

      const curIdle = curModes.idle || 0;
      const prevIdle = prevModes.idle || 0;
      const curAll = Object.values(curModes).reduce((s, v) => s + v, 0);
      const prevAll = Object.values(prevModes).reduce((s, v) => s + v, 0);

      const idleDelta = curIdle - prevIdle;
      const allDelta = curAll - prevAll;

      totalIdleDelta += idleDelta;
      totalAllDelta += allDelta;
      perCore.push(allDelta > 0 ? Math.round((1 - idleDelta / allDelta) * 1000) / 10 : 0);
    }

    totalUsage = totalAllDelta > 0 ? Math.round((1 - totalIdleDelta / totalAllDelta) * 1000) / 10 : 0;
  } else {
    // First request — fall back to cumulative average
    let totalIdle = 0;
    let totalAll = 0;

    for (const [, modes] of currentSnapshot) {
      const idle = modes.idle || 0;
      const all = Object.values(modes).reduce((s, v) => s + v, 0);
      totalIdle += idle;
      totalAll += all;
      perCore.push(all > 0 ? Math.round((1 - idle / all) * 1000) / 10 : 0);
    }

    totalUsage = totalAll > 0 ? Math.round((1 - totalIdle / totalAll) * 1000) / 10 : 0;
  }

  prevCpuSnapshot = currentSnapshot;

  return {
    usage: totalUsage,
    cores,
    perCore,
  };
}

function buildMemoryData(metrics) {
  const total = getMetricValue(metrics, "node_memory_MemTotal_bytes") || 0;
  const available = getMetricValue(metrics, "node_memory_MemAvailable_bytes") || 0;
  const used = total - available;

  return {
    total,
    available,
    used,
    usagePercent: total > 0 ? Math.round((used / total) * 1000) / 10 : 0,
  };
}

function buildDiskData(metrics) {
  const sizeEntries = getAllMetricValues(metrics, "node_filesystem_size_bytes");
  const availEntries = getAllMetricValues(metrics, "node_filesystem_avail_bytes");

  const disks = [];
  for (const sizeEntry of sizeEntries) {
    const { mountpoint, fstype } = sizeEntry.labels;
    // Skip pseudo/virtual filesystems
    if (["tmpfs", "devtmpfs", "overlay", "squashfs", "nsfs"].includes(fstype)) continue;
    if (sizeEntry.value === 0) continue;

    const avail =
      availEntries.find(
        (e) => e.labels.mountpoint === mountpoint && e.labels.device === sizeEntry.labels.device,
      )?.value || 0;

    disks.push({
      mount: mountpoint,
      total: sizeEntry.value,
      used: sizeEntry.value - avail,
      usagePercent: Math.round(((sizeEntry.value - avail) / sizeEntry.value) * 1000) / 10,
    });
  }

  return disks;
}

function buildNetworkData(metrics) {
  const rxEntries = getAllMetricValues(metrics, "node_network_receive_bytes_total");
  const txEntries = getAllMetricValues(metrics, "node_network_transmit_bytes_total");

  const interfaces = [];
  for (const rx of rxEntries) {
    const { device } = rx.labels;
    if (device === "lo") continue;
    const tx = txEntries.find((e) => e.labels.device === device);
    interfaces.push({
      name: device,
      rxBytes: rx.value,
      txBytes: tx ? tx.value : 0,
    });
  }

  return { interfaces };
}

function buildTemperatureData(metrics) {
  const temps = getAllMetricValues(metrics, "node_hwmon_temp_celsius");
  if (temps.length > 0) {
    // Pick the first sensor or the one labeled as CPU
    const cpuTemp =
      temps.find(
        (t) =>
          (t.labels.chip || "").includes("cpu") ||
          (t.labels.sensor || "").toLowerCase().includes("cpu"),
      ) || temps[0];
    return { cpu: cpuTemp.value };
  }

  // Fallback to thermal zone
  const thermalZones = getAllMetricValues(metrics, "node_thermal_zone_temp");
  if (thermalZones.length > 0) {
    return { cpu: thermalZones[0].value };
  }

  return { cpu: null };
}

export default async function handler(req, res) {
  const settings = getSettings();
  const customTabs = settings?.customTabs || [];
  const hostMetricsTab = customTabs.find((t) => t.type === "hostMetrics");
  const nodeExporterUrl = hostMetricsTab?.options?.nodeExporterUrl;

  if (!nodeExporterUrl) {
    return res.status(400).json({ error: "nodeExporterUrl not configured in hostMetrics tab options" });
  }

  try {
    const response = await fetch(`${nodeExporterUrl}/metrics`);
    if (!response.ok) {
      return res.status(502).json({ error: `node_exporter returned ${response.status}` });
    }

    const text = await response.text();
    const metrics = parsePrometheusText(text);

    const bootTime = getMetricValue(metrics, "node_boot_time_seconds");
    const uptime = bootTime ? Math.floor(Date.now() / 1000 - bootTime) : null;

    return res.status(200).json({
      cpu: buildCpuData(metrics),
      memory: buildMemoryData(metrics),
      disk: buildDiskData(metrics),
      network: buildNetworkData(metrics),
      temperature: buildTemperatureData(metrics),
      uptime,
    });
  } catch (e) {
    logger.error("Failed to fetch node_exporter metrics: %s", e.message);
    return res.status(500).json({ error: e.message });
  }
}
