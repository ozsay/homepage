import Docker from "dockerode";

import getDockerArguments from "utils/config/docker";
import createLogger from "utils/logger";

const logger = createLogger("dockerContainersService");

export default async function handler(req, res) {
  const server = req.query.server || "";

  try {
    const dockerArgs = getDockerArguments(server || undefined);
    if (!dockerArgs) {
      return res.status(400).json({ error: `Unknown docker server: ${server}` });
    }

    const docker = new Docker(dockerArgs.conn || dockerArgs);
    const containers = await docker.listContainers({ all: true });

    if (!Array.isArray(containers)) {
      return res.status(500).json({ error: "query failed" });
    }

    const result = containers.map((c) => ({
      id: c.Id,
      name: c.Names?.[0]?.replace(/^\//, "") ?? c.Id.slice(0, 12),
      image: c.Image,
      state: c.State,
      status: c.Status,
      health: c.Status?.match(/\(([^)]+)\)/)?.[1] ?? null,
      ports: (c.Ports || []).map((p) => ({
        private: p.PrivatePort,
        public: p.PublicPort,
        type: p.Type,
      })),
      created: c.Created,
    }));

    return res.status(200).json(result);
  } catch (e) {
    if (e) logger.error(e);
    return res.status(500).json({
      error: { message: e?.message ?? "Unknown error" },
    });
  }
}
