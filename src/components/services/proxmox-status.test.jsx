// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useWidgetWS } = vi.hoisted(() => ({ useWidgetWS: vi.fn() }));

vi.mock("utils/proxy/use-widget-ws", () => ({
  default: useWidgetWS,
}));

import ProxmoxStatus from "./proxmox-status";

describe("components/services/proxmox-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders unknown when data is not available yet", () => {
    useWidgetWS.mockReturnValue({ data: undefined, error: undefined });

    render(<ProxmoxStatus service={{ proxmoxNode: "n1", proxmoxVMID: "100" }} />);

    expect(screen.getByText("docker.unknown")).toBeInTheDocument();
  });

  it("renders error when SWR returns an error", () => {
    useWidgetWS.mockReturnValue({ data: undefined, error: new Error("nope") });

    render(<ProxmoxStatus service={{ proxmoxNode: "n1", proxmoxVMID: "100" }} />);

    expect(screen.getByText("docker.error")).toBeInTheDocument();
  });

  it("requests vm stats and renders running when status is running", () => {
    useWidgetWS.mockReturnValue({ data: { status: "running" }, error: undefined });

    render(<ProxmoxStatus service={{ proxmoxNode: "n1", proxmoxVMID: "100" }} />);

    expect(useWidgetWS).toHaveBeenCalledWith(
      "status:proxmox:n1:100",
      "/api/proxmox/stats/n1/100?type=qemu",
    );
    expect(screen.getByText("docker.running")).toBeInTheDocument();
  });

  it("renders paused for paused vms", () => {
    useWidgetWS.mockReturnValue({ data: { status: "paused" }, error: undefined });

    render(<ProxmoxStatus service={{ proxmoxNode: "n1", proxmoxVMID: "100", proxmoxType: "lxc" }} />);

    expect(useWidgetWS).toHaveBeenCalledWith(
      "status:proxmox:n1:100",
      "/api/proxmox/stats/n1/100?type=lxc",
    );
    expect(screen.getByText("paused")).toBeInTheDocument();
  });

  it("renders other terminal statuses (stopped/offline/not found)", () => {
    useWidgetWS.mockReturnValue({ data: { status: "stopped" }, error: undefined });
    render(<ProxmoxStatus service={{ proxmoxNode: "n1", proxmoxVMID: "100" }} />);
    expect(screen.getByText("docker.exited")).toBeInTheDocument();

    useWidgetWS.mockReturnValue({ data: { status: "offline" }, error: undefined });
    render(<ProxmoxStatus service={{ proxmoxNode: "n1", proxmoxVMID: "100" }} />);
    expect(screen.getByText("offline")).toBeInTheDocument();

    useWidgetWS.mockReturnValue({ data: { status: "not found" }, error: undefined });
    render(<ProxmoxStatus service={{ proxmoxNode: "n1", proxmoxVMID: "100" }} />);
    expect(screen.getByText("docker.not_found")).toBeInTheDocument();
  });

  it("renders a dot status when style=dot", () => {
    useWidgetWS.mockReturnValue({ data: { status: "running" }, error: undefined });

    const { container } = render(<ProxmoxStatus service={{ proxmoxNode: "n1", proxmoxVMID: "100" }} style="dot" />);

    expect(container.querySelector(".rounded-full")).toBeTruthy();
    expect(screen.queryByText("docker.running")).not.toBeInTheDocument();
  });
});
