import CpuChart from "./cpu-chart";
import DiskChart from "./disk-chart";
import MemoryChart from "./memory-chart";
import NetworkChart from "./network-chart";
import ProcessTable from "./process-table";
import RealtimeGauges from "./realtime-gauges";

export default function HostMetrics({ config }) {
  return (
    <div className="flex flex-col gap-4 m-4 sm:m-8 sm:mt-4">
      <RealtimeGauges config={config} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CpuChart config={config} />
        <MemoryChart config={config} />
        <NetworkChart config={config} />
        <DiskChart config={config} />
      </div>
      <ProcessTable config={config} />
    </div>
  );
}
