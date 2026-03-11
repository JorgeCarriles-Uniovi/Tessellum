import { useCallback } from 'react';
import { useEditorStore } from '../../../stores/editorStore.ts';
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { FileMetadata } from "../../../types.ts";

export function useCreateNoteFromTemplate() {
    const { files, setFiles, setActiveNote, vaultPath, toggleFolder } = useEditorStore();

    return useCallback(async (templatePath: string, title: string, parentPath?: string) => {
        const targetDir = parentPath ?? vaultPath;

        if (!vaultPath || !targetDir) {
            toast.error("No folder selected");
            return;
        }

        if (!title.trim()) {
            toast.error("Title cannot be empty");
            return;
        }

        try {
            const newPath = await invoke<string>('create_note_from_template', {
                vaultPath,
                targetDir,
                templatePath,
                title
            });

            const filename = (newPath.split(/[\\/]/).pop()) || `${title}.md`;

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

            const currentFiles = Array.isArray(files) ? files : [];
            const updatedFiles = [...currentFiles, newNote];
            setFiles(updatedFiles);

            setActiveNote(newNote);
            toast.success("New note created from template");
        } catch (e) {
            console.error(e);
            toast.error("Failed to create note from template");
        }
    }, [files, vaultPath, setFiles, setActiveNote, toggleFolder]);
}
