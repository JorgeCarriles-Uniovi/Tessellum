import { useCallback } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { FileMetadata } from "../../types";

export function useRenameFile() {
    const { files, setFiles, activeNote, setActiveNote, vaultPath } = useEditorStore();

    return useCallback(async (target: FileMetadata) => {

        const defaultName = target.is_dir ? target.filename : target.filename.replace(/\.md$/, '');
        const newName = window.prompt("Rename to:", defaultName);
        if ((newName == null) || newName === defaultName) return;

        try {
            const newPath = await invoke<string>('rename_file', {
                vaultPath: vaultPath,
                oldPath: target.path,
                newName: newName
            });

            const updatedNote = { ...target, path: newPath, filename: newName + (target.is_dir ? "" : ".md") };

            const updatedFiles = files.map(function(f) { return f.path === target.path ? updatedNote : f });

            setFiles(updatedFiles);

            if (activeNote?.path === target.path) setActiveNote(updatedNote);

            toast.success("Renamed");
        } catch (e) {
            toast.error("Rename failed");
        }
    }, [vaultPath, files, setFiles, activeNote?.path, setActiveNote]);
}