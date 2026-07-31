import { useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";

type ResizeAxis = "width" | "height" | "both";

interface ResizableFloatingPanelOptions {
    widthStorageKey: string;
    heightStorageKey: string;
    minWidth: number;
    maxWidth: number;
    defaultWidth: number;
    minHeight: number;
    maxHeight: number;
    defaultHeight: number;
}

interface DragState {
    axis: ResizeAxis;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function readStoredSize(key: string, min: number, max: number, fallback: number): number {
    const stored = localStorage.getItem(key);
    const parsed = stored ? Number.parseInt(stored, 10) : NaN;
    return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback;
}

/**
 * Sizes a floating panel anchored to the bottom-right corner of its container.
 * Dragging the left edge/top edge/corner grows the panel toward the top-left,
 * since the bottom-right corner stays pinned in place.
 */
export function useResizableFloatingPanel({
    widthStorageKey,
    heightStorageKey,
    minWidth,
    maxWidth,
    defaultWidth,
    minHeight,
    maxHeight,
    defaultHeight,
}: ResizableFloatingPanelOptions) {
    const [width, setWidth] = useState(() => readStoredSize(widthStorageKey, minWidth, maxWidth, defaultWidth));
    const [height, setHeight] = useState(() => readStoredSize(heightStorageKey, minHeight, maxHeight, defaultHeight));
    const [isResizing, setIsResizing] = useState(false);
    const dragRef = useRef<DragState | null>(null);

    useEffect(() => {
        const handleMove = (event: MouseEvent) => {
            const drag = dragRef.current;
            if (!drag) return;

            if (drag.axis === "width" || drag.axis === "both") {
                const nextWidth = clamp(drag.startWidth + (drag.startX - event.clientX), minWidth, maxWidth);
                setWidth(nextWidth);
                localStorage.setItem(widthStorageKey, String(nextWidth));
            }
            if (drag.axis === "height" || drag.axis === "both") {
                const nextHeight = clamp(drag.startHeight + (drag.startY - event.clientY), minHeight, maxHeight);
                setHeight(nextHeight);
                localStorage.setItem(heightStorageKey, String(nextHeight));
            }
        };

        const handleUp = () => {
            if (dragRef.current) {
                dragRef.current = null;
                setIsResizing(false);
                document.body.style.cursor = "";
                document.body.style.userSelect = "";
            }
        };

        window.addEventListener("mousemove", handleMove);
        window.addEventListener("mouseup", handleUp);
        return () => {
            window.removeEventListener("mousemove", handleMove);
            window.removeEventListener("mouseup", handleUp);
        };
    }, [heightStorageKey, maxHeight, maxWidth, minHeight, minWidth, widthStorageKey]);

    const startResize = (axis: ResizeAxis) => (event: ReactMouseEvent<HTMLDivElement>) => {
        event.preventDefault();
        dragRef.current = { axis, startX: event.clientX, startY: event.clientY, startWidth: width, startHeight: height };
        setIsResizing(true);
        document.body.style.cursor = axis === "width" ? "col-resize" : axis === "height" ? "row-resize" : "nwse-resize";
        document.body.style.userSelect = "none";
    };

    return { width, height, isResizing, startResize };
}
