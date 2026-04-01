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
    const networkList = await docker.listNetworks();

    if (!Array.isArray(networkList)) {
      return res.status(500).json({ error: "query failed" });
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
      }));

      return {
        id: n.Id,
        name: n.Name,
        driver: n.Driver,
        scope: n.Scope,
        subnet: n.IPAM?.Config?.[0]?.Subnet || null,
        gateway: n.IPAM?.Config?.[0]?.Gateway || null,
        containers,
        containerCount: containers.length,
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
