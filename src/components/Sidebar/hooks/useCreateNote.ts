import { useCallback } from 'react';
import { useUiStore, useVaultStore } from "../../../stores";
import { toast } from "sonner";
import { createNoteInDir } from "../../../utils/noteUtils";

export function useCreateNote() {
    const { addFileIfMissing, setActiveNote, vaultPath } = useVaultStore();
    const { toggleFolder } = useUiStore();

    return useCallback(async (parentPath?: string, title: string = 'Untitled') => {
        const targetDir = parentPath ?? vaultPath;

        if (!targetDir) {
            toast.error("No folder selected");
            return;
        }

        try {
            const newNote = await createNoteInDir(targetDir, title);

            if (parentPath) {
                toggleFolder(parentPath, true);
            }

            addFileIfMissing(newNote);
            setActiveNote(newNote);
            toast.success("New note created");
        } catch (e) {
            console.error(e);
            toast.error("Failed to create note");
        }
    }, [addFileIfMissing, vaultPath, setActiveNote, toggleFolder]);
}
