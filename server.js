const { createServer } = require("http");

const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(handle);

  // Attach WebSocket gateway to the HTTP server
  const { attachWebSocketGateway } = require("./src/server/ws-gateway");
  attachWebSocketGateway(server);

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
