import type { TessellumApp } from "../TessellumApp";
import type { EventRef } from "../types";
import type { FileMetadata } from "../../types";
import { useEditorStore } from "../../stores/editorStore";

/**
 * Wraps the editor store for workspace-level operations.
 * Plugins use this instead of importing the Zustand store directly.
 */
export class WorkspaceAPI {
    private app: TessellumApp;

    constructor(app: TessellumApp) {
        this.app = app;
    }

    /** Get the current vault path, or null. */
    getVaultPath(): string | null {
        return useEditorStore.getState().vaultPath;
    }

    /** Get the currently active note, or null. */
    getActiveNote(): FileMetadata | null {
        return useEditorStore.getState().activeNote;
    }

    /** Navigate to a note by setting it as the active note. */
    openNote(path: string): void {
        const state = useEditorStore.getState();
        const file = state.files.find((f) => f.path === path);
        if (file) {
            state.setActiveNote(file);
        }
    }

    /** Subscribe to active note changes. Returns EventRef for auto-cleanup. */
    onActiveNoteChange(cb: (note: FileMetadata | null) => void): EventRef {
        return this.app.events.on("workspace:active-note-change", cb);
    }
}
