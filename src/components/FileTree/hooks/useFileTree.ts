import { useEditorStore } from '../../../stores/editorStore.ts';
import { useFolderCreation } from './useFolderCreation.ts';
import { useFileRename } from './useFileRename.ts';
import { useFileTreeActions } from './useFileTreeActions.ts';

export function useFileTree() {
    const { files, fileTree } = useEditorStore();

    const folderCreation = useFolderCreation();
    const fileRename = useFileRename();
    const actions = useFileTreeActions(
        folderCreation.openForTarget,
        fileRename.open
    );

    return {
        files,
        treeData: fileTree,
        // Context menu state from actions
        menuState: actions.menuState,
        handleContextMenu: actions.handleContextMenu,
        closeMenu: actions.closeMenu,
        createNote: actions.createNote,
        createNoteFromTemplate: actions.createNoteFromTemplate,
        requestDelete: actions.requestDelete,
        cancelDelete: actions.cancelDelete,
        confirmDelete: actions.confirmDelete,
        isDeleteModalOpen: actions.isDeleteModalOpen,
        deleteTargets: actions.deleteTargets,

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
        handleContextCreateNoteFromTemplate: actions.createNoteFromTemplateInContext,
        handleContextCopy: actions.copyInContext,
        handleContextPasteFiles: actions.pasteFilesInContext,
    };
}
