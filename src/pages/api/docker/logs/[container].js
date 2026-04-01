import Docker from "dockerode";

import getDockerArguments from "utils/config/docker";
import createLogger from "utils/logger";

const logger = createLogger("dockerLogsService");

/**
 * Demultiplex a Docker logs buffer into text lines.
 *
 * Docker multiplexed streams prefix each frame with an 8-byte header:
 *   [stream_type(1)] [0(3)] [size(4 big-endian)]
 * where stream_type: 1 = stdout, 2 = stderr.
 *
 * When timestamps are enabled, each line already starts with an ISO timestamp.
 * We prefix each line with its stream type for client-side coloring.
 */
function demuxLogs(buffer) {
  const lines = [];
  let offset = 0;

  while (offset + 8 <= buffer.length) {
    const streamType = buffer[offset]; // 1=stdout, 2=stderr
    const size = buffer.readUInt32BE(offset + 4);
    offset += 8;

    if (offset + size > buffer.length) break;

    const chunk = buffer.subarray(offset, offset + size).toString("utf8");
    const stream = streamType === 2 ? "stderr" : "stdout";

    // A chunk may contain multiple newline-delimited lines
    for (const line of chunk.split("\n")) {
      if (line.length > 0) {
        lines.push(`${stream}: ${line}`);
      }
    }

    offset += size;
  }

  return lines.join("\n");
}

export default async function handler(req, res) {
  const { container } = req.query;
  const server = req.query.server || "";
  const tail = parseInt(req.query.tail, 10) || 500;
  const since = parseInt(req.query.since, 10) || 0;
  const timestamps = req.query.timestamps !== "false";

  if (!container) {
    return res.status(400).json({ error: "container parameter is required" });
  }

  try {
    const dockerArgs = getDockerArguments(server || undefined);
    if (!dockerArgs) {
      return res.status(400).json({ error: `Unknown docker server: ${server}` });
    }

    const docker = new Docker(dockerArgs.conn || dockerArgs);
    const dockerContainer = docker.getContainer(container);

    const logBuffer = await dockerContainer.logs({
      stdout: true,
      stderr: true,
      tail,
      since,
      timestamps,
    });

    const text = Buffer.isBuffer(logBuffer) ? demuxLogs(logBuffer) : logBuffer.toString("utf8");

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.status(200).send(text);
  } catch (e) {
    if (e) logger.error(e);
    return res.status(500).json({
      error: { message: e?.message ?? "Unknown error" },
    });
  }
}
