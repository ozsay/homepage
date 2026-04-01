import Docker from "dockerode";

import getDockerArguments from "utils/config/docker";
import createLogger from "utils/logger";

const logger = createLogger("dockerNetworksService");

export default async function handler(req, res) {
  const server = req.query.server || "";

  try {
    const dockerArgs = getDockerArguments(server || undefined);
    if (!dockerArgs) {
      return res.status(400).json({ error: `Unknown docker server: ${server}` });
    }

    const docker = new Docker(dockerArgs.conn || dockerArgs);
    const [networkList, allContainers] = await Promise.all([
      docker.listNetworks(),
      docker.listContainers({ all: true }),
    ]);

    if (!Array.isArray(networkList)) {
      return res.status(500).json({ error: "query failed" });
    }

    // Build map: container id/name -> containers sharing its network namespace
    // Containers with NetworkMode "container:<name_or_id>" share the parent's network
    const childrenByParent = {};
    const containerIdToName = {};

    for (const c of allContainers) {
      const name = c.Names?.[0]?.replace(/^\//, "") ?? c.Id.slice(0, 12);
      containerIdToName[c.Id] = name;
      containerIdToName[name] = name;
    }

    for (const c of allContainers) {
      const mode = c.HostConfig?.NetworkMode || "";
      if (mode.startsWith("container:")) {
        const parentRef = mode.slice("container:".length);
        const parentName = containerIdToName[parentRef] || parentRef;
        const childName = c.Names?.[0]?.replace(/^\//, "") ?? c.Id.slice(0, 12);
        if (!childrenByParent[parentName]) childrenByParent[parentName] = [];
        childrenByParent[parentName].push(childName);
      }
    }

    // Inspect each network to get connected containers
    const inspected = await Promise.all(
      networkList.map((n) => docker.getNetwork(n.Id).inspect()),
    );

    const result = inspected.map((n) => {
      const containers = Object.entries(n.Containers || {}).map(([id, c]) => ({
        id,
        name: c.Name,
        ip: c.IPv4Address?.split("/")[0] || "",
        mac: c.MacAddress,
        children: childrenByParent[c.Name] || [],
      }));

      // Total count includes children
      const totalCount = containers.reduce((sum, c) => sum + 1 + c.children.length, 0);

      return {
        id: n.Id,
        name: n.Name,
        driver: n.Driver,
        scope: n.Scope,
        subnet: n.IPAM?.Config?.[0]?.Subnet || null,
        gateway: n.IPAM?.Config?.[0]?.Gateway || null,
        containers,
        containerCount: totalCount,
      };
    });

    return res.status(200).json(result);
  } catch (e) {
    if (e) logger.error(e);
    return res.status(500).json({
      error: { message: e?.message ?? "Unknown error" },
    });
  }
}
