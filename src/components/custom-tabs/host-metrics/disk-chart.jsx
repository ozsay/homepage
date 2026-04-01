import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import ChartCard from "./chart-card";
import usePromHistory from "./use-prom-history";

const QUERY =
  '(1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100';

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ChartContent({ range }) {
  const { chartData, isLoading } = usePromHistory(QUERY, range);

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded bg-theme-500/5" />;
  }

  if (chartData.length === 0) {
    return <div className="h-48 flex items-center justify-center text-xs text-theme-500">No data available</div>;
  }

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="diskGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="rgb(var(--color-600))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="rgb(var(--color-600))" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            tickFormatter={formatTime}
            tick={{ fontSize: 10, fill: "rgb(var(--color-400))" }}
            axisLine={false}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: "rgb(var(--color-400))" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
            width={40}
          />
          <Tooltip
            labelFormatter={(ts) => new Date(ts).toLocaleString()}
            formatter={(v) => [`${v.toFixed(1)}%`, "Disk"]}
            contentStyle={{
              backgroundColor: "rgb(var(--color-800))",
              color: "rgb(var(--color-100))",
              border: "none",
              borderRadius: "0.375rem",
              fontSize: "0.75rem",
            }}
          />
          <Area
            type="monotoneX"
            dataKey="value"
            stroke="rgb(var(--color-600))"
            fill="url(#diskGrad)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function DiskChart() {
  return (
    <ChartCard title="Disk Usage (/)">
      {(range) => <ChartContent range={range} />}
    </ChartCard>
  );
}
