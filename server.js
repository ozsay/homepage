const { createServer } = require("http");
const path = require("path");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

async function start() {
  let requestHandler;

  if (dev) {
    // Development — use the full next() API
    const next = require("next");
    const app = next({ dev, hostname, port });
    requestHandler = app.getRequestHandler();
    await app.prepare();
  } else {
    // Production / standalone — use NextServer directly (no webpack needed)
    const dir = path.join(__dirname);
    const configPath = path.join(dir, ".next", "required-server-files.json");
    const { config: nextConfig } = require(configPath);

    process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(nextConfig);

    const NextServer = require("next/dist/server/next-server").default;
    const nextServer = new NextServer({
      hostname,
      port,
      dir,
      dev: false,
      customServer: true,
      conf: nextConfig,
    });
    requestHandler = nextServer.getRequestHandler();
    await nextServer.prepare();
  }

  const server = createServer(async (req, res) => {
    await requestHandler(req, res);
  });

  // Attach WebSocket gateway to the HTTP server
  const { attachWebSocketGateway } = require("./src/server/ws-gateway");
  attachWebSocketGateway(server);

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
