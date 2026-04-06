import Docker from "dockerode";

import getDockerArguments from "utils/config/docker";
import createLogger from "utils/logger";

const logger = createLogger("dockerProcessMap");

const SKIP_BINARIES = new Set(["sh", "bash", "tini", "sleep", "cat"]);
const INTERPRETERS = new Set(["python", "python3", "python2", "node", "ruby", "perl", "java"]);

export default async function handler(req, res) {
  const server = req.query.server || "";

  try {
    const dockerArgs = getDockerArguments(server || undefined);
    if (!dockerArgs) {
      return res.status(200).json({});
    }

    const docker = new Docker(dockerArgs.conn || dockerArgs);
    const containers = await docker.listContainers({ filters: { status: ["running"] } });

    // Map from key -> [{ container, pid }]
    const processMap = {};

    function addEntry(key, containerName, pid) {
      if (!key) return;
      const k = key.toLowerCase();
      if (!processMap[k]) processMap[k] = [];
      if (!processMap[k].some((e) => e.container === containerName && e.pid === pid)) {
        processMap[k].push({ container: containerName, pid });
      }
    }

    await Promise.all(
      containers.map(async (c) => {
        const cname = c.Names?.[0]?.replace(/^\//, "") ?? c.Id.slice(0, 12);
        try {
          const ct = docker.getContainer(c.Id);
          const top = await ct.top({ ps_args: "aux" });
          const titles = top.Titles || [];
          const pidIndex = titles.findIndex((t) => /^PID$/i.test(t));
          const cmdIndex = titles.findIndex((t) => /^(CMD|COMMAND)$/i.test(t));
          if (cmdIndex < 0 || !top.Processes) return;

          // Register container name itself as a lookup key
          addEntry(cname, cname, null);

          for (const proc of top.Processes) {
            const cmd = proc[cmdIndex] || "";
            const pid = pidIndex >= 0 ? proc[pidIndex] : null;
            const tokens = cmd.split(/\s+/).filter(Boolean);
            const firstToken = tokens[0] || "";
            const binary = firstToken.split("/").pop().replace(/:$/, "");

            if (!binary || SKIP_BINARIES.has(binary)) continue;

            addEntry(binary, cname, pid);

            // For interpreters, also register the script/module name
            if (INTERPRETERS.has(binary) && tokens.length > 1) {
              for (let i = 1; i < tokens.length; i++) {
                if (!tokens[i].startsWith("-")) {
                  const script = tokens[i].split("/").pop().replace(/\.\w+$/, "");
                  if (script && script !== binary) addEntry(script, cname, pid);
                  break;
                }
              }
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
