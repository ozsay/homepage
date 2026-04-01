import Docker from "dockerode";

import getDockerArguments from "utils/config/docker";
import createLogger from "utils/logger";

const logger = createLogger("dockerVolumePruneService");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const server = req.query.server || "";

  try {
    const dockerArgs = getDockerArguments(server || undefined);
    if (!dockerArgs) {
      return res.status(400).json({ error: `Unknown docker server: ${server}` });
    }

    const docker = new Docker(dockerArgs.conn || dockerArgs);
    const result = await docker.pruneVolumes();

    return res.status(200).json({
      deleted: result.VolumesDeleted?.length || 0,
      spaceReclaimed: result.SpaceReclaimed || 0,
    });
  } catch (e) {
    if (e) logger.error(e);
    return res.status(500).json({
      error: { message: e?.message ?? "Unknown error" },
    });
  }
}
