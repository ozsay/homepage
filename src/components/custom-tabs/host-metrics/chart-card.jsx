import { useState } from "react";

import TimeRangeSelector from "./time-range-selector";

export default function ChartCard({ title, children }) {
  const [range, setRange] = useState("1h");

  return (
    <div className="rounded-md shadow-md bg-theme-100/20 dark:bg-white/5 backdrop-blur p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium uppercase text-theme-500 dark:text-theme-400">{title}</p>
        <TimeRangeSelector value={range} onChange={setRange} />
      </div>
      {typeof children === "function" ? children(range) : children}
    </div>
  );
}
