import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useDraggablePosition } from "./useDraggablePosition";

function fakeEvent(clientX: number, clientY: number) {
    return {
        clientX, clientY, pointerId: 1,
        target: { setPointerCapture: () => {}, releasePointerCapture: () => {} },
    } as unknown as React.PointerEvent;
}

describe("useDraggablePosition", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("starts at the initial position", () => {
        const { result } = renderHook(() => useDraggablePosition({ initial: { x: 16, y: 16 } }));
        expect(result.current.position).toEqual({ x: 16, y: 16 });
        expect(result.current.isDragging).toBe(false);
    });

    it("moves by the pointer delta between pointerdown and pointermove", () => {
        const { result } = renderHook(() => useDraggablePosition({ initial: { x: 16, y: 16 } }));
        act(() => result.current.handlePointerDown(fakeEvent(100, 100)));
        expect(result.current.isDragging).toBe(true);
        act(() => result.current.handlePointerMove(fakeEvent(130, 90)));
        expect(result.current.position).toEqual({ x: 46, y: 6 });
    });

    it("stops updating position after pointerup", () => {
        const { result } = renderHook(() => useDraggablePosition({ initial: { x: 0, y: 0 } }));
        act(() => result.current.handlePointerDown(fakeEvent(0, 0)));
        act(() => result.current.handlePointerMove(fakeEvent(10, 10)));
        act(() => result.current.handlePointerUp(fakeEvent(10, 10)));
        expect(result.current.isDragging).toBe(false);
        act(() => result.current.handlePointerMove(fakeEvent(999, 999)));
        expect(result.current.position).toEqual({ x: 10, y: 10 });
    });

    it("persists the dragged position to localStorage and restores it on next mount", () => {
        const { result, unmount } = renderHook(() =>
            useDraggablePosition({ initial: { x: 16, y: 16 }, storageKey: "test:dragPos" }),
        );
        act(() => result.current.handlePointerDown(fakeEvent(0, 0)));
        act(() => result.current.handlePointerMove(fakeEvent(50, 20)));
        act(() => result.current.handlePointerUp(fakeEvent(50, 20)));
        unmount();

        const { result: second } = renderHook(() =>
            useDraggablePosition({ initial: { x: 16, y: 16 }, storageKey: "test:dragPos" }),
        );
        expect(second.current.position).toEqual({ x: 66, y: 36 });
    });

    it("does not persist when no storageKey is given", () => {
        const { result } = renderHook(() => useDraggablePosition({ initial: { x: 5, y: 5 } }));
        act(() => result.current.handlePointerDown(fakeEvent(0, 0)));
        act(() => result.current.handlePointerMove(fakeEvent(20, 0)));
        act(() => result.current.handlePointerUp(fakeEvent(20, 0)));
        expect(localStorage.length).toBe(0);
    });

    it("falls back to initial when the stored value is not valid JSON", () => {
        localStorage.setItem("test:dragPos", "not valid json");
        const { result } = renderHook(() =>
            useDraggablePosition({ initial: { x: 16, y: 16 }, storageKey: "test:dragPos" }),
        );
        expect(result.current.position).toEqual({ x: 16, y: 16 });
    });

    it("falls back to initial when the stored value is valid JSON but the wrong shape", () => {
        localStorage.setItem("test:dragPos", JSON.stringify({ foo: "bar" }));
        const { result } = renderHook(() =>
            useDraggablePosition({ initial: { x: 16, y: 16 }, storageKey: "test:dragPos" }),
        );
        expect(result.current.position).toEqual({ x: 16, y: 16 });
    });
});
