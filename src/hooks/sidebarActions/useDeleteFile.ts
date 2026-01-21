import { useCallback } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { invoke } from "@tauri-apps/api/core";
import { ask } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { FileMetadata } from "../../types";

export function useDeleteFile() {
    const { files, setFiles, activeNote, setActiveNote, vaultPath } = useEditorStore();

    return useCallback(async (target: FileMetadata) => {
        const yes = await ask(`Are you sure you want to move "${target.filename}" to trash?`, {
            title: 'Move to Trash',
            kind: 'warning',
            okLabel: 'Move to Trash',
            cancelLabel: 'Cancel'
        });

        if (!yes) return;

        try {
            await invoke('trash_item', { itemPath: target.path, vaultPath });

            // Remove item AND its children from store
            const updatedFiles = files.filter(f =>
                f.path !== target.path && !f.path.startsWith(target.path + (target.is_dir ? "" : "/"))
            );

            setFiles(updatedFiles);

            if (activeNote && (activeNote.path === target.path || activeNote.path.startsWith(target.path))) {
                setActiveNote(null);
            }

            toast.success("Moved to trash");
        } catch (e) {
            console.error(e);
            toast.error("Failed to trash item");
        }
    }, [files, activeNote, vaultPath, setFiles, setActiveNote]);
}