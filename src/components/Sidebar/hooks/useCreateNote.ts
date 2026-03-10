import { useCallback } from 'react';
import { useEditorStore } from '../../../stores/editorStore.ts';
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { FileMetadata } from "../../../types.ts";

export function useCreateNote() {
    // 1. Get files from store
    const { files, setFiles, setActiveNote, vaultPath, toggleFolder } = useEditorStore();

    return useCallback(async (parentPath?: string) => {
        const targetDir = parentPath ?? vaultPath;

        if (!targetDir) {
            toast.error("No folder selected");
            return;
        }

        try {
            const newPath = await invoke<string>('create_note', {
                vaultPath: targetDir,
                title: 'Untitled'
            });

            const filename = (newPath.split(/[\\/]/).pop()) || 'Untitled.md';

            const newNote: FileMetadata = {
                path: newPath,
                filename: filename,
                is_dir: false,
                size: 0,
                last_modified: Math.floor(Date.now() / 1000)
            };

            if (parentPath) {
                toggleFolder(parentPath, true);
            }

            // --- THE FIX ---
            // 1. Safety check: ensure 'files' is an array (fallback to []) to prevent crash
            const currentFiles = Array.isArray(files) ? files : [];

            // 2. Create the new array first
            const updatedFiles = [...currentFiles, newNote];

            // 3. Pass the array directly (not a function)
            setFiles(updatedFiles);

            setActiveNote(newNote);
            toast.success("New note created");
        } catch (e) {
            console.error(e);
            toast.error("Failed to create note");
        }
    }, [files, vaultPath, setFiles, setActiveNote, toggleFolder]);
}