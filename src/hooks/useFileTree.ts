import { useMemo, useState, useCallback } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { buildFileTree } from '../utils/fileHelpers';
import { useSidebarActions, useContextMenu } from '../hooks';
import { useCreateFolder } from './editorActions';

export function useFileTree() {
    const { files } = useEditorStore();
    
    // Sidebar actions (create, delete, rename)
    const { createNote, deleteFile, renameFile } = useSidebarActions();
    const createFolder = useCreateFolder();
    const { menuState, handleContextMenu, closeMenu } = useContextMenu();

    // Folder creation modal state
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
    const [folderTarget, setFolderTarget] = useState<string | undefined>(undefined);

    // Transform flat file list to tree structure
    const treeData = useMemo(() => buildFileTree(files), [files]);

    // Handle new folder from header (creates at root)
    const handleHeaderNewFolder = useCallback(() => {
        setFolderTarget(undefined);
        setIsFolderModalOpen(true);
    }, []);

    // Handle new folder from context menu
    const handleContextNewFolder = useCallback(() => {
        if (menuState?.target) {
            const path = menuState.target.is_dir
                ? menuState.target.path
                : menuState.target.path.substring(
                    0,
                    menuState.target.path.lastIndexOf(
                        menuState.target.path.includes('\\') ? '\\' : '/'
                    )
                );

            setFolderTarget(path);
            setIsFolderModalOpen(true);
            closeMenu();
        }
    }, [menuState, closeMenu]);

    // Handle folder creation confirmation
    const handleCreateFolderConfirm = useCallback(async (name: string) => {
        await createFolder(name, folderTarget);
        setIsFolderModalOpen(false);
    }, [createFolder, folderTarget]);

    // Handle creating note from context menu
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

    // Handle closing the folder modal
    const closeFolderModal = useCallback(() => {
        setIsFolderModalOpen(false);
    }, []);

    return {
        // Data
        files,
        treeData,
        
        // Context menu
        menuState,
        handleContextMenu,
        closeMenu,
        
        // File operations
        createNote,
        deleteFile,
        renameFile,
        
        // Folder modal
        isFolderModalOpen,
        closeFolderModal,
        handleHeaderNewFolder,
        handleContextNewFolder,
        handleCreateFolderConfirm,
        handleContextCreateNote,
    };
}
