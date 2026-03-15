import { useCallback } from 'react';
import { useUiStore, useVaultStore } from "../../../stores";
import { toast } from "sonner";
import { createNoteFromTemplateInDir } from "../../../utils/noteUtils";

export function useCreateNoteFromTemplate() {
    const { addFileIfMissing, setActiveNote, vaultPath } = useVaultStore();
    const { toggleFolder } = useUiStore();

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
            const newNote = await createNoteFromTemplateInDir(vaultPath, targetDir, templatePath, title);

            if (parentPath) {
                toggleFolder(parentPath, true);
            }

            addFileIfMissing(newNote);
            setActiveNote(newNote);
            toast.success("New note created from template");
        } catch (e) {
            console.error(e);
            toast.error("Failed to create note from template");
        }
    }, [addFileIfMissing, vaultPath, setActiveNote, toggleFolder]);
}
