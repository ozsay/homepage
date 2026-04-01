import { useState } from "react";

import ContainerContent from "./container-content";
import ContainerSidebar from "./container-sidebar";

export default function Docker({ config }) {
  const [selectedContainer, setSelectedContainer] = useState(null);
  const server = config.options?.server ?? "local";

  return (
    <div className="flex m-4 sm:m-8 sm:mt-4 gap-4 h-[calc(100vh-12rem)]">
      <ContainerSidebar
        server={server}
        selected={selectedContainer}
        onSelect={setSelectedContainer}
      />
      <ContainerContent container={selectedContainer} server={server} />
    </div>
  );
}
