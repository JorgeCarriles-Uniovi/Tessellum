import { useState, useCallback } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { FileMetadata } from "../../../types.ts";
import { getNameWithoutExtension } from '../../../utils/pathUtils.ts';
import { useEditorStore } from '../../../stores/editorStore.ts';

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
                vaultPath: vaultPath,
                oldPath: target.path,
                newName: newName
            });

            // Backend decides final extension; derive displayed filename from returned path.
            const finalFilename = newPath.split(/[\\/]/).pop() || newName;

            // Update store
            renameFile(target.path, newPath, finalFilename);

            toast.success("Renamed successfully");
            close();

        } catch (e: unknown) {
            console.error("Rename failed", e);
            toast.error(typeof e === 'string' ? e : "Failed to rename");
        }
    }, [target, vaultPath, renameFile, close]);

    return {
        isOpen: isOpen,
        target,
        open,
        close,
        confirm,
        getInitialValue
    };
}