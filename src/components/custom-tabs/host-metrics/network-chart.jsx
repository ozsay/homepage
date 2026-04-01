import { useMemo } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import useSWR from "swr";

import ChartCard from "./chart-card";

const RANGE_SECONDS = { "1h": 3600, "6h": 21600, "24h": 86400, "7d": 604800 };
const STEP_SECONDS = { "1h": 15, "6h": 60, "24h": 300, "7d": 1800 };

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatRate(bytes) {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB/s`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB/s`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB/s`;
  return `${bytes.toFixed(0)} B/s`;
}

function ChartContent({ range }) {
  const now = Math.floor(Date.now() / 1000);
  const start = now - (RANGE_SECONDS[range] || 3600);
  const step = STEP_SECONDS[range] || 15;

  const rxParams = new URLSearchParams({
    query: 'sum(rate(node_network_receive_bytes_total{device!="lo"}[5m]))',
    start: start.toString(),
    end: now.toString(),
    step: step.toString(),
  });
  const txParams = new URLSearchParams({
    query: 'sum(rate(node_network_transmit_bytes_total{device!="lo"}[5m]))',
    start: start.toString(),
    end: now.toString(),
    step: step.toString(),
  });

  const { data: rxData } = useSWR(`/api/metrics/history?${rxParams}`, { refreshInterval: 30000 });
  const { data: txData } = useSWR(`/api/metrics/history?${txParams}`, { refreshInterval: 30000 });

  const chartData = useMemo(() => {
    const rxValues = rxData?.data?.result?.[0]?.values || [];
    const txValues = txData?.data?.result?.[0]?.values || [];

    if (rxValues.length === 0 && txValues.length === 0) return [];

    const timeMap = new Map();
    for (const [ts, val] of rxValues) {
      timeMap.set(ts, { time: ts * 1000, rx: parseFloat(val), tx: 0 });
    }
    for (const [ts, val] of txValues) {
      const entry = timeMap.get(ts) || { time: ts * 1000, rx: 0, tx: 0 };
      entry.tx = parseFloat(val);
      timeMap.set(ts, entry);
    }

    return [...timeMap.values()].sort((a, b) => a.time - b.time);
  }, [rxData, txData]);

  const isLoading = !rxData && !txData;

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded bg-theme-500/5" />;
  }

  if (chartData.length === 0) {
    return <div className="h-48 flex items-center justify-center text-xs text-theme-500">No data available</div>;
  }

  return (
    <div className="h-48 flex flex-col">
      <ResponsiveContainer width="100%" height="100%" className="flex-1 min-h-0">
        <LineChart data={chartData}>
          <XAxis
            dataKey="time"
            tickFormatter={formatTime}
            tick={{ fontSize: 10, fill: "rgb(var(--color-400))" }}
            axisLine={false}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "rgb(var(--color-400))" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={formatRate}
            width={60}
          />
          <Tooltip
            labelFormatter={(ts) => new Date(ts).toLocaleString()}
            formatter={(v, name) => [formatRate(v), name === "rx" ? "Receive" : "Transmit"]}
            contentStyle={{
              backgroundColor: "rgb(var(--color-800))",
              color: "rgb(var(--color-100))",
              border: "none",
              borderRadius: "0.375rem",
              fontSize: "0.75rem",
            }}
          />
          <Line
            type="monotoneX"
            dataKey="rx"
            stroke="rgb(var(--color-500))"
            dot={false}
            isAnimationActive={false}
            strokeWidth={1.5}
          />
          <Line
            type="monotoneX"
            dataKey="tx"
            stroke="rgb(var(--color-700))"
            dot={false}
            isAnimationActive={false}
            strokeWidth={1.5}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-4 mt-1">
        <span className="flex items-center gap-1 text-xs text-theme-500 dark:text-theme-400">
          <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: "rgb(var(--color-500))" }} />
          RX
        </span>
        <span className="flex items-center gap-1 text-xs text-theme-500 dark:text-theme-400">
          <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: "rgb(var(--color-700))" }} />
          TX
        </span>
      </div>
    </div>
  );
}

export default function NetworkChart() {
  return (
    <ChartCard title="Network I/O">
      {(range) => <ChartContent range={range} />}
    </ChartCard>
  );
}
