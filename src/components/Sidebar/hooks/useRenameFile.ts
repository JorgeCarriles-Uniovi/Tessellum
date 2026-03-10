import { useCallback } from 'react';
import { useEditorStore } from '../../../stores/editorStore.ts';
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { FileMetadata } from "../../../types.ts";

export function useRenameFile() {
    const { files, setFiles, activeNote, setActiveNote, vaultPath } = useEditorStore();

    // CHANGED: Now accepts 'newName' directly from your Modal
    return useCallback(async (target: FileMetadata, newName: string) => {

        // Safety check
        if (!newName || newName === target.filename) return;

        try {
            // 1. Backend Rename
            const newPath = await invoke<string>('rename_file', {
                vaultPath: vaultPath,
                oldPath: target.path,
                newName: newName
            });

            // 2. Calculate proper filename (e.g. "my-file.md")
            const finalFilename = newPath.split(/[\\/]/).pop() || newName;

            const updatedNote = {
                ...target,
                path: newPath,
                filename: finalFilename
            };

            // 3. Update Store Safely
            const currentFiles = files || [];
            const updatedFiles = currentFiles.map((f) =>
                f.path === target.path ? updatedNote : f
            );

            setFiles([...updatedFiles]);

            // 4. Update Active Note
            if (activeNote?.path === target.path) {
                setActiveNote(updatedNote);
            }

            toast.success("Renamed successfully");

        } catch (e) {
            console.error("Rename Error:", e);
            toast.error("Rename failed");
        }
    }, [vaultPath, files, setFiles, activeNote, setActiveNote]);
}