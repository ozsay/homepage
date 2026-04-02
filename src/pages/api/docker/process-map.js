import Docker from "dockerode";

import getDockerArguments from "utils/config/docker";
import createLogger from "utils/logger";

const logger = createLogger("dockerProcessMap");

export default async function handler(req, res) {
  const server = req.query.server || "";

  try {
    const dockerArgs = getDockerArguments(server || undefined);
    if (!dockerArgs) {
      return res.status(200).json({});
    }

    const docker = new Docker(dockerArgs.conn || dockerArgs);
    const containers = await docker.listContainers({ filters: { status: ["running"] } });

    const processMap = {};

    await Promise.all(
      containers.map(async (c) => {
        const name = c.Names?.[0]?.replace(/^\//, "") ?? c.Id.slice(0, 12);
        try {
          const container = docker.getContainer(c.Id);
          const top = await container.top({ ps_args: "aux" });
          const titles = top.Titles || [];
          const pidIndex = titles.findIndex((t) => /^PID$/i.test(t));
          const cmdIndex = titles.findIndex((t) => /^(CMD|COMMAND)$/i.test(t));
          if (cmdIndex < 0 || !top.Processes) return;

          for (const proc of top.Processes) {
            const cmd = proc[cmdIndex] || "";
            const pid = pidIndex >= 0 ? proc[pidIndex] : null;
            // Extract binary name: take first token, strip path
            const firstToken = cmd.split(/\s+/)[0] || "";
            const binary = firstToken.split("/").pop().replace(/:$/, "");
            if (binary && binary !== "sh" && binary !== "bash" && binary !== "tini") {
              processMap[binary.toLowerCase()] = { container: name, pid };
            }
          }
        } catch {
          // Container may have stopped between list and top
        }
      }),
    );

    return res.status(200).json(processMap);
  } catch (e) {
    if (e) logger.error(e);
    return res.status(200).json({});
  }
}
