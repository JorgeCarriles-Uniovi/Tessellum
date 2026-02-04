import { useCallback } from 'react';
import { getParentFromTarget } from '../../../utils/pathUtils.ts';
import {useSidebarActions} from "../../Sidebar/hooks/useSidebarActions";
import {useContextMenu} from "./useContextMenu";
import {FileMetadata} from "../../../types.ts";

export function useFileTreeActions(
    onOpenFolderModal: (target: any) => void,
    onOpenRenameModal: (target: any) => void
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
        menuState,
        handleContextMenu,
        closeMenu,
        createNote,
        deleteFile,
        createNoteInContext,
        createFolderInContext,
        renameInContext
    };
}