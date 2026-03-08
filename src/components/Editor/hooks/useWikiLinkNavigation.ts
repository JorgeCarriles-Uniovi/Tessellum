import { useEditorStore } from "../../../stores/editorStore.ts";
import { useCallback } from "react";
import { dirname } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
import { FileMetadata } from "../../../types.ts";
import { toast } from "sonner";

export function useWikiLinkNavigation() {
    const { activeNote, files, setActiveNote, setFiles } = useEditorStore();

    return useCallback(async (linkTarget: string) => {
        if (!activeNote) return;

        try {
            const rawTarget = linkTarget.trim();
            if (!rawTarget) return;

            // 1. Check if it's an absolute path and exists in store
            // This happens when the wikilink plugin resolves the link to a full path
            const fileByPath = files.find(f => f.path === rawTarget);
            if (fileByPath) {
                setActiveNote(fileByPath);
                return;
            }

            // 2. Sanitize Input for filename matching / creation
            // This throws an error if malicious, or returns a clean string if messy
            let targetName: string;
            try {
                targetName = sanitizeFilename(rawTarget);
            } catch (e) {
                // If sanitization fails (e.g. because it's a path with slashes that wasn't found above),
                // we might want to try to extract just the filename
                if (rawTarget.includes('/') || rawTarget.includes('\\')) {
                    const parts = rawTarget.replace(/\\/g, '/').split('/');
                    targetName = sanitizeFilename(parts[parts.length - 1]);
                } else {
                    throw e;
                }
            }

            // If the name became empty after sanitization (e.g. "[[???]]"), stop.
            if (!targetName) {
                return;
            }

            const targetFilename = `${targetName}.md`;

            // 3. Check if exists by filename (Using the CLEAN name)
            const existingFile = files.find(f =>
                f.filename.toLowerCase() === targetFilename.toLowerCase()
            );

            if (existingFile) {
                setActiveNote(existingFile);
                return;
            }

            // 4. Create New Note

            const vaultPath = await dirname(activeNote.path);

            const newPath = await invoke<string>('create_note', {
                vaultPath,
                title: targetName // Pass the sanitized name
            });

            const newNote: FileMetadata = {
                path: newPath,
                filename: targetFilename,
                is_dir: false,
                size: 0,
                last_modified: Math.floor(Date.now() / 1000)
            };

            setFiles([...files, newNote]);
            setActiveNote(newNote);

        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : "Failed to open link";
            toast.error(message);
        }
    }, [activeNote, files, setActiveNote, setFiles]);
}

function sanitizeFilename(name: string): string {
    // 1. Remove dangerous control characters
    let cleanName = name.replace(/[\x00-\x1F]/g, '');

    // 2. SECURITY CRITICAL: Block Traversal
    if (cleanName.includes('..')) {
        throw new Error("Invalid WikiLink: '..' sequence is not allowed");
    }

    // Block slashes (Folder separators)
    if (cleanName.includes('/') || cleanName.includes('\\')) {
        throw new Error("Invalid WikiLink: Path separators are not allowed");
    }

    cleanName = cleanName.replace(/[^a-zA-Z0-9 \-_\(\)\.]/g, '');

    // 4. Windows Safety: Trim trailing dots/spaces
    // "Note." is invalid on Windows. "Note" is valid.
    cleanName = cleanName.replace(/[. ]+$/, "");

    return cleanName;
}