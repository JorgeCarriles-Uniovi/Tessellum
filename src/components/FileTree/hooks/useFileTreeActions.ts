import { useCallback } from 'react';
import { getParentFromTarget } from '../../../utils/pathUtils.ts';
import { useSidebarActions } from "../../Sidebar/hooks/useSidebarActions";
import { useContextMenu } from "./useContextMenu";
import { FileMetadata } from "../../../types.ts";
import { useSelectionStore, useVaultStore } from "../../../stores";
import { useTessellumApp } from "../../../plugins/TessellumApp";
import { useClipboardFilePaste } from "../../../features/clipboard/useClipboardFilePaste";
import { useClipboardFileCopy } from "../../../features/clipboard/useClipboardFileCopy";
import { resolveClipboardSelection } from "../../../features/clipboard/clipboardSelection";

export function useFileTreeActions(
    onOpenFolderModal: (target: FileMetadata) => void,
    onOpenRenameModal: (target: FileMetadata) => void
) {
    const { createNote, createNoteFromTemplate, deleteFile } = useSidebarActions();
    const { menuState, handleContextMenu, closeMenu } = useContextMenu();
    const vaultPath = useVaultStore((state) => state.vaultPath);
    const files = useVaultStore((state) => state.files);
    const selectedFilePaths = useSelectionStore((state) => state.selectedFilePaths);
    const app = useTessellumApp();
    const clipboardFilePaste = useClipboardFilePaste({
        vaultPath,
        refreshVault: () => {
            app.events.emit("vault:refresh-files");
        },
    });
    const clipboardFileCopy = useClipboardFileCopy();

    const createNoteInContext = useCallback(async () => {
        if (!menuState?.target) return;

        const parentPath = getParentFromTarget(menuState.target);
        await createNote(parentPath);
        closeMenu();
    }, [menuState, createNote, closeMenu]);

    const createNoteFromTemplateInContext = useCallback(async (templatePath: string, title: string) => {
        if (!menuState?.target) return;

        const parentPath = getParentFromTarget(menuState.target);
        await createNoteFromTemplate(templatePath, title, parentPath);
        closeMenu();
    }, [menuState, createNoteFromTemplate, closeMenu]);

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

    const copyInContext = useCallback(async () => {
        if (!menuState?.target) return;

        const pathsToCopy = resolveClipboardSelection(files, selectedFilePaths);
        await clipboardFileCopy.copyPaths(pathsToCopy.length > 0 ? pathsToCopy : [menuState.target.path]);
        closeMenu();
    }, [clipboardFileCopy, files, menuState, closeMenu, selectedFilePaths]);

    const pasteFilesInContext = useCallback(async () => {
        if (!menuState?.target?.is_dir) {
            return;
        }

        await clipboardFilePaste.pasteInto(menuState.target.path);
        closeMenu();
    }, [clipboardFilePaste, closeMenu, menuState]);

    return {
        menuState,
        handleContextMenu,
        closeMenu,
        createNote,
        createNoteFromTemplate,
        requestDelete: deleteFile.requestDelete,
        cancelDelete: deleteFile.cancelDelete,
        confirmDelete: deleteFile.confirmDelete,
        isDeleteModalOpen: deleteFile.isDeleteModalOpen,
        deleteTargets: deleteFile.deleteTargets,
        createNoteInContext,
        createNoteFromTemplateInContext,
        createFolderInContext,
        renameInContext,
        copyInContext,
        pasteFilesInContext,
    };
}
