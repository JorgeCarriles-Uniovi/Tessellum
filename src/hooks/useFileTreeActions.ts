import { useCallback } from 'react';
import { useSidebarActions, useContextMenu } from '../hooks';
import { getParentFromTarget } from '../utils/pathUtils';

export function useFileTreeActions(
    onOpenFolderModal: (target: unknown) => void,
    onOpenRenameModal: (target: unknown) => void
) {
    const { createNote, deleteFile } = useSidebarActions();
    const { menuState, handleContextMenu, closeMenu } = useContextMenu();

    const createNoteInContext = useCallback(async () => {
        if (!menuState?.target) return;

        const parentPath = getParentFromTarget(menuState.target);
        await createNote(parentPath);
        closeMenu();
    }, [menuState, createNote, closeMenu]);

    const createFolderInContext = useCallback(() => {
        if (menuState?.target) {
            onOpenFolderModal(menuState.target);
            closeMenu();
        }
    }, [menuState, onOpenFolderModal, closeMenu]);

    const renameInContext = useCallback(() => {
        if (menuState?.target) {
            onOpenRenameModal(menuState.target);
            closeMenu();
        }
    }, [menuState, onOpenRenameModal, closeMenu]);

    return {
        menuState: menuState,
        handleContextMenu: handleContextMenu,
        closeMenu,
        createNote,
        deleteFile: deleteFile,
        createNoteInContext: createNoteInContext,
        createFolderInContext: createFolderInContext,
        renameInContext
    };
}