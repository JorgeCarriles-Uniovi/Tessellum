import { useCreateNote,
        useDeleteFile,
        useRenameFile
        } from "./sidebarActions"

export function useSidebarActions() {
    // --- 1. Create Note ---
    const createNote = useCreateNote();

    // --- 2. Delete File/Folder ---
    const deleteFile = useDeleteFile();

    // --- 3. Rename File/Folder ---
    const renameFile = useRenameFile();

    return { createNote: createNote, deleteFile, renameFile };
}