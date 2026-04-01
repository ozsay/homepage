import ContainersGroup from "./containers/containers-group";
import ImagesGroup from "./images/images-group";
import NetworksGroup from "./networks/networks-group";
import VolumesGroup from "./volumes/volumes-group";

export default function Docker({ config }) {
  const server = config.options?.server ?? "local";

  return (
    <div className="flex flex-wrap m-4 sm:m-8 sm:mt-4 items-start mb-2">
      <ContainersGroup server={server} defaultOpen />
      <ImagesGroup server={server} />
      <NetworksGroup server={server} />
      <VolumesGroup server={server} />
    </div>
  );
}
