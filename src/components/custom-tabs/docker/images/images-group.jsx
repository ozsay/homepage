import { useMemo } from "react";

import useWidgetWS from "utils/proxy/use-widget-ws";

import DockerGroup from "../docker-group";
import ImageList from "./image-list";

export default function ImagesGroup({ server }) {
  const topic = `docker:images:${server}`;
  const fallbackUrl = `/api/docker/images?server=${encodeURIComponent(server)}`;
  const { data: images } = useWidgetWS(topic, fallbackUrl);

  const count = useMemo(() => (Array.isArray(images) ? images.length : null), [images]);

  return (
    <DockerGroup title="Images" count={count}>
      <ImageList images={images} />
    </DockerGroup>
  );
}
