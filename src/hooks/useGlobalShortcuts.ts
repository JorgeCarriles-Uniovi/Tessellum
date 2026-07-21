import { useEffect } from "react";
import type { FileMetadata } from "../types.ts";
import { useUiStore } from "../stores";
import type { TessellumApp } from "../plugins/TessellumApp";
import { shouldHandleClipboardFileCopyShortcut } from "../features/clipboard/clipboardCopyShortcut";
import { resolveClipboardSelection } from "../features/clipboard/clipboardSelection";

interface GlobalShortcutOptions {
    app: TessellumApp;
    files: FileMetadata[];
    selectedFilePaths: string[];
    activeNotePath: string | undefined;
    viewMode: string;
    setViewMode: (mode: "graph" | "editor") => void;
    toggleSidebar: () => void;
    toggleCommandPalette: () => void;
    closeTab: (path: string) => void;
    clipboardFilePaste: {
        shouldHandleShortcutPaste: (target: HTMLElement | null) => boolean;
        handleShortcutPaste: (target: HTMLElement | null) => Promise<unknown>;
    };
    clipboardFileCopy: {
        copyPaths: (paths: string[]) => Promise<unknown>;
    };
}

/** App-wide keyboard shortcuts and the native context-menu blocker. */
export function useGlobalShortcuts({
    app,
    files,
    selectedFilePaths,
    activeNotePath,
    viewMode,
    setViewMode,
    toggleSidebar,
    toggleCommandPalette,
    closeTab,
    clipboardFilePaste,
    clipboardFileCopy,
}: GlobalShortcutOptions) {
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const isMac = navigator.platform.toLowerCase().includes("mac");
            const modifier = isMac ? event.metaKey : event.ctrlKey;
            const target = event.target as HTMLElement | null;
            const key = event.key.toLowerCase();

            if (!modifier) return;

            switch (key) {
                case "k":
                    event.preventDefault();
                    toggleCommandPalette();
                    return;
                case "p":
                    event.preventDefault();
                    useUiStore.getState().toggleSearch();
                    return;
                case "t":
                    event.preventDefault();
                    app.events.emit("ui:new-note");
                    return;
                case "j":
                    event.preventDefault();
                    toggleSidebar();
                    return;
                case "g":
                    if (event.shiftKey || event.altKey) return;
                    event.preventDefault();
                    setViewMode(viewMode === "graph" ? "editor" : "graph");
                    return;
                case "v":
                    if (!clipboardFilePaste.shouldHandleShortcutPaste(target)) return;
                    event.preventDefault();
                    void clipboardFilePaste.handleShortcutPaste(target);
                    return;
                case "c": {
                    if (!shouldHandleClipboardFileCopyShortcut(target)) return;
                    const pathsToCopy = resolveClipboardSelection(files, selectedFilePaths);
                    if (pathsToCopy.length === 0) return;
                    event.preventDefault();
                    void clipboardFileCopy.copyPaths(pathsToCopy);
                    return;
                }
                case ",":
                    event.preventDefault();
                    app.events.emit("ui:open-settings");
                    return;
                case "w":
                    if (!activeNotePath) return;
                    event.preventDefault();
                    closeTab(activeNotePath);
                    return;
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [
        app,
        files,
        selectedFilePaths,
        activeNotePath,
        viewMode,
        setViewMode,
        toggleSidebar,
        toggleCommandPalette,
        closeTab,
        clipboardFilePaste,
        clipboardFileCopy,
    ]);

    // Prevent native webview context actions like refresh/inspect on right-click.
    useEffect(() => {
        const blockContextMenu = (event: MouseEvent) => event.preventDefault();
        window.addEventListener("contextmenu", blockContextMenu);
        return () => window.removeEventListener("contextmenu", blockContextMenu);
    }, []);
}
