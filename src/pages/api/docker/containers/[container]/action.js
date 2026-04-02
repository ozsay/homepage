import Docker from "dockerode";

import getDockerArguments from "utils/config/docker";
import createLogger from "utils/logger";

const logger = createLogger("dockerContainerAction");

const ALLOWED_ACTIONS = ["start", "stop", "kill", "restart", "remove"];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { container: containerId } = req.query;
  const server = req.query.server || "";
  const action = req.query.action || "";

  if (!containerId) {
    return res.status(400).json({ error: "container parameter is required" });
  }

  if (!ALLOWED_ACTIONS.includes(action)) {
    return res.status(400).json({ error: `Invalid action: ${action}. Allowed: ${ALLOWED_ACTIONS.join(", ")}` });
  }

  try {
    const dockerArgs = getDockerArguments(server || undefined);
    if (!dockerArgs) {
      return res.status(400).json({ error: `Unknown docker server: ${server}` });
    }

    const docker = new Docker(dockerArgs.conn || dockerArgs);
    const container = docker.getContainer(containerId);

    await container[action]();

    return res.status(204).end();
  } catch (e) {
    if (e) logger.error(e);
    return res.status(500).json({
      error: { message: e?.message ?? "Unknown error" },
    });
  }
}
