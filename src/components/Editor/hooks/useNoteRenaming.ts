import { useEditorStore } from "../../../stores/editorStore.ts";
import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

// --- Helpers: Pure logic separated from the hook ---

// Converts "My Note.md" -> "My Note" (Only for files)
const toInputName = (filename: string, isDir: boolean) =>
    isDir ? filename : filename.replace(/\.md$/i, '');

// Converts "My Note" -> "My Note.md" (Only for files)
const toStorageName = (name: string, isDir: boolean) =>
    isDir ? name : ""+name+".md";


export function useNoteRenaming() {
    const { activeNote, renameFile, vaultPath } = useEditorStore();
    const [titleInput, setTitleInput] = useState("");

    // 1. Sync local state when active note changes
    useEffect(() => {
        if (!activeNote) {
            setTitleInput("");
            return;
        }
        setTitleInput(toInputName(activeNote.filename, activeNote.is_dir));
    }, [activeNote]);

    // 2. The Rename Action
    const handleRename = useCallback(async () => {
        if (!activeNote) return;

        const cleanName = titleInput.trim();
        const currentInputName = toInputName(activeNote.filename, activeNote.is_dir);

        // Guard: If empty or unchanged, revert and exit
        if (!cleanName || cleanName === currentInputName) {
            setTitleInput(currentInputName);
            return;
        }

        try {
            // Calculate final filename (e.g., adds .md if it's a file)
            const finalFilename = toStorageName(cleanName, activeNote.is_dir);

            // Backend: Rename on disk
            const newPath = await invoke<string>('rename_file', {
                vaultPath: vaultPath,
                oldPath: activeNote.path,
                newName: cleanName // Backend likely handles the move logic
            });

            // Store: Update State with the correct new path and filename
            renameFile(activeNote.path, newPath, finalFilename);

            toast.success("Renamed successfully");

        } catch (e: any) {
            console.error("Rename failed", e);
            toast.error(typeof e === 'string' ? e : "Failed to rename");
            // Revert on error
            setTitleInput(currentInputName);
        }
    }, [activeNote, titleInput, renameFile]);

    return { titleInput, setTitleInput, handleRename };
}