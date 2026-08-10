import { act, renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { useResizableFloatingPanel } from "./useResizableFloatingPanel";

function setup(overrides: Partial<Parameters<typeof useResizableFloatingPanel>[0]> = {}) {
    return renderHook(() => useResizableFloatingPanel({
        widthStorageKey: "panel:width",
        heightStorageKey: "panel:height",
        minWidth: 240,
        maxWidth: 560,
        defaultWidth: 290,
        minHeight: 140,
        maxHeight: 560,
        defaultHeight: 200,
        ...overrides,
    }));
}

describe("useResizableFloatingPanel", () => {
    test("loads persisted, clamped sizes on mount", () => {
        localStorage.setItem("panel:width", "999");
        localStorage.setItem("panel:height", "10");
        const { result } = setup();

        expect(result.current.width).toBe(560);
        expect(result.current.height).toBe(140);
    });

    test("dragging the left edge grows width as the mouse moves left (panel anchored on the right)", () => {
        const { result } = setup();

        act(() => {
            result.current.startResize("width")({ preventDefault() {}, clientX: 500, clientY: 300 } as never);
        });
        expect(result.current.isResizing).toBe(true);

        act(() => {
            window.dispatchEvent(new MouseEvent("mousemove", { clientX: 460, clientY: 300 }));
        });
        expect(result.current.width).toBe(330);
        expect(result.current.height).toBe(200);
        expect(localStorage.getItem("panel:width")).toBe("330");

        act(() => {
            window.dispatchEvent(new MouseEvent("mouseup"));
        });
        expect(result.current.isResizing).toBe(false);
        expect(document.body.style.cursor).toBe("");
    });

    test("dragging the top edge grows height as the mouse moves up (panel anchored on the bottom)", () => {
        const { result } = setup();

        act(() => {
            result.current.startResize("height")({ preventDefault() {}, clientX: 500, clientY: 300 } as never);
        });

        act(() => {
            window.dispatchEvent(new MouseEvent("mousemove", { clientX: 500, clientY: 250 }));
        });
        expect(result.current.height).toBe(250);
        expect(result.current.width).toBe(290);
    });

    test("dragging the corner resizes both dimensions and clamps to the max", () => {
        const { result } = setup();

        act(() => {
            result.current.startResize("both")({ preventDefault() {}, clientX: 500, clientY: 300 } as never);
        });

        act(() => {
            window.dispatchEvent(new MouseEvent("mousemove", { clientX: -100, clientY: -100 }));
        });
        expect(result.current.width).toBe(560);
        expect(result.current.height).toBe(560);
    });
});
