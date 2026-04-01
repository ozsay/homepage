import Docker from "dockerode";

import getDockerArguments from "utils/config/docker";
import createLogger from "utils/logger";

const logger = createLogger("dockerImagePullService");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const server = req.query.server || "";
  const image = req.query.image || req.body?.image;

  if (!image) {
    return res.status(400).json({ error: "image parameter is required" });
  }

  try {
    const dockerArgs = getDockerArguments(server || undefined);
    if (!dockerArgs) {
      return res.status(400).json({ error: `Unknown docker server: ${server}` });
    }

    const docker = new Docker(dockerArgs.conn || dockerArgs);

    await new Promise((resolve, reject) => {
      docker.pull(image, (err, stream) => {
        if (err) return reject(err);
        docker.modem.followProgress(stream, (progressErr) => {
          if (progressErr) return reject(progressErr);
          return resolve();
        });
        return undefined;
      });
    });

    return res.status(200).json({ ok: true, image });
  } catch (e) {
    if (e) logger.error(e);
    return res.status(500).json({
      error: { message: e?.message ?? "Unknown error" },
    });
  }
}
