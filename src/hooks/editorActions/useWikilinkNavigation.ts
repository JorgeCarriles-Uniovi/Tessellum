import {useEditorStore} from "../../stores/editorStore.ts";
import {useCallback} from "react";
import {dirname} from "@tauri-apps/api/path";
import {invoke} from "@tauri-apps/api/core";
import {FileMetadata} from "../../types.ts";
import {toast} from "sonner";

export function useWikiLinkNavigation() {
    const { activeNote, files, setActiveNote, setFiles } = useEditorStore();

    return useCallback(async (linkText: string) => {
        if (!activeNote) return;

        try {
            // 1. Sanitize Input
            const rawName = linkText.trim();
            if (!rawName) return;

            // This throws an error if malicious, or returns a clean string if messy
            const targetName = sanitizeFilename(rawName);

            // If the name became empty after sanitization (e.g. "[[???]]"), stop.
            if (!targetName) {
                return;
            }

            const targetFilename = `${targetName}.md`;

            // 2. Check if exists (Using the CLEAN name)
            const existingFile = files.find(f =>
                f.filename.toLowerCase() === targetFilename.toLowerCase()
            );

            if (existingFile) {
                setActiveNote(existingFile);
                return;
            }

            // 3. Create New Note

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

        } catch (e: any) {
            toast.error(e.message || "Failed to open link");
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