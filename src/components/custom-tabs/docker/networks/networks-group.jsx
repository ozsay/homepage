import { useMemo } from "react";

import useWidgetWS from "utils/proxy/use-widget-ws";

import DockerGroup from "../docker-group";
import NetworkList from "./network-list";

export default function NetworksGroup({ server }) {
  const topic = `docker:networks:${server}`;
  const fallbackUrl = `/api/docker/networks?server=${encodeURIComponent(server)}`;
  const { data: networks } = useWidgetWS(topic, fallbackUrl);

  const count = useMemo(() => (Array.isArray(networks) ? networks.length : null), [networks]);

  return (
    <DockerGroup title="Networks" count={count}>
      <NetworkList networks={networks} />
    </DockerGroup>
  );
}
