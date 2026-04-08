import Docker from "dockerode";

import getDockerArguments from "utils/config/docker";
import createLogger from "utils/logger";

const logger = createLogger("dockerProcessMap");

const SKIP_BINARIES = new Set([
  "sh", "bash", "tini", "sleep", "cat",
  "s6-svscan", "s6-supervise", "dumb-init", "su-exec", "crond", "cron",
]);
const INTERPRETERS = new Set(["python", "python3", "python2", "node", "ruby", "perl", "java"]);

function extractImageName(image) {
  if (!image) return null;
  const noTag = image.split(/[:@]/)[0];
  return noTag.split("/").pop() || null;
}

export default async function handler(req, res) {
  const server = req.query.server || "";

  try {
    const dockerArgs = getDockerArguments(server || undefined);
    if (!dockerArgs) {
      return res.status(200).json({});
    }

    const docker = new Docker(dockerArgs.conn || dockerArgs);
    const containers = await docker.listContainers({ filters: { status: ["running"] } });

    // Map from key -> [{ container, pid, type }]
    const processMap = {};

    function addEntry(key, containerName, pid, type) {
      if (!key) return;
      const k = key.toLowerCase();
      if (!processMap[k]) processMap[k] = [];
      if (!processMap[k].some((e) => e.container === containerName && e.type === type)) {
        processMap[k].push({ container: containerName, pid, type });
      }
    }

    await Promise.all(
      containers.map(async (c) => {
        const cname = c.Names?.[0]?.replace(/^\//, "") ?? c.Id.slice(0, 12);
        const composeSvc = c.Labels?.["com.docker.compose.service"] || null;
        const imageName = extractImageName(c.Image);

        let mainPid = null;

        try {
          const ct = docker.getContainer(c.Id);
          const top = await ct.top({ ps_args: "aux" });
          const titles = top.Titles || [];
          const pidIndex = titles.findIndex((t) => /^PID$/i.test(t));
          const cmdIndex = titles.findIndex((t) => /^(CMD|COMMAND)$/i.test(t));

          if (cmdIndex >= 0 && top.Processes) {
            mainPid = pidIndex >= 0 && top.Processes.length > 0 ? top.Processes[0][pidIndex] : null;

            for (const proc of top.Processes) {
              const cmd = proc[cmdIndex] || "";
              const pid = pidIndex >= 0 ? proc[pidIndex] : null;
              const tokens = cmd.split(/\s+/).filter(Boolean);
              const firstToken = tokens[0] || "";
              const binary = firstToken.split("/").pop().replace(/:$/, "");

              if (!binary || SKIP_BINARIES.has(binary)) continue;

              addEntry(binary, cname, pid, "binary");

              // For interpreters, also register the script/module name
              if (INTERPRETERS.has(binary) && tokens.length > 1) {
                for (let i = 1; i < tokens.length; i++) {
                  if (!tokens[i].startsWith("-")) {
                    const script = tokens[i].split("/").pop().replace(/\.\w+$/, "");
                    if (script && script !== binary) addEntry(script, cname, pid, "script");
                    break;
                  }
                }
              }
            }
          }
        } catch {
          // Container may have stopped between list and top
        }

        // Register metadata keys (even if docker top failed)
        addEntry(cname, cname, mainPid, "name");
        if (composeSvc && composeSvc !== cname) {
          addEntry(composeSvc, cname, mainPid, "compose");
        }
        if (imageName && imageName !== cname && imageName !== composeSvc) {
          addEntry(imageName, cname, mainPid, "image");
        }
      }),
    );

    return res.status(200).json(processMap);
  } catch (e) {
    if (e) logger.error(e);
    return res.status(200).json({});
  }
}
