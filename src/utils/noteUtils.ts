import { invoke } from "@tauri-apps/api/core";
import type { FileMetadata } from "../types";

export function getFilenameFromPath(path: string): string | null {
    if (!path) return null;
    const normalized = path.replace(/\\/g, "/");
    const parts = normalized.split("/").filter(Boolean);
    if (parts.length === 0) return null;
    return parts[parts.length - 1] || null;
}

export function buildNoteMetadata(path: string, fallbackFilename: string): FileMetadata {
    const filename = getFilenameFromPath(path) || fallbackFilename;
    return {
        path,
        filename,
        is_dir: false,
        size: 0,
        last_modified: Math.floor(Date.now() / 1000),
    };
}

export async function createNoteInDir(targetDir: string, title: string): Promise<FileMetadata> {
    const newPath = await invoke<string>("create_note", {
        vaultPath: targetDir,
        title,
    });
    const fallbackFilename = `${title}.md`;
    return buildNoteMetadata(newPath, fallbackFilename);
}

export async function createNoteFromTemplateInDir(
    vaultPath: string,
    targetDir: string,
    templatePath: string,
    title: string
): Promise<FileMetadata> {
    const newPath = await invoke<string>("create_note_from_template", {
        vaultPath,
        targetDir,
        templatePath,
        title,
    });
    const fallbackFilename = `${title}.md`;
    return buildNoteMetadata(newPath, fallbackFilename);
}
