import { useCallback } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { FileMetadata } from "../../types";

export function useCreateNote() {
    const { files, setFiles, setActiveNote, vaultPath, toggleFolder } = useEditorStore();
    return useCallback(async (parentPath?: string) => {
        // Use the passed path, or fallback to the root vault
        const targetDir = (parentPath != null) || vaultPath;

        if (!(Boolean(targetDir))) return;

        try {
            // Backend will create "Untitled.md" inside 'targetDir'
            const newPath = await invoke<string>('create_note', {
                vaultPath: targetDir,
                title: 'Untitled'
            });

            const filename = (Boolean(newPath.split(/[\\/]/).pop())) || 'Untitled.md';

            const newNote: FileMetadata = {
                path: newPath,
                filename: filename,
                is_dir: false,
                size: 0,
                last_modified: Math.floor(Date.now() / 1000)
            };

            if (parentPath != null) toggleFolder(parentPath, true);

            setFiles([...files, newNote]);
            setActiveNote(newNote);
            toast.success("New note created");
        } catch (e) {
            console.error(e);
            toast.error("Failed to create note");
        }
    }, [files, vaultPath, setFiles, setActiveNote, toggleFolder]);
}