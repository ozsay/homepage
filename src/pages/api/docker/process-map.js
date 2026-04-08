import { readdir, readFile, readlink, access } from "fs/promises";
import path from "path";

import Docker from "dockerode";

import getDockerArguments from "utils/config/docker";
import createLogger from "utils/logger";

const logger = createLogger("dockerProcessMap");

const HOST_PROC = "/host/proc";
const DOCKER_CGROUP_RE = /docker[/-]([a-f0-9]{64})/;
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

function addEntry(processMap, key, containerName, pid, type) {
  if (!key) return;
  const k = key.toLowerCase();
  if (!processMap[k]) processMap[k] = [];
  if (!processMap[k].some((e) => e.container === containerName && e.type === type)) {
    processMap[k].push({ container: containerName, pid, type });
  }
}

function registerContainerMetadata(processMap, containers) {
  for (const c of containers) {
    const cname = c.Names?.[0]?.replace(/^\//, "") ?? c.Id.slice(0, 12);
    const composeSvc = c.Labels?.["com.docker.compose.service"] || null;
    const imageName = extractImageName(c.Image);

    addEntry(processMap, cname, cname, null, "name");
    if (composeSvc && composeSvc !== cname) {
      addEntry(processMap, composeSvc, cname, null, "compose");
    }
    if (imageName && imageName !== cname && imageName !== composeSvc) {
      addEntry(processMap, imageName, cname, null, "image");
    }
  }
}

async function buildFromProc(processMap, containerIdMap) {
  const entries = await readdir(HOST_PROC);
  const pids = entries.filter((e) => /^\d+$/.test(e));

  await Promise.all(
    pids.map(async (pid) => {
      try {
        const cgroupContent = await readFile(path.join(HOST_PROC, pid, "cgroup"), "utf8");
        const cgMatch = DOCKER_CGROUP_RE.exec(cgroupContent);
        const container = cgMatch ? containerIdMap[cgMatch[1]] : null;

        const cmdline = await readFile(path.join(HOST_PROC, pid, "cmdline"), "utf8");
        if (!cmdline) return; // kernel thread

        // Collect all name variants for this process
        const names = new Set();

        // 1. cmdline argv[0] basename
        const argv0 = cmdline.split("\0")[0] || "";
        const cmdBinary = argv0.split("/").pop().replace(/:$/, "");
        if (cmdBinary) names.add(cmdBinary);

        // 2. kernel comm name (may differ from cmdline, 15-char max)
        try {
          const comm = (await readFile(path.join(HOST_PROC, pid, "comm"), "utf8")).trim();
          if (comm) names.add(comm);
        } catch { /* ignored */ }

        // 3. exe readlink — matches process-exporter {{.ExeBase}}
        //    May work in rootless Docker (same user), gracefully skip if not
        try {
          const exePath = await readlink(path.join(HOST_PROC, pid, "exe"));
          const exeBase = exePath.split("/").pop();
          if (exeBase) names.add(exeBase);
        } catch { /* expected in rootless for non-owned processes */ }

        // Register all unique names
        let hasInterpreter = false;
        for (const name of names) {
          if (SKIP_BINARIES.has(name)) continue;
          if (container) {
            addEntry(processMap, name, container.name, pid, "proc");
          } else {
            // Host process — store PID for display
            if (!processMap._hostPids) processMap._hostPids = {};
            if (!processMap._hostPids[name.toLowerCase()]) {
              processMap._hostPids[name.toLowerCase()] = pid;
            }
          }
          if (INTERPRETERS.has(name)) hasInterpreter = true;
        }

        // For interpreters, also register the script/module name
        if (hasInterpreter) {
          const args = cmdline.split("\0").filter(Boolean);
          for (let i = 1; i < args.length; i++) {
            if (!args[i].startsWith("-")) {
              const script = args[i].split("/").pop().replace(/\.\w+$/, "");
              if (script && !names.has(script)) {
                if (container) {
                  addEntry(processMap, script, container.name, pid, "proc");
                } else if (!processMap._hostPids[script.toLowerCase()]) {
                  processMap._hostPids[script.toLowerCase()] = pid;
                }
              }
              break;
            }
          }
        }
      } catch {
        // Process may have exited between readdir and read
      }
    }),
  );
}

async function buildFromDockerTop(processMap, docker, containers) {
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

        for (const proc of top.Processes) {
          const cmd = proc[cmdIndex] || "";
          const pid = pidIndex >= 0 ? proc[pidIndex] : null;
          const tokens = cmd.split(/\s+/).filter(Boolean);
          const firstToken = tokens[0] || "";
          const binary = firstToken.split("/").pop().replace(/:$/, "");

          if (!binary || SKIP_BINARIES.has(binary)) continue;

          addEntry(processMap, binary, cname, pid, "binary");

          if (INTERPRETERS.has(binary) && tokens.length > 1) {
            for (let i = 1; i < tokens.length; i++) {
              if (!tokens[i].startsWith("-")) {
                const script = tokens[i].split("/").pop().replace(/\.\w+$/, "");
                if (script && script !== binary) addEntry(processMap, script, cname, pid, "script");
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

    const processMap = {};

    // Always register container metadata (name, compose service, image)
    registerContainerMetadata(processMap, containers);

    // Try /proc-based approach first, fall back to docker top
    let usedProc = false;
    try {
      await access(HOST_PROC);
      const containerIdMap = {};
      for (const c of containers) {
        const cname = c.Names?.[0]?.replace(/^\//, "") ?? c.Id.slice(0, 12);
        containerIdMap[c.Id] = { name: cname };
      }
      await buildFromProc(processMap, containerIdMap);
      usedProc = true;
    } catch {
      // /host/proc not available
    }

    if (!usedProc) {
      await buildFromDockerTop(processMap, docker, containers);
    }

    // Add container ID → name mapping for cgroup-based lookups
    const containerIds = {};
    for (const c of containers) {
      const cname = c.Names?.[0]?.replace(/^\//, "") ?? c.Id.slice(0, 12);
      containerIds[c.Id] = cname;
    }
    processMap._containerIds = containerIds;

    return res.status(200).json(processMap);
  } catch (e) {
    if (e) logger.error(e);
    return res.status(200).json({});
  }
}
