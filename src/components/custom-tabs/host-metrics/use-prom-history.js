import useSWR from "swr";

const RANGE_SECONDS = {
  "1h": 3600,
  "6h": 21600,
  "24h": 86400,
  "7d": 604800,
};

const STEP_SECONDS = {
  "1h": 15,
  "6h": 60,
  "24h": 300,
  "7d": 1800,
};

export default function usePromHistory(query, range = "1h") {
  const now = Math.floor(Date.now() / 1000);
  const start = now - (RANGE_SECONDS[range] || 3600);
  const step = STEP_SECONDS[range] || 15;

  const params = new URLSearchParams({
    query,
    start: start.toString(),
    end: now.toString(),
    step: step.toString(),
  });

  const { data, error } = useSWR(query ? `/api/metrics/history?${params}` : null, {
    refreshInterval: 30000,
  });

  // Transform Prometheus response into chart-friendly format
  const chartData = [];
  if (data?.data?.result?.length > 0) {
    const result = data.data.result[0];
    for (const [timestamp, value] of result.values) {
      chartData.push({
        time: timestamp * 1000,
        value: parseFloat(value),
      });
    }
  }

  // For multi-series (e.g., network rx/tx)
  const multiSeries = {};
  if (data?.data?.result?.length > 1) {
    for (const result of data.data.result) {
      const label =
        result.metric.device ||
        result.metric.mountpoint ||
        result.metric.__name__ ||
        JSON.stringify(result.metric);
      multiSeries[label] = result.values.map(([timestamp, value]) => ({
        time: timestamp * 1000,
        value: parseFloat(value),
      }));
    }
  }

  return { chartData, multiSeries, error, isLoading: !data && !error };
}
