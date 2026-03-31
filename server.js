const { createServer } = require("http");
const path = require("path");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

async function startDev() {
  const next = require("next");
  const app = next({ dev: true, hostname, port });
  const handle = app.getRequestHandler();
  await app.prepare();

  const server = createServer(async (req, res) => {
    await handle(req, res);
  });

  const { attachWebSocketGateway } = require("./src/server/ws-gateway");
  attachWebSocketGateway(server);

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
}

async function startProd() {
  const http = require("http");
  const { attachWebSocketGateway } = require("./src/server/ws-gateway");

  // Monkey-patch http.createServer to intercept the server that
  // Next.js's startServer creates internally, so we can attach
  // our WebSocket gateway to the same HTTP server.
  const origCreateServer = http.createServer;
  let wsAttached = false;
  http.createServer = function patchedCreateServer(...args) {
    const server = origCreateServer.apply(http, args);
    if (!wsAttached) {
      wsAttached = true;
      attachWebSocketGateway(server);
    }
    return server;
  };

  const dir = path.join(__dirname);
  const configPath = path.join(dir, ".next", "required-server-files.json");
  const { config: nextConfig } = require(configPath);

  process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(nextConfig);

  require("next");
  const { startServer } = require("next/dist/server/lib/start-server");

  let keepAliveTimeout = parseInt(process.env.KEEP_ALIVE_TIMEOUT, 10);
  if (
    Number.isNaN(keepAliveTimeout) ||
    !Number.isFinite(keepAliveTimeout) ||
    keepAliveTimeout < 0
  ) {
    keepAliveTimeout = undefined;
  }

  await startServer({
    dir,
    isDev: false,
    config: nextConfig,
    hostname,
    port,
    allowRetry: false,
    keepAliveTimeout,
  });
}

(dev ? startDev() : startProd()).catch((err) => {
  console.error(err);
  process.exit(1);
});
