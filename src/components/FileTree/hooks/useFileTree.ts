import { useMemo } from 'react';
import { useEditorStore } from '../../../stores/editorStore.ts';
import { buildFileTree } from '../../../utils/fileHelpers.ts';
import { useFolderCreation } from './useFolderCreation.ts';
import { useFileRename } from './useFileRename.ts';
import { useFileTreeActions } from './useFileTreeActions.ts';

export function useFileTree() {
    const { files } = useEditorStore();

    const folderCreation = useFolderCreation();
    const fileRename = useFileRename();
    const actions = useFileTreeActions(
        folderCreation.openForTarget,
        fileRename.open
    );

    const treeData = useMemo(() => buildFileTree(files), [files]);

    return {
        files,
        treeData,
        // Context menu state from actions
        menuState: actions.menuState,
        handleContextMenu: actions.handleContextMenu,
        closeMenu: actions.closeMenu,
        createNote: actions.createNote,
        deleteFile: actions.deleteFile,

        // Folder modal - map to expected names in Sidebar
        isFolderModalOpen: folderCreation.isOpen,
        closeFolderModal: folderCreation.close,
        handleHeaderNewFolder: folderCreation.openForRoot,
        handleContextNewFolder: actions.createFolderInContext,
        handleCreateFolderConfirm: folderCreation.confirm,

        // Rename modal
        isRenameModalOpen: fileRename.isOpen,
        closeRenameModal: fileRename.close,
        renameTarget: fileRename.target,
        handleContextRename: actions.renameInContext,
        handleRenameConfirm: fileRename.confirm,
        getRenameInitialValue: fileRename.getInitialValue,

        // Context menu actions
        handleContextCreateNote: actions.createNoteInContext,
    };
}
