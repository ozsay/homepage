import Docker from "dockerode";

import getDockerArguments from "utils/config/docker";
import createLogger from "utils/logger";

const logger = createLogger("dockerInspectService");

export default async function handler(req, res) {
  const { container } = req.query;
  const server = req.query.server || "";

  if (!container) {
    return res.status(400).json({ error: "container parameter is required" });
  }

  try {
    const dockerArgs = getDockerArguments(server || undefined);
    if (!dockerArgs) {
      return res.status(400).json({ error: `Unknown docker server: ${server}` });
    }

    const docker = new Docker(dockerArgs.conn || dockerArgs);
    const info = await docker.getContainer(container).inspect();

    const result = {
      id: info.Id,
      name: info.Name?.replace(/^\//, ""),
      created: info.Created,
      image: info.Config?.Image,
      restartPolicy: info.HostConfig?.RestartPolicy,
      entrypoint: info.Config?.Entrypoint,
      command: info.Config?.Cmd,
      env: (info.Config?.Env || []).map((e) => {
        const idx = e.indexOf("=");
        return idx > -1 ? { key: e.slice(0, idx), value: e.slice(idx + 1) } : { key: e, value: "" };
      }),
      mounts: (info.Mounts || []).map((m) => ({
        source: m.Source,
        destination: m.Destination,
        mode: m.Mode || (m.RW ? "rw" : "ro"),
        type: m.Type,
      })),
      ports: Object.entries(info.NetworkSettings?.Ports || {}).map(([containerPort, bindings]) => ({
        container: containerPort,
        host: bindings?.map((b) => `${b.HostIp || "0.0.0.0"}:${b.HostPort}`).join(", ") || null,
      })),
      networks: Object.entries(info.NetworkSettings?.Networks || {}).map(([name, net]) => ({
        name,
        ip: net.IPAddress,
        gateway: net.Gateway,
        aliases: net.Aliases || [],
      })),
      labels: info.Config?.Labels || {},
    };

    return res.status(200).json(result);
  } catch (e) {
    if (e) logger.error(e);
    return res.status(500).json({
      error: { message: e?.message ?? "Unknown error" },
    });
  }
}
