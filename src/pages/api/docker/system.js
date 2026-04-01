import Docker from "dockerode";

import getDockerArguments from "utils/config/docker";
import createLogger from "utils/logger";

const logger = createLogger("dockerSystemService");

function formatBytes(bytes) {
  if (bytes == null) return null;
  return bytes;
}

export default async function handler(req, res) {
  const server = req.query.server || "";

  try {
    const dockerArgs = getDockerArguments(server || undefined);
    if (!dockerArgs) {
      return res.status(400).json({ error: `Unknown docker server: ${server}` });
    }

    const docker = new Docker(dockerArgs.conn || dockerArgs);
    const info = await docker.info();
    const version = await docker.version();

    const result = {
      host: {
        hostname: info.Name,
        os: `${info.OperatingSystem}`,
        architecture: info.Architecture,
        kernelVersion: info.KernelVersion,
        totalCpu: info.NCPU,
        totalMemory: info.MemTotal,
      },
      engine: {
        version: version.Version,
        apiVersion: version.ApiVersion,
        rootDir: info.DockerRootDir,
        storageDriver: info.Driver,
        loggingDriver: info.LoggingDriver,
        volumePlugins: (info.Plugins?.Volume || []),
        networkPlugins: (info.Plugins?.Network || []),
      },
    };

    return res.status(200).json(result);
  } catch (e) {
    if (e) logger.error(e);
    return res.status(500).json({
      error: { message: e?.message ?? "Unknown error" },
    });
  }
}
