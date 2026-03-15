import { useVaultStore } from "../../../stores";
import { useCallback } from "react";
import { dirname } from "@tauri-apps/api/path";
import { toast } from "sonner";
import { clearWikiLinkCacheEffect } from "../extensions/wikilink/wikiLink-plugin";
import { TessellumApp } from "../../../plugins/TessellumApp";
import { createNoteInDir } from "../../../utils/noteUtils";

export function useWikiLinkNavigation() {
    const { activeNote, setActiveNote, addFileIfMissing } = useVaultStore();

    return useCallback(async (linkTarget: string) => {
        if (!activeNote) return;

        try {
            const rawTarget = linkTarget.trim();
            if (!rawTarget) return;

            // Normalize path separators if it's an absolute path or has them
            const normalizedLinkTarget = rawTarget.replace(/\\/g, '/');

            // Get fresh files list from store
            const { files } = useVaultStore.getState();

            // 1. Check if it's an absolute path and exists in store
            const fileByPath = files.find(f => f.path === normalizedLinkTarget);
            if (fileByPath) {
                setActiveNote(fileByPath);
                return;
            }

            // 2. Sanitize Input for filename matching / creation
            let targetName: string;
            try {
                targetName = sanitizeFilename(normalizedLinkTarget);
            } catch (e) {
                if (normalizedLinkTarget.includes('/')) {
                    const parts = normalizedLinkTarget.split('/');
                    targetName = sanitizeFilename(parts[parts.length - 1]);
                } else {
                    throw e;
                }
            }

            if (!targetName) {
                return;
            }

            // Remove existing .md if present to avoid doubling
            const cleanStem = targetName.replace(/\.md$/i, '');
            const targetFilename = `${cleanStem}.md`;

            // 3. Check if exists by filename
            const existingFile = files.find(f =>
                f.filename.toLowerCase() === targetFilename.toLowerCase()
            );

            if (existingFile) {
                setActiveNote(existingFile);
                return;
            }

            // 4. Create New Note
            const vaultPath = await dirname(activeNote.path);

            const newNote = await createNoteInDir(vaultPath, cleanStem);

            addFileIfMissing(newNote);
            setActiveNote(newNote);

            // 5. Clear wikilink cache in the editor so it re-resolves immediately
            const view = TessellumApp.instance.editor.getActiveView();
            if (view) {
                view.dispatch({
                    effects: clearWikiLinkCacheEffect.of(undefined)
                });
            }

        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : "Failed to open link";
            toast.error(message);
        }
    }, [activeNote, setActiveNote, addFileIfMissing]);
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
