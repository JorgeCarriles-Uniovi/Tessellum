import { act, renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { useResizableSidebarWidth } from "./useResizableSidebarWidth";

describe("useResizableSidebarWidth", () => {
    test("loads a persisted width, clamps it, and resizes from the left edge", () => {
        localStorage.setItem("sidebar:left", "999");
        const { result } = renderHook(() => useResizableSidebarWidth({
            side: "left",
            storageKey: "sidebar:left",
            min: 240,
            max: 420,
            defaultWidth: 300,
        }));

        expect(result.current.sidebarWidth).toBe(420);

        act(() => {
            result.current.onResizeStart({
                preventDefault() {},
            } as never);
        });

        act(() => {
            window.dispatchEvent(new MouseEvent("mousemove", { clientX: 100 }));
        });
        expect(result.current.sidebarWidth).toBe(240);
        expect(localStorage.getItem("sidebar:left")).toBe("240");
        expect(result.current.isResizing).toBe(true);

        act(() => {
            window.dispatchEvent(new MouseEvent("mouseup"));
        });
        expect(result.current.isResizing).toBe(false);
        expect(document.body.style.cursor).toBe("");
        expect(document.body.style.userSelect).toBe("");
    });

    test("computes right-side widths from the provided right edge", () => {
        const { result } = renderHook(() => useResizableSidebarWidth({
            side: "right",
            storageKey: "sidebar:right",
            min: 200,
            max: 500,
            defaultWidth: 260,
            getRightEdge: () => 1000,
        }));

        expect(result.current.sidebarWidth).toBe(260);

        act(() => {
            result.current.onResizeStart({
                preventDefault() {},
            } as never);
        });

        act(() => {
            window.dispatchEvent(new MouseEvent("mousemove", { clientX: 650 }));
        });
        expect(result.current.sidebarWidth).toBe(350);
        expect(localStorage.getItem("sidebar:right")).toBe("350");
    });
});
