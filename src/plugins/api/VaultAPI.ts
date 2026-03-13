import { invoke } from "@tauri-apps/api/core";
import type { TessellumApp } from "../TessellumApp";
import type { EventRef } from "../types";
import type { FileMetadata } from "../../types";

/**
 * Wraps Tauri vault operations behind an API surface.
 */
export class VaultAPI {
    private app: TessellumApp;

    constructor(app: TessellumApp) {
        this.app = app;
    }

    /** Get the current vault path, or null if none is open. */
    getVaultPath(): string | null {
        // Reads from the Zustand store indirectly via workspace
        return this.app.workspace.getVaultPath();
    }

    /** List all files in the vault. */
    async listFiles(): Promise<FileMetadata[]> {
        const vaultPath = this.getVaultPath();
        if (!vaultPath) return [];
        return invoke<FileMetadata[]>("list_files", { vaultPath });
    }

    /** Read a file's contents. */
    async readFile(path: string): Promise<string> {
        const vaultPath = this.getVaultPath();
        if (!vaultPath) {
            throw new Error("No vault path set");
        }
        return invoke<string>("read_file", { vaultPath, path });
    }

    /** Write content to a file. */
    async writeFile(path: string, content: string): Promise<void> {
        const vaultPath = this.getVaultPath();
        if (!vaultPath) {
            throw new Error("No vault path set");
        }
        return invoke<void>("write_file", { vaultPath, path, content });
    }

    /** Get indexed tags for a specific file. */
    async getFileTags(path: string): Promise<string[]> {
        return invoke<string[]>("get_file_tags", { path });
    }

    /** Subscribe to file change events. Returns EventRef for auto-cleanup. */
    onFileChange(callback: (path: string) => void): EventRef {
        return this.app.events.on("vault:file-change", callback);
    }
}
