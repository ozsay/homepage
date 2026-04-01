import Docker from "dockerode";

import getDockerArguments from "utils/config/docker";
import createLogger from "utils/logger";

const logger = createLogger("dockerImagesService");

export default async function handler(req, res) {
  const server = req.query.server || "";

  try {
    const dockerArgs = getDockerArguments(server || undefined);
    if (!dockerArgs) {
      return res.status(400).json({ error: `Unknown docker server: ${server}` });
    }

    const docker = new Docker(dockerArgs.conn || dockerArgs);
    const [images, containers] = await Promise.all([
      docker.listImages({ all: true }),
      docker.listContainers({ all: true }),
    ]);

    if (!Array.isArray(images)) {
      return res.status(500).json({ error: "query failed" });
    }

    // Map image ID -> list of container names using it
    const imageContainers = {};
    for (const c of containers) {
      const imageId = c.ImageID;
      const name = c.Names?.[0]?.replace(/^\//, "") ?? c.Id.slice(0, 12);
      if (!imageContainers[imageId]) imageContainers[imageId] = [];
      imageContainers[imageId].push(name);
    }

    const result = images.map((img) => ({
      id: img.Id,
      repoTags: img.RepoTags || [],
      repoDigests: img.RepoDigests || [],
      size: img.Size,
      created: img.Created,
      usedBy: imageContainers[img.Id]?.length || 0,
      containers: imageContainers[img.Id] || [],
    }));

    return res.status(200).json(result);
  } catch (e) {
    if (e) logger.error(e);
    return res.status(500).json({
      error: { message: e?.message ?? "Unknown error" },
    });
  }
}
