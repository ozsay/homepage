import { useEffect, useRef, useState } from "react";

const MAX_POINTS = 60;

function formatBytes(bytes) {
  if (bytes == null || Number.isNaN(bytes)) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function MiniChart({ data, max, color, label, currentValue }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const effectiveMax = max || Math.max(...data, 1);
    const step = width / (MAX_POINTS - 1);

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;

    for (let i = 0; i < data.length; i += 1) {
      const x = i * step;
      const y = height - (data[i] / effectiveMax) * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Fill area under line
    if (data.length > 0) {
      ctx.lineTo((data.length - 1) * step, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fillStyle = `${color}20`;
      ctx.fill();
    }
  }, [data, max, color]);

  return (
    <div className="flex-1 m-1">
      <div className="flex items-baseline justify-between mb-0.5">
        <span className="font-bold text-xs uppercase text-theme-700 dark:text-theme-200">{label}</span>
        <span className="font-thin text-sm text-theme-700 dark:text-theme-200">{currentValue}</span>
      </div>
      <canvas
        ref={canvasRef}
        className="w-full rounded bg-theme-200/30 dark:bg-theme-900/30"
        style={{ height: 60 }}
      />
    </div>
  );
}

function extractStats(raw) {
  if (!raw) return null;

  const cpuDelta = raw.cpu_stats?.cpu_usage?.total_usage - raw.precpu_stats?.cpu_usage?.total_usage;
  const sysDelta = raw.cpu_stats?.system_cpu_usage - raw.precpu_stats?.system_cpu_usage;
  const cpuCount = raw.cpu_stats?.online_cpus || raw.cpu_stats?.cpu_usage?.percpu_usage?.length || 1;
  const cpuPercent = sysDelta > 0 && cpuDelta >= 0 ? (cpuDelta / sysDelta) * cpuCount * 100 : 0;

  const memUsed = (raw.memory_stats?.usage || 0) - (raw.memory_stats?.stats?.cache || 0);
  const memLimit = raw.memory_stats?.limit || 1;

  let rxBytes = 0;
  let txBytes = 0;
  if (raw.networks) {
    for (const n of Object.values(raw.networks)) {
      rxBytes += n.rx_bytes || 0;
      txBytes += n.tx_bytes || 0;
    }
  }

  const blockRead = (raw.blkio_stats?.io_service_bytes_recursive || [])
    .filter((e) => e.op === "read" || e.op === "Read")
    .reduce((sum, e) => sum + e.value, 0);
  const blockWrite = (raw.blkio_stats?.io_service_bytes_recursive || [])
    .filter((e) => e.op === "write" || e.op === "Write")
    .reduce((sum, e) => sum + e.value, 0);

  return { cpuPercent, memUsed, memLimit, rxBytes, txBytes, blockRead, blockWrite };
}

export default function ContainerStats({ container, server }) {
  const [history, setHistory] = useState({
    cpu: [],
    mem: [],
    rx: [],
    tx: [],
  });
  const [current, setCurrent] = useState(null);
  const prevNetRef = useRef({ rx: 0, tx: 0 });

  useEffect(() => {
    if (container.state !== "running") return undefined;

    let cancelled = false;

    const fetchStats = () => {
      fetch(`/api/docker/stats/${encodeURIComponent(container.name)}/${encodeURIComponent(server)}`)
        .then((r) => r.json())
        .then((data) => {
          if (cancelled || !data?.stats) return;

          const s = extractStats(data.stats);
          if (!s) return;

          setCurrent(s);

          // Calculate network rate (delta from previous)
          const rxRate = prevNetRef.current.rx > 0 ? Math.max(0, s.rxBytes - prevNetRef.current.rx) : 0;
          const txRate = prevNetRef.current.tx > 0 ? Math.max(0, s.txBytes - prevNetRef.current.tx) : 0;
          prevNetRef.current = { rx: s.rxBytes, tx: s.txBytes };

          setHistory((prev) => ({
            cpu: [...prev.cpu, s.cpuPercent].slice(-MAX_POINTS),
            mem: [...prev.mem, s.memUsed].slice(-MAX_POINTS),
            rx: [...prev.rx, rxRate].slice(-MAX_POINTS),
            tx: [...prev.tx, txRate].slice(-MAX_POINTS),
          }));
        })
        .catch(() => {});
    };

    fetchStats();
    const interval = setInterval(fetchStats, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [container.name, container.state, server]);

  if (container.state !== "running") {
    return <div className="text-theme-500 dark:text-theme-400 text-xs p-4 text-center">Container is not running</div>;
  }

  return (
    <div className="px-2 py-2">
      <div className="flex flex-wrap">
        <MiniChart
          data={history.cpu}
          max={100}
          color="#10b981"
          label="CPU %"
          currentValue={current ? `${current.cpuPercent.toFixed(1)}%` : "-"}
        />
        <MiniChart
          data={history.mem}
          max={current?.memLimit}
          color="#3b82f6"
          label="Memory"
          currentValue={current ? `${formatBytes(current.memUsed)} / ${formatBytes(current.memLimit)}` : "-"}
        />
      </div>
      <div className="flex flex-wrap">
        <MiniChart
          data={history.rx}
          max={null}
          color="#8b5cf6"
          label="Net RX /s"
          currentValue={current ? `${formatBytes(current.rxBytes)} total` : "-"}
        />
        <MiniChart
          data={history.tx}
          max={null}
          color="#f59e0b"
          label="Net TX /s"
          currentValue={current ? `${formatBytes(current.txBytes)} total` : "-"}
        />
      </div>
    </div>
  );
}
