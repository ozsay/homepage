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

    // Count how many containers use each image
    const imageUsage = {};
    for (const c of containers) {
      const imageId = c.ImageID;
      imageUsage[imageId] = (imageUsage[imageId] || 0) + 1;
    }

    const result = images.map((img) => ({
      id: img.Id,
      repoTags: img.RepoTags || [],
      repoDigests: img.RepoDigests || [],
      size: img.Size,
      created: img.Created,
      usedBy: imageUsage[img.Id] || 0,
    }));

    return res.status(200).json(result);
  } catch (e) {
    if (e) logger.error(e);
    return res.status(500).json({
      error: { message: e?.message ?? "Unknown error" },
    });
  }
}
