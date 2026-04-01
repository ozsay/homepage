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
    const [volumeData, containers, df] = await Promise.all([
      docker.listVolumes(),
      docker.listContainers({ all: true }),
      docker.df().catch(() => null),
    ]);

    const volumes = volumeData?.Volumes || [];

    // Map volume name -> list of container names using it
    const volumeContainers = {};
    for (const c of containers) {
      const name = c.Names?.[0]?.replace(/^\//, "") ?? c.Id.slice(0, 12);
      for (const m of c.Mounts || []) {
        if (m.Type === "volume" && m.Name) {
          if (!volumeContainers[m.Name]) volumeContainers[m.Name] = [];
          volumeContainers[m.Name].push(name);
        }
      }
    }

    // Map volume name -> size from docker system df
    const volumeSizes = {};
    if (df?.Volumes) {
      for (const v of df.Volumes) {
        if (v.Name && v.UsageData?.Size >= 0) {
          volumeSizes[v.Name] = v.UsageData.Size;
        }
      }
    }

    const result = volumes.map((v) => ({
      name: v.Name,
      driver: v.Driver,
      mountpoint: v.Mountpoint,
      created: v.CreatedAt,
      usedBy: volumeContainers[v.Name]?.length || 0,
      containers: volumeContainers[v.Name] || [],
      size: volumeSizes[v.Name] ?? null,
    }));

    return res.status(200).json(result);
  } catch (e) {
    if (e) logger.error(e);
    return res.status(500).json({
      error: { message: e?.message ?? "Unknown error" },
    });
  }
}
