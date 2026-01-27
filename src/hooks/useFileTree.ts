import { useMemo, useState, useCallback } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { buildFileTree } from '../utils/fileHelpers';
import { useSidebarActions, useContextMenu } from '../hooks';
import { useCreateFolder } from './editorActions';
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { FileMetadata } from "../types";

export function useFileTree() {
    const { files, vaultPath, renameFile } = useEditorStore();

    // 1. Core Actions
    const { createNote, deleteFile } = useSidebarActions(); // Removed simple renameFile, we use the complex one here
    const createFolder = useCreateFolder();
    const { menuState, handleContextMenu, closeMenu } = useContextMenu();

    // 2. State: Create Folder Modal
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
    const [folderTarget, setFolderTarget] = useState<string | undefined>(undefined);

    // 3. State: Rename Modal (New)
    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
    const [renameTarget, setRenameTarget] = useState<FileMetadata | null>(null);

    // --- Transform Data ---
    const treeData = useMemo(() => buildFileTree(files), [files]);

    // ===========================
    // Folder Creation Logic
    // ===========================

    const handleHeaderNewFolder = useCallback(() => {
        setFolderTarget(undefined);
        setIsFolderModalOpen(true);
    }, []);

    const handleContextNewFolder = useCallback(() => {
        if (menuState?.target) {
            const path = menuState.target.is_dir
                ? menuState.target.path
                : menuState.target.path.substring(0, menuState.target.path.lastIndexOf(menuState.target.path.includes('\\') ? '\\' : '/'));

            setFolderTarget(path);
            setIsFolderModalOpen(true);
            closeMenu();
        }
    }, [menuState, closeMenu]);

    const handleCreateFolderConfirm = useCallback(async (name: string) => {
        await createFolder(name, folderTarget);
        setIsFolderModalOpen(false);
    }, [createFolder, folderTarget]);

    // ===========================
    // Renaming Logic (New)
    // ===========================

    // Triggered from Context Menu
    const handleContextRename = useCallback(() => {
        if (menuState?.target) {
            setRenameTarget(menuState.target);
            setIsRenameModalOpen(true);
            closeMenu();
        }
    }, [menuState, closeMenu]);

    // Executed when Modal Confirms
    const handleRenameConfirm = useCallback(async (newName: string) => {
        if (!renameTarget || !vaultPath) return;

        try {
            // 1. Backend Rename
            const newPath = await invoke<string>('rename_file', {
                vaultPath,
                oldPath: renameTarget.path,
                newName
            });

            // 2. Logic to keep extension in the store if it's a file
            const finalFilename = renameTarget.is_dir
                ? newName
                : newName.endsWith('.md') ? newName : `${newName}.md`;

            // 3. Store Update
            renameFile(renameTarget.path, newPath, finalFilename);

            toast.success("Renamed successfully");
            setIsRenameModalOpen(false);
            setRenameTarget(null);

        } catch (e: any) {
            console.error("Rename failed", e);
            toast.error(typeof e === 'string' ? e : "Failed to rename");
        }
    }, [renameTarget, vaultPath, renameFile]);

    // Helper for input default value
    const getRenameInitialValue = useCallback(() => {
        if (!renameTarget) return "";
        return renameTarget.is_dir
            ? renameTarget.filename
            : renameTarget.filename.replace(/\.md$/i, '');
    }, [renameTarget]);

    // ===========================
    // Other Context Actions
    // ===========================

    const handleContextCreateNote = useCallback(async () => {
        if (!menuState?.target) return;
        const { target } = menuState;
        let parentPath = "";

        if (target.is_dir) {
            parentPath = target.path;
        } else {
            const separator = target.path.includes('\\') ? '\\' : '/';
            parentPath = target.path.substring(0, target.path.lastIndexOf(separator));
        }

        await createNote(parentPath);
        closeMenu();
    }, [menuState, createNote, closeMenu]);

    return {
        // Data
        files,
        treeData,
        menuState,

        // Actions
        handleContextMenu,
        closeMenu,
        createNote,
        deleteFile,

        // Folder Modal
        isFolderModalOpen,
        setIsFolderModalOpen, // Exposed setter for closing via prop if needed
        handleHeaderNewFolder,
        handleContextNewFolder,
        handleCreateFolderConfirm,

        // Rename Modal
        isRenameModalOpen,
        setIsRenameModalOpen,
        renameTarget,
        handleContextRename,
        handleRenameConfirm,
        getRenameInitialValue,

        // Misc
        handleContextCreateNote
    };
}