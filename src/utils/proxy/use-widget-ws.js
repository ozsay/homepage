import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";

import { useWebSocket } from "./ws-context";

/**
 * Drop-in replacement for useSWR with WebSocket push support.
 * Falls back to SWR polling when WebSocket is disconnected.
 *
 * @param {string} topic - WebSocket topic to subscribe to
 * @param {string} [fallbackUrl] - SWR URL for polling fallback
 * @param {object} [options] - { refreshInterval } for SWR fallback
 * @returns {{ data, error, mutate }}
 */
export default function useWidgetWS(topic, fallbackUrl, options = {}) {
  const { subscribe, unsubscribe, refresh, status } = useWebSocket();
  const [wsData, setWsData] = useState(null);
  const [wsError, setWsError] = useState(null);
  const wsConnected = status === "connected";
  const topicRef = useRef(topic);
  topicRef.current = topic;

  // WebSocket message handler
  const handleMessage = useCallback((msg) => {
    if (msg.error) {
      setWsError(msg.error);
    } else {
      setWsData(msg.data);
      setWsError(null);
    }
  }, []);

  // Subscribe/unsubscribe to topic
  useEffect(() => {
    if (!topic) return undefined;

    subscribe(topic, handleMessage);
    return () => unsubscribe(topic, handleMessage);
  }, [topic, subscribe, unsubscribe, handleMessage]);

  // SWR fallback — only polls when WS is disconnected
  const swrConfig = {};
  if (!wsConnected && options.refreshInterval) {
    swrConfig.refreshInterval = options.refreshInterval;
  }

  const {
    data: swrData,
    error: swrError,
    mutate: swrMutate,
  } = useSWR(
    // Only activate SWR when WS is disconnected and we have a fallback URL
    !wsConnected && fallbackUrl ? fallbackUrl : null,
    swrConfig,
  );

  // Use WS data when connected, SWR data as fallback
  const data = wsConnected && wsData != null ? wsData : wsData ?? swrData;
  const error = wsConnected ? wsError : wsError ?? swrData?.error ?? swrError;

  // mutate: trigger immediate WS refresh or SWR mutate
  const mutate = useCallback(() => {
    if (wsConnected && topicRef.current) {
      refresh(topicRef.current);
    } else {
      swrMutate();
    }
  }, [wsConnected, refresh, swrMutate]);

  return { data, error: data?.error ?? error, mutate };
}
