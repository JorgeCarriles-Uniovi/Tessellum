import { useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";

type SidebarSide = "left" | "right";

interface ResizableSidebarOptions {
    side: SidebarSide;
    storageKey: string;
    min: number;
    max: number;
    defaultWidth: number;
    getRightEdge?: () => number;
}

function clampWidth(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

export function useResizableSidebarWidth({
                                             side,
                                             storageKey,
                                             min,
                                             max,
                                             defaultWidth,
                                             getRightEdge,
                                         }: ResizableSidebarOptions) {
    const [sidebarWidth, setSidebarWidth] = useState(() => {
        const stored = localStorage.getItem(storageKey);
        const parsed = stored ? Number.parseInt(stored, 10) : NaN;
        return Number.isFinite(parsed) ? clampWidth(parsed, min, max) : defaultWidth;
    });
    const [isResizing, setIsResizing] = useState(false);
    const isResizingRef = useRef(false);

    useEffect(() => {
        const handleMove = (event: MouseEvent) => {
            if (!isResizingRef.current) return;
            const rightEdge = getRightEdge ? getRightEdge() : window.innerWidth;
            const rawWidth = side === "left"
                ? event.clientX
                : rightEdge - event.clientX;
            const nextWidth = clampWidth(rawWidth, min, max);
            setSidebarWidth(nextWidth);
            localStorage.setItem(storageKey, String(nextWidth));
        };

        const handleUp = () => {
            if (isResizingRef.current) {
                isResizingRef.current = false;
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
    }, [getRightEdge, max, min, side, storageKey]);

    const onResizeStart = (event: ReactMouseEvent<HTMLDivElement>) => {
        event.preventDefault();
        isResizingRef.current = true;
        setIsResizing(true);
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
    };

    return { sidebarWidth, isResizing, onResizeStart };
}
