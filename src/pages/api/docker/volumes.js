import Docker from "dockerode";

import getDockerArguments from "utils/config/docker";
import createLogger from "utils/logger";

const logger = createLogger("dockerVolumesService");

export default async function handler(req, res) {
  const server = req.query.server || "";

  try {
    const dockerArgs = getDockerArguments(server || undefined);
    if (!dockerArgs) {
      return res.status(400).json({ error: `Unknown docker server: ${server}` });
    }

    const docker = new Docker(dockerArgs.conn || dockerArgs);
    const [volumeData, containers] = await Promise.all([
      docker.listVolumes(),
      docker.listContainers({ all: true }),
    ]);

    const volumes = volumeData?.Volumes || [];

    // Count how many containers use each volume
    const volumeUsage = {};
    for (const c of containers) {
      for (const m of c.Mounts || []) {
        if (m.Type === "volume" && m.Name) {
          volumeUsage[m.Name] = (volumeUsage[m.Name] || 0) + 1;
        }
      }
    }

    const result = volumes.map((v) => ({
      name: v.Name,
      driver: v.Driver,
      mountpoint: v.Mountpoint,
      created: v.CreatedAt,
      usedBy: volumeUsage[v.Name] || 0,
    }));

    return res.status(200).json(result);
  } catch (e) {
    if (e) logger.error(e);
    return res.status(500).json({
      error: { message: e?.message ?? "Unknown error" },
    });
  }
}
