import { useEffect } from "react";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";

const WINDOW_KEY = "tessellum-window";

interface WindowStateOptions {
    minWidth: number;
    minHeight: number;
}

/**
 * Restores the window size/maximized state on mount and persists it on
 * resize/move, guarding against stale collapsed dimensions.
 */
export function useWindowStatePersistence({ minWidth, minHeight }: WindowStateOptions) {
    useEffect(() => {
        const appWindow = getCurrentWindow();
        const isUsableDimension = (value: unknown, min: number): value is number =>
            typeof value === "number" && Number.isFinite(value) && value >= min;

        const restore = async () => {
            try {
                const raw = localStorage.getItem(WINDOW_KEY);
                if (raw) {
                    const state = JSON.parse(raw) as {
                        width?: number;
                        height?: number;
                        isMaximized?: boolean;
                    };
                    if (state.isMaximized) {
                        await appWindow.maximize();
                        return;
                    }
                    if (isUsableDimension(state.width, minWidth) && isUsableDimension(state.height, minHeight)) {
                        await appWindow.setSize(new LogicalSize(state.width, state.height));
                    }
                }

                // Recover from stale persisted tiny sizes (custom state or plugin state).
                const size = await appWindow.outerSize();
                if (size.width < minWidth || size.height < minHeight) {
                    await appWindow.setSize(new LogicalSize(minWidth, minHeight));
                }
            } catch (e) {
                console.error(e);
            }
        };

        const persist = async () => {
            try {
                const isMaximized = await appWindow.isMaximized();
                const size = await appWindow.outerSize();
                if (size.width < minWidth || size.height < minHeight) {
                    // Ignore transient tiny dimensions to avoid restoring collapsed windows.
                    return;
                }
                localStorage.setItem(WINDOW_KEY, JSON.stringify({
                    width: size.width,
                    height: size.height,
                    isMaximized,
                }));
            } catch (e) {
                console.error(e);
            }
        };

        restore();
        const unlistenResize = appWindow.listen("tauri://resize", persist);
        const unlistenMove = appWindow.listen("tauri://move", persist);
        return () => {
            unlistenResize.then((f) => f());
            unlistenMove.then((f) => f());
        };
    }, [minWidth, minHeight]);
}
