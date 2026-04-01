import dynamic from "next/dynamic";

const customTabComponents = {
  hostMetrics: dynamic(() => import("components/custom-tabs/host-metrics/host-metrics")),
  docker: dynamic(() => import("components/custom-tabs/docker/docker")),
};

export default customTabComponents;
