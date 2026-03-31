import { useMemo } from "react";

import { formatProxyUrl } from "./api-helpers";
import useWidgetWS from "./use-widget-ws";

export default function useWidgetAPI(widget, ...options) {
  const endpoint = options[0];
  const refreshInterval = options[1]?.refreshInterval;

  const url = useMemo(() => {
    if (endpoint === "") return null;
    return formatProxyUrl(widget, ...options);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widget?.service_group, widget?.service_name, widget?.index, endpoint]);

  // Build a WebSocket topic from the widget identity
  const topic = useMemo(() => {
    if (!widget?.service_group || !widget?.service_name || endpoint === "") return null;
    return `proxy:${widget.service_group}:${widget.service_name}:${widget.index || 0}:${endpoint || ""}`;
  }, [widget?.service_group, widget?.service_name, widget?.index, endpoint]);

  const { data, error, mutate } = useWidgetWS(topic, url, {
    refreshInterval,
  });

  // make the data error the top-level error
  return { data, error: data?.error ?? error, mutate };
}
