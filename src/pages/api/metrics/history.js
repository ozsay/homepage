import { getSettings } from "utils/config/config";
import createLogger from "utils/logger";

const logger = createLogger("metrics-history");

export default async function handler(req, res) {
  const { query, start, end, step } = req.query;

  if (!query) {
    return res.status(400).json({ error: "query parameter is required" });
  }

  const settings = getSettings();
  const customTabs = settings?.customTabs || [];
  const hostMetricsTab = customTabs.find((t) => t.type === "hostMetrics");
  const prometheusUrl = hostMetricsTab?.options?.prometheusUrl;

  if (!prometheusUrl) {
    return res.status(400).json({ error: "prometheusUrl not configured in hostMetrics tab options" });
  }

  try {
    const params = new URLSearchParams({ query });
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    if (step) params.set("step", step);

    const response = await fetch(`${prometheusUrl}/api/v1/query_range?${params}`);
    if (!response.ok) {
      const body = await response.text();
      logger.error("Prometheus returned %d: %s", response.status, body);
      return res.status(502).json({ error: `Prometheus returned ${response.status}` });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (e) {
    logger.error("Failed to query Prometheus: %s", e.message);
    return res.status(500).json({ error: e.message });
  }
}
