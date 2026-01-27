import { useState, useCallback } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { FileMetadata } from "../types";
import { getNameWithoutExtension, ensureMarkdownExtension } from '../utils/pathUtils';
import { useEditorStore } from '../stores/editorStore';

export function useFileRename() {
    const { vaultPath, renameFile } = useEditorStore();
    const [isOpen, setIsOpen] = useState(false);
    const [target, setTarget] = useState<FileMetadata | null>(null);

    const open = useCallback((fileTarget: FileMetadata) => {
        setTarget(fileTarget);
        setIsOpen(true);
    }, []);

    const close = useCallback(() => {
        setIsOpen(false);
        setTarget(null);
    }, []);

    const getInitialValue = useCallback(() => {
        if (!target) return "";
        return getNameWithoutExtension(target.filename, target.is_dir);
    }, [target]);

    const confirm = useCallback(async (newName: string) => {
        if (!target || !vaultPath) return;

        try {
            // Backend rename
            const newPath = await invoke<string>('rename_file', {
                vaultPath,
                oldPath: target.path,
                newName
            });

            // Ensure proper filename with extension
            const finalFilename = ensureMarkdownExtension(newName, target.is_dir);

            // Update store
            renameFile(target.path, newPath, finalFilename);

            toast.success("Renamed successfully");
            close();

        } catch (e: any) {
            console.error("Rename failed", e);
            toast.error(typeof e === 'string' ? e : "Failed to rename");
        }
    }, [target, vaultPath, renameFile, close]);

    return {
        isOpen,
        target,
        open,
        close,
        confirm,
        getInitialValue
    };
}