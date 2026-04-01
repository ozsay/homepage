const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const CONF_DIR = path.join(process.cwd(), "config");

/**
 * CJS-compatible version of getDockerArguments for use in server-side code.
 * Reads docker.yaml and returns dockerode connection options.
 */
function getDockerArguments(server) {
  const configFile = path.join(CONF_DIR, "docker.yaml");
  if (!fs.existsSync(configFile)) return null;

  const raw = fs.readFileSync(configFile, "utf8");
  const servers = yaml.load(raw);

  if (!server || !servers || !servers[server]) {
    // Default: local socket
    if (process.platform !== "win32" && process.platform !== "darwin") {
      return { conn: { socketPath: "/var/run/docker.sock" } };
    }
    return { conn: { host: "127.0.0.1" } };
  }

  const cfg = servers[server];

  if (cfg.socket) {
    return { conn: { socketPath: cfg.socket } };
  }

  if (cfg.host) {
    const conn = { host: cfg.host };
    if (cfg.port) conn.port = cfg.port;
    if (cfg.protocol) conn.protocol = cfg.protocol;
    if (cfg.tls) {
      conn.ca = fs.readFileSync(path.join(CONF_DIR, cfg.tls.caFile));
      conn.cert = fs.readFileSync(path.join(CONF_DIR, cfg.tls.certFile));
      conn.key = fs.readFileSync(path.join(CONF_DIR, cfg.tls.keyFile));
      conn.protocol = "https";
    }
    if (cfg.headers) conn.headers = cfg.headers;
    return { conn };
  }

  return { conn: cfg };
}

module.exports = { getDockerArguments };
