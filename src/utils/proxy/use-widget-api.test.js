// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useWidgetWS } = vi.hoisted(() => ({ useWidgetWS: vi.fn() }));

vi.mock("./use-widget-ws", () => ({
  default: useWidgetWS,
}));

import useWidgetAPI from "./use-widget-api";

describe("utils/proxy/use-widget-api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("formats the proxy url and passes refreshInterval when provided in options", () => {
    useWidgetWS.mockReturnValue({ data: { ok: true }, error: undefined, mutate: "m" });

    const widget = { service_group: "g", service_name: "s", index: 0 };
    const { result } = renderHook(() => useWidgetAPI(widget, "status", { refreshInterval: 123, foo: "bar" }));

    expect(useWidgetWS).toHaveBeenCalledWith(
      "proxy:g:s:0:status",
      expect.stringContaining("/api/services/proxy?"),
      expect.objectContaining({ refreshInterval: 123 }),
    );
    expect(result.current.data).toEqual({ ok: true });
    expect(result.current.error).toBeUndefined();
    expect(result.current.mutate).toBe("m");
  });

  it("returns data.error as the top-level error", () => {
    const dataError = { message: "nope" };
    useWidgetWS.mockReturnValue({ data: { error: dataError }, error: undefined, mutate: vi.fn() });

    const widget = { service_group: "g", service_name: "s", index: 0 };
    const { result } = renderHook(() => useWidgetAPI(widget, "status", {}));

    expect(result.current.error).toBe(dataError);
  });

  it("disables the request when endpoint is an empty string", () => {
    useWidgetWS.mockReturnValue({ data: undefined, error: undefined, mutate: vi.fn() });

    const widget = { service_group: "g", service_name: "s", index: 0 };
    renderHook(() => useWidgetAPI(widget, ""));

    expect(useWidgetWS).toHaveBeenCalledWith(null, null, { refreshInterval: undefined });
  });
});
