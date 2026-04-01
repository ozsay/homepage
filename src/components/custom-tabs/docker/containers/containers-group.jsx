import { useMemo } from "react";

import useWidgetWS from "utils/proxy/use-widget-ws";

import DockerGroup from "../docker-group";
import ContainerList from "./container-list";

export default function ContainersGroup({ server, defaultOpen }) {
  const topic = `docker:containers:${server}`;
  const fallbackUrl = `/api/docker/containers?server=${encodeURIComponent(server)}`;
  const { data: containers } = useWidgetWS(topic, fallbackUrl);

  const count = useMemo(() => (Array.isArray(containers) ? containers.length : null), [containers]);

  return (
    <DockerGroup title="Containers" count={count} defaultOpen={defaultOpen}>
      <ContainerList containers={containers} server={server} />
    </DockerGroup>
  );
}
