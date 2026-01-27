import { useMemo } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { buildFileTree } from '../utils/fileHelpers';
import { useFolderCreation } from './useFolderCreation';
import { useFileRename } from './useFileRename';
import { useFileTreeActions } from './useFileTreeActions';

export function useFileTree() {
    const { files } = useEditorStore();

    // Sub-hooks for specific concerns
    const folderCreation = useFolderCreation();
    const fileRename = useFileRename();
    const actions = useFileTreeActions(
        folderCreation.openForTarget,
        fileRename.open
    );

    // Derived data
    const treeData = useMemo(() => buildFileTree(files), [files]);

    return {
        // Data
        files,
        treeData,
        menuState: actions.menuState,

        // Context menu actions
        handleContextMenu: actions.handleContextMenu,
        closeMenu: actions.closeMenu,
        createNote: actions.createNote,
        deleteFile: actions.deleteFile,
        handleContextCreateNote: actions.createNoteInContext,
        handleContextNewFolder: actions.createFolderInContext,
        handleContextRename: actions.renameInContext,

        // Folder creation
        isFolderModalOpen: folderCreation.isOpen,
        setIsFolderModalOpen: folderCreation.close,
        handleHeaderNewFolder: folderCreation.openForRoot,
        handleCreateFolderConfirm: folderCreation.confirm,

        // File rename
        isRenameModalOpen: fileRename.isOpen,
        setIsRenameModalOpen: fileRename.close,
        renameTarget: fileRename.target,
        handleRenameConfirm: fileRename.confirm,
        getRenameInitialValue: fileRename.getInitialValue
    };
}