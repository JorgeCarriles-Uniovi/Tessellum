import { invoke } from "@tauri-apps/api/core";
import type { TessellumApp } from "../TessellumApp";
import type { EventRef } from "../types";
import type { FileMetadata } from "../../types";
import { useGraphStore, useUiStore, useVaultStore } from "../../stores";

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
        return useVaultStore.getState().vaultPath;
    }

    /** Get the currently active note, or null. */
    getActiveNote(): FileMetadata | null {
        return useVaultStore.getState().activeNote;
    }

    /** Set the current vault path. */
    setVaultPath(path: string | null): void {
        const state = useVaultStore.getState();
        state.setVaultPath(path);
    }

    /** Set the active note directly. */
    setActiveNote(note: FileMetadata | null): void {
        const state = useVaultStore.getState();
        state.setActiveNote(note);
    }

    /** Set the current view mode. */
    setViewMode(mode: 'editor' | 'graph'): void {
        const state = useGraphStore.getState();
        state.setViewMode(mode);
    }

    /** Replace expanded folders map. */
    setExpandedFolders(folders: Record<string, boolean>): void {
        const state = useUiStore.getState();
        state.setExpandedFolders(folders);
    }

    /** Get backlinks for a note path. */
    async getBacklinks(path: string): Promise<string[]> {
        return invoke<string[]>("get_backlinks", { path });
    }

    /** Get outgoing links for a note path. */
    async getOutgoingLinks(path: string): Promise<string[]> {
        return invoke<string[]>("get_outgoing_links", { path });
    }

    /** Navigate to a note by setting it as the active note. */
    openNote(path: string): void {
        const vaultState = useVaultStore.getState();
        const graphState = useGraphStore.getState();
        const file = vaultState.files.find((f) => f.path === path);
        if (file) {
            vaultState.setActiveNote(file);
            graphState.setViewMode('editor');
        }
        this.onLinkClick?.(path);
    }

    /**
     * Navigate to a note by providing its metadata. Ensures it is present
     * in the workspace file list before activating.
     */
    openNoteByMetadata(file: FileMetadata): void {
        const vaultState = useVaultStore.getState();
        const graphState = useGraphStore.getState();
        vaultState.addFileIfMissing(file);
        vaultState.setActiveNote(file);
        graphState.setViewMode('editor');
    }

    onLinkClick: ((path: string) => void) | null = null;

    /** Subscribe to active note changes. Returns EventRef for auto-cleanup. */
    onActiveNoteChange(cb: (note: FileMetadata | null) => void): EventRef {
        return this.app.events.on("workspace:active-note-change", cb);
    }
}
