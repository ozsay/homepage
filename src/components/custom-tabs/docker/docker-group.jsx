import { Disclosure, Transition } from "@headlessui/react";
import classNames from "classnames";
import { useEffect, useRef } from "react";
import { MdKeyboardArrowDown } from "react-icons/md";

export default function DockerGroup({ title, count, defaultOpen = false, children }) {
  const panel = useRef();

  useEffect(() => {
    if (!defaultOpen) panel.current.style.height = `0`;
  }, [defaultOpen]);

  return (
    <div className="services-group flex-1 basis-full p-1 pb-0">
      <Disclosure defaultOpen={defaultOpen}>
        {({ open }) => (
          <>
            <Disclosure.Button className="flex w-full select-none items-center group">
              <h2 className="flex text-theme-800 dark:text-theme-300 text-xl font-medium">
                {title}
              </h2>
              {count != null && (
                <span className="ml-2 text-xs text-theme-500 dark:text-theme-400">
                  {count} total
                </span>
              )}
              <MdKeyboardArrowDown
                className={classNames(
                  "transition-all opacity-0 group-hover:opacity-100 ml-auto text-theme-800 dark:text-theme-300 text-xl",
                  open ? "" : "rotate-180",
                )}
              />
            </Disclosure.Button>
            <Transition
              className="block!"
              unmount={false}
              beforeLeave={() => {
                panel.current.style.height = `${panel.current.scrollHeight}px`;
                setTimeout(() => {
                  panel.current.style.height = `0`;
                }, 1);
              }}
              beforeEnter={() => {
                panel.current.style.height = `0px`;
                setTimeout(() => {
                  panel.current.style.height = `${panel.current.scrollHeight}px`;
                }, 1);
                setTimeout(() => {
                  panel.current.style.height = "auto";
                }, 150);
              }}
            >
              <Disclosure.Panel
                className="transition-all overflow-hidden duration-300 ease-out"
                ref={panel}
                static
              >
                <div className="mt-3">
                  {children}
                </div>
              </Disclosure.Panel>
            </Transition>
          </>
        )}
      </Disclosure>
    </div>
  );
}
