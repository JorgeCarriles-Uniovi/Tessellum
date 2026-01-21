import { useCallback } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { FileMetadata } from "../../types";

export function useRenameFile() {
    const { files, setFiles, activeNote, setActiveNote } = useEditorStore();

    return useCallback(async (target: FileMetadata) => {
        const newName = window.prompt("Rename to:", target.filename.replace(/\.md$/, ''));
        if (!newName || newName === target.filename) return;

        try {
            const newPath = await invoke<string>('rename_file', {
                oldPath: target.path,
                newName: newName
            });

            const updatedNote = { ...target, path: newPath, filename: newName + (target.is_dir ? "" : ".md") };

            const updatedFiles = files.map(f => f.path === target.path ? updatedNote : f);

            setFiles(updatedFiles);

            if (activeNote?.path === target.path) setActiveNote(updatedNote);

            toast.success("Renamed");
        } catch (e) {
            toast.error("Rename failed");
        }
    }, [files, activeNote, setFiles, setActiveNote]);
}