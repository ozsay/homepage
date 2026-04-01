import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import LogControls from "./log-controls";
import LogLine from "./log-line";

const MAX_LINES = 5000;

/**
 * Parse raw log text (from API or WebSocket) into structured line objects.
 * Each line has: { timestamp, stream, content }
 *
 * Format: "stdout: 2026-04-01T10:00:00.000Z message" or
 *         "stderr: 2026-04-01T10:00:00.000Z message"
 */
function parseLogLines(text) {
  if (!text) return [];
  return text
    .split("\n")
    .filter((l) => l.length > 0)
    .map((raw) => {
      const streamMatch = raw.match(/^(stdout|stderr): /);
      const stream = streamMatch ? streamMatch[1] : "stdout";
      const rest = streamMatch ? raw.slice(streamMatch[0].length) : raw;

      // Try to extract ISO timestamp from the beginning
      const tsMatch = rest.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s*/);
      const timestamp = tsMatch ? tsMatch[1].replace(/T/, " ").replace(/\.\d+Z$/, "") : null;
      const content = tsMatch ? rest.slice(tsMatch[0].length) : rest;

      return { timestamp, stream, content };
    });
}

export default function LogViewer({ container, server }) {
  const [lines, setLines] = useState([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [search, setSearch] = useState("");
  const [tail, setTail] = useState(500);
  const containerRef = useRef(null);
  const wsRef = useRef(null);
  const userScrolledRef = useRef(false);

  // Fetch initial lines
  useEffect(() => {
    setLines([]);
    setSearch("");
    setAutoScroll(true);

    const controller = new AbortController();
    fetch(
      `/api/docker/logs/${encodeURIComponent(container.name)}?server=${encodeURIComponent(server)}&tail=${tail}&timestamps=true`,
      { signal: controller.signal },
    )
      .then((r) => r.text())
      .then((text) => setLines(parseLogLines(text)))
      .catch(() => {});

    return () => controller.abort();
  }, [container.name, server, tail]);

  // WebSocket for live tail
  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${proto}//${window.location.host}/api/docker/logs/${encodeURIComponent(container.name)}/stream?server=${encodeURIComponent(server)}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (e) => {
      const newLines = parseLogLines(e.data);
      if (newLines.length > 0) {
        setLines((prev) => [...prev, ...newLines].slice(-MAX_LINES));
      }
    };

    ws.onerror = () => {};
    wsRef.current = ws;

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [container.name, server]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  // Detect user scroll to disable auto-scroll
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    if (!atBottom && !userScrolledRef.current) {
      userScrolledRef.current = true;
      setAutoScroll(false);
    } else if (atBottom && userScrolledRef.current) {
      userScrolledRef.current = false;
    }
  }, []);

  // Filter lines by search
  const filtered = useMemo(() => {
    if (!search) return lines;
    const lower = search.toLowerCase();
    return lines.filter((l) => l.content.toLowerCase().includes(lower));
  }, [lines, search]);

  return (
    <div className="flex flex-col overflow-hidden">
      <LogControls
        autoScroll={autoScroll}
        setAutoScroll={(v) => {
          setAutoScroll(v);
          userScrolledRef.current = !v;
          if (v && containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
          }
        }}
        onClear={() => setLines([])}
        search={search}
        setSearch={setSearch}
        tail={tail}
        setTail={setTail}
      />
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="max-h-[32rem] overflow-y-auto font-mono text-xs p-2 bg-theme-900/5 dark:bg-black/20"
      >
        {filtered.map((line, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <LogLine key={i} line={line} />
        ))}
        {filtered.length === 0 && lines.length === 0 && (
          <div className="text-theme-500 dark:text-theme-400 text-center py-8">No logs available</div>
        )}
        {filtered.length === 0 && lines.length > 0 && search && (
          <div className="text-theme-500 dark:text-theme-400 text-center py-8">No matching lines</div>
        )}
      </div>
      {!autoScroll && (
        <button
          type="button"
          onClick={() => {
            setAutoScroll(true);
            userScrolledRef.current = false;
            if (containerRef.current) {
              containerRef.current.scrollTop = containerRef.current.scrollHeight;
            }
          }}
          className="absolute bottom-4 right-4 px-3 py-1.5 text-xs rounded-full bg-theme-300/80 dark:bg-white/20 text-theme-700 dark:text-theme-200 shadow-lg hover:bg-theme-400/80 dark:hover:bg-white/30 transition-colors"
        >
          Jump to bottom
        </button>
      )}
    </div>
  );
}
