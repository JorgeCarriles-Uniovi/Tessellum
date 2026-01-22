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

            // Determine path separator based on the target path (supports Windows and POSIX)
            const separator = target.path.includes('\\') ? '\\' : '/';
            const childPrefix = target.path + separator;
            // Remove item AND its children from store
            const updatedFiles = files.filter(f =>
                // Always remove the target itself
                f.path !== target.path &&
                // If target is a directory, remove its descendants with a proper boundary
                !(target.is_dir && f.path.startsWith(childPrefix))
            );
            setFiles(updatedFiles);
            if (activeNote) {
                const activeIsTarget = activeNote.path === target.path;
                const activeIsDescendant =
                    target.is_dir && activeNote.path.startsWith(childPrefix);
                if (activeIsTarget || activeIsDescendant) {
                    setActiveNote(null);
                }
                }

            toast.success("Moved to trash");
        } catch (e) {
            console.error(e);
            toast.error("Failed to trash item");
        }
    }, [files, activeNote, vaultPath, setFiles, setActiveNote]);
}