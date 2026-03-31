import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const WebSocketContext = createContext(null);

const RECONNECT_BASE = 1000;
const RECONNECT_MAX = 30000;

export function WebSocketProvider({ children }) {
  const wsRef = useRef(null);
  const [status, setStatus] = useState("disconnected"); // disconnected | connecting | connected
  const handlersRef = useRef(new Map()); // topic -> Set<callback>
  const pendingSubsRef = useRef(new Set()); // topics to subscribe on reconnect
  const reconnectTimerRef = useRef(null);
  const reconnectDelayRef = useRef(RECONNECT_BASE);
  const connectRef = useRef(null);

  const getWsUrl = useCallback(() => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/api/ws`;
  }, []);

  const sendJSON = useCallback((data) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimerRef.current) return;

    const delay = Math.min(reconnectDelayRef.current + Math.random() * 500, RECONNECT_MAX);
    reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, RECONNECT_MAX);

    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      if (connectRef.current) connectRef.current();
    }, delay);
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState < 2 /* CLOSING */) return;

    setStatus("connecting");
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      reconnectDelayRef.current = RECONNECT_BASE;

      // Re-subscribe to all active topics
      const topics = Array.from(pendingSubsRef.current);
      if (topics.length > 0) {
        sendJSON({ type: "subscribe", topics });
      }
    };

    ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      if (msg.type === "data" && msg.topic) {
        const callbacks = handlersRef.current.get(msg.topic);
        if (callbacks) {
          for (const cb of callbacks) {
            cb(msg);
          }
        }
      }
    };

    ws.onclose = () => {
      setStatus("disconnected");
      wsRef.current = null;
      scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose will fire after this
    };
  }, [getWsUrl, sendJSON, scheduleReconnect]);

  // Keep ref in sync
  connectRef.current = connect;

  // Connect on mount
  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const subscribe = useCallback(
    (topic, callback) => {
      if (!handlersRef.current.has(topic)) {
        handlersRef.current.set(topic, new Set());
      }
      handlersRef.current.get(topic).add(callback);

      const isNew = !pendingSubsRef.current.has(topic);
      pendingSubsRef.current.add(topic);

      if (isNew) {
        sendJSON({ type: "subscribe", topics: [topic] });
      }
    },
    [sendJSON],
  );

  const unsubscribe = useCallback(
    (topic, callback) => {
      const callbacks = handlersRef.current.get(topic);
      if (!callbacks) return;

      callbacks.delete(callback);
      if (callbacks.size === 0) {
        handlersRef.current.delete(topic);
        pendingSubsRef.current.delete(topic);
        sendJSON({ type: "unsubscribe", topics: [topic] });
      }
    },
    [sendJSON],
  );

  const refresh = useCallback(
    (topic) => {
      sendJSON({ type: "refresh", topic });
    },
    [sendJSON],
  );

  const value = { subscribe, unsubscribe, refresh, status };

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
}

const NOOP = () => {};
const FALLBACK = { subscribe: NOOP, unsubscribe: NOOP, refresh: NOOP, status: "disconnected" };

export function useWebSocket() {
  const ctx = useContext(WebSocketContext);
  // Return a no-op fallback when outside a provider (SSR, tests)
  return ctx || FALLBACK;
}

export default WebSocketContext;
