import { useCallback, useEffect, useRef, useState } from "react";

export interface Position {
    x: number;
    y: number;
}

interface UseDraggablePositionOptions {
    initial: Position;
    storageKey?: string;
}

function readStoredPosition(storageKey: string | undefined, fallback: Position): Position {
    if (!storageKey) return fallback;
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        if (typeof parsed?.x === "number" && typeof parsed?.y === "number") return parsed;
        return fallback;
    } catch {
        return fallback;
    }
}

export function useDraggablePosition({ initial, storageKey }: UseDraggablePositionOptions) {
    const [position, setPosition] = useState<Position>(() => readStoredPosition(storageKey, initial));
    const [isDragging, setIsDragging] = useState(false);
    const dragOrigin = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

    const handlePointerDown = useCallback(
        (e: React.PointerEvent) => {
            dragOrigin.current = { startX: e.clientX, startY: e.clientY, originX: position.x, originY: position.y };
            setIsDragging(true);
            (e.target as Element).setPointerCapture?.(e.pointerId);
        },
        [position],
    );

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!dragOrigin.current) return;
        const { startX, startY, originX, originY } = dragOrigin.current;
        setPosition({ x: originX + (e.clientX - startX), y: originY + (e.clientY - startY) });
    }, []);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        if (!dragOrigin.current) return;
        dragOrigin.current = null;
        setIsDragging(false);
        (e.target as Element).releasePointerCapture?.(e.pointerId);
    }, []);

    useEffect(() => {
        if (!storageKey) return;
        try {
            localStorage.setItem(storageKey, JSON.stringify(position));
        } catch {
            // localStorage unavailable (private browsing, quota) — dragging still works, just unpersisted.
        }
    }, [storageKey, position]);

    return { position, isDragging, handlePointerDown, handlePointerMove, handlePointerUp };
}
