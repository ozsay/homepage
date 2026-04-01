import Docker from "dockerode";

import getDockerArguments from "utils/config/docker";
import createLogger from "utils/logger";

const logger = createLogger("dockerImageRemoveService");

export default async function handler(req, res) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query;
  const server = req.query.server || "";

  if (!id) {
    return res.status(400).json({ error: "id parameter is required" });
  }

  try {
    const dockerArgs = getDockerArguments(server || undefined);
    if (!dockerArgs) {
      return res.status(400).json({ error: `Unknown docker server: ${server}` });
    }

    const docker = new Docker(dockerArgs.conn || dockerArgs);
    const image = docker.getImage(id);
    await image.remove();

    return res.status(204).end();
  } catch (e) {
    if (e) logger.error(e);
    return res.status(500).json({
      error: { message: e?.message ?? "Unknown error" },
    });
  }
}
