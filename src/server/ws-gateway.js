const { WebSocketServer } = require("ws");
const Docker = require("dockerode");

const subscriptionManager = require("./subscription-manager");
const widgetPoller = require("./widget-poller");
const { getDockerArguments } = require("./docker-helper");

const HEARTBEAT_INTERVAL = 30000;
const LOG_STREAM_PATH_RE = /^\/api\/docker\/logs\/([^/]+)\/stream/;

/**
 * Demultiplex a Docker log stream chunk into text lines.
 * Docker multiplexed streams have 8-byte headers per frame.
 */
function demuxChunk(buffer) {
  const lines = [];
  let offset = 0;

  while (offset + 8 <= buffer.length) {
    const streamType = buffer[offset];
    const size = buffer.readUInt32BE(offset + 4);
    offset += 8;

    if (offset + size > buffer.length) break;

    const chunk = buffer.subarray(offset, offset + size).toString("utf8");
    const stream = streamType === 2 ? "stderr" : "stdout";

    for (const line of chunk.split("\n")) {
      if (line.length > 0) {
        lines.push(`${stream}: ${line}`);
      }
    }

    offset += size;
  }

  return lines;
}

/**
 * Handle a WebSocket upgrade for container log streaming.
 * Opens a docker log stream and pipes demuxed lines to the client.
 */
function handleLogStream(ws, containerName, server) {
  const dockerArgs = getDockerArguments(server || undefined);
  if (!dockerArgs) {
    ws.send(JSON.stringify({ type: "error", error: `Unknown docker server: ${server}` }));
    ws.close();
    return;
  }

  const docker = new Docker(dockerArgs.conn);
  const container = docker.getContainer(containerName);

  container.logs(
    { follow: true, stdout: true, stderr: true, tail: 0, timestamps: true },
    (err, stream) => {
      if (err) {
        ws.send(JSON.stringify({ type: "error", error: err.message }));
        ws.close();
        return;
      }

      const bufs = [];

      stream.on("data", (data) => {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
        // Accumulate and try to demux — Docker may send partial frames
        bufs.push(buf);
        const combined = Buffer.concat(bufs);
        const lines = demuxChunk(combined);

        if (lines.length > 0) {
          bufs.length = 0;
          if (ws.readyState === 1) {
            ws.send(lines.join("\n"));
          }
        }
      });

      stream.on("end", () => {
        if (ws.readyState === 1) ws.close();
      });

      stream.on("error", (streamErr) => {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: "error", error: streamErr.message }));
          ws.close();
        }
      });

      ws.on("close", () => {
        stream.destroy();
      });
    },
  );
}

function attachWebSocketGateway(server) {
  const port = server.address()?.port || parseInt(process.env.PORT || "3000", 10);
  widgetPoller.setPort(port);

  const wss = new WebSocketServer({ noServer: true });
  const logWss = new WebSocketServer({ noServer: true });

  // Handle HTTP upgrade
  server.on("upgrade", (req, socket, head) => {
    if (req.url === "/api/ws") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else {
      const logMatch = req.url.match(LOG_STREAM_PATH_RE);
      if (logMatch) {
        logWss.handleUpgrade(req, socket, head, (ws) => {
          logWss.emit("connection", ws, req);
        });
      } else {
        socket.destroy();
      }
    }
  });

  // Handle log stream connections
  logWss.on("connection", (ws, req) => {
    const match = req.url.match(LOG_STREAM_PATH_RE);
    if (!match) {
      ws.close();
      return;
    }

    const containerName = decodeURIComponent(match[1]);
    const url = new URL(req.url, "http://localhost");
    const server = url.searchParams.get("server") || "";

    console.log(`[WS] log stream connected: ${containerName} (server: ${server || "default"})`);
    handleLogStream(ws, containerName, server);
  });

  wss.on("connection", (ws) => {
    ws.isAlive = true;
    console.log(`[WS] client connected (total: ${wss.clients.size})`);

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        ws.send(JSON.stringify({ type: "error", error: "Invalid JSON" }));
        return;
      }

      if (msg.type === "subscribe" && Array.isArray(msg.topics)) {
        for (const topic of msg.topics) {
          if (typeof topic === "string" && topic.length > 0 && topic.length < 256) {
            subscriptionManager.subscribe(ws, topic);
            // Send last known data immediately if available
            const lastData = widgetPoller.getLastData(topic);
            if (lastData) {
              ws.send(JSON.stringify({ type: "data", topic, data: lastData }));
            }
          }
        }
      } else if (msg.type === "unsubscribe" && Array.isArray(msg.topics)) {
        for (const topic of msg.topics) {
          subscriptionManager.unsubscribe(ws, topic);
        }
      } else if (msg.type === "refresh" && typeof msg.topic === "string") {
        widgetPoller.refreshTopic(msg.topic);
      }
    });

    ws.on("close", () => {
      subscriptionManager.unsubscribeAll(ws);
      console.log(`[WS] client disconnected (total: ${wss.clients.size})`);
    });

    ws.on("error", (err) => {
      console.error(`[WS] client error: ${err.message}`);
      subscriptionManager.unsubscribeAll(ws);
    });

    // Send welcome
    ws.send(JSON.stringify({ type: "connected" }));
  });

  // Heartbeat — detect dead connections
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) {
        subscriptionManager.unsubscribeAll(ws);
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, HEARTBEAT_INTERVAL);

  wss.on("close", () => {
    clearInterval(heartbeat);
  });

  // Ensure port is set once server is listening (handles late binding)
  server.on("listening", () => {
    const addr = server.address();
    if (addr && addr.port) {
      widgetPoller.setPort(addr.port);
    }
    console.log(`[WS] gateway attached on /api/ws`);
  });

  return wss;
}

module.exports = { attachWebSocketGateway };
