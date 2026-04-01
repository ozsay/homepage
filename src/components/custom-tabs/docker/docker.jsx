import { FiBox, FiGlobe, FiHardDrive, FiLayers, FiServer } from "react-icons/fi";

import ContainersGroup from "./containers/containers-group";
import ImagesGroup from "./images/images-group";
import NetworksGroup from "./networks/networks-group";
import SystemGroup from "./system/system-group";
import VolumesGroup from "./volumes/volumes-group";

export default function Docker({ config }) {
  const server = config.options?.server ?? "local";

  return (
    <div className="flex flex-wrap m-4 sm:m-8 sm:mt-4 items-start mb-2">
      <ContainersGroup icon={FiBox} server={server} defaultOpen />
      <ImagesGroup icon={FiLayers} server={server} />
      <NetworksGroup icon={FiGlobe} server={server} />
      <VolumesGroup icon={FiHardDrive} server={server} />
      <SystemGroup icon={FiServer} server={server} />
    </div>
  );
}
