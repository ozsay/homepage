const { WebSocketServer } = require("ws");

const subscriptionManager = require("./subscription-manager");
const widgetPoller = require("./widget-poller");

const HEARTBEAT_INTERVAL = 30000;

function attachWebSocketGateway(server) {
  const port = server.address()?.port || parseInt(process.env.PORT || "3000", 10);
  widgetPoller.setPort(port);

  const wss = new WebSocketServer({ noServer: true });

  // Handle HTTP upgrade
  server.on("upgrade", (req, socket, head) => {
    // Only handle our WebSocket path
    if (req.url === "/api/ws") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else {
      socket.destroy();
    }
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
