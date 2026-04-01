import { useMemo } from "react";

import useWidgetWS from "utils/proxy/use-widget-ws";

import DockerGroup from "../docker-group";
import VolumeList from "./volume-list";

export default function VolumesGroup({ server }) {
  const topic = `docker:volumes:${server}`;
  const fallbackUrl = `/api/docker/volumes?server=${encodeURIComponent(server)}`;
  const { data: volumes } = useWidgetWS(topic, fallbackUrl);

  const count = useMemo(() => (Array.isArray(volumes) ? volumes.length : null), [volumes]);

  return (
    <DockerGroup title="Volumes" count={count}>
      <VolumeList volumes={volumes} />
    </DockerGroup>
  );
}
