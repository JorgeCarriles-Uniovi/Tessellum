import { useCallback, useState } from 'react';
import { useVaultStore } from '../../../stores/vaultStore.ts';
import { useSelectionStore } from '../../../stores/selectionStore.ts';
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { FileMetadata } from "../../../types.ts";
import {
    findPreviousOpenNote,
    getDeleteErrorMessage,
    normalizeDeleteTargets,
    pruneTreeByTargets,
    shouldRemovePath,
    summarizeFailedTargets,
} from "./deleteFileLogic.ts";

interface TrashItemsResult {
    deleted_paths: string[];
    failed: Array<{
        item_path: string;
        message: string;
    }>;
}

export function useDeleteFile() {
    const {
        removeFiles,
        setFileTree,
    } = useVaultStore();
    const { clearSelection } = useSelectionStore();
    const [targets, setTargets] = useState<FileMetadata[]>([]);

    const requestDelete = useCallback((candidate: FileMetadata) => {
        const { files } = useVaultStore.getState();
        const { selectedFilePaths } = useSelectionStore.getState();
        console.info("[bulk-delete] requestDelete:start", {
            candidatePath: candidate.path,
            selectedFilePaths,
            filesCount: files.length,
        });

        const selectedTargets = selectedFilePaths
            .map((selectedPath) => files.find((file) => file.path === selectedPath))
            .filter((file): file is FileMetadata => Boolean(file));

        const shouldDeleteSelection = selectedTargets.some((selected) => selected.path === candidate.path);
        const candidates = shouldDeleteSelection && selectedTargets.length > 1
            ? selectedTargets
            : [candidate];

        const normalizedTargets = normalizeDeleteTargets(candidates);
        console.info("[bulk-delete] requestDelete:resolvedTargets", {
            shouldDeleteSelection,
            selectedTargets: selectedTargets.map((target) => target.path),
            candidateTargets: candidates.map((target) => target.path),
            normalizedTargets: normalizedTargets.map((target) => target.path),
            normalizedCount: normalizedTargets.length,
        });
        setTargets(normalizedTargets);
    }, []);

    const cancelDelete = useCallback(() => {
        console.info("[bulk-delete] cancelDelete");
        setTargets([]);
    }, []);

    const confirmDelete = useCallback(async () => {
        if (targets.length === 0) {
            console.info("[bulk-delete] confirmDelete:skippedNoTargets");
            return;
        }

        const pendingTargets = [...targets];
        const {
            files,
            fileTree,
            activeNote,
            openTabPaths,
            vaultPath,
        } = useVaultStore.getState();
        console.info("[bulk-delete] confirmDelete:start", {
            pendingTargets: pendingTargets.map((target) => target.path),
            vaultPath,
            activeNotePath: activeNote?.path ?? null,
            openTabPaths,
        });

        // Close the modal immediately so UI feedback is instant.
        setTargets([]);
        let result: TrashItemsResult;
        try {
            const itemPaths = pendingTargets.map((target) => target.path);
            console.info("[bulk-delete] confirmDelete:invokeTrashItems", { itemPaths, vaultPath });
            result = await invoke<TrashItemsResult>('trash_items', {
                itemPaths,
                vaultPath,
            });
            console.info("[bulk-delete] confirmDelete:invokeResult", result);
        } catch (error) {
            console.error(error);
            console.error("[bulk-delete] confirmDelete:invokeError", error);
            toast.error(getDeleteErrorMessage(error));
            return;
        }
        const deletedTargetPaths = new Set(result.deleted_paths);
        const deletedTargets = pendingTargets.filter((target) => deletedTargetPaths.has(target.path));
        const failedTargets = pendingTargets.filter((target) =>
            result.failed.some((failure) => failure.item_path === target.path)
        );
        const lastFailure = result.failed.length > 0 ? result.failed[result.failed.length - 1] : null;
        const lastError = lastFailure?.message ?? null;
        console.info("[bulk-delete] confirmDelete:classifiedResult", {
            deletedTargetPaths: deletedTargets.map((target) => target.path),
            failedTargets: failedTargets.map((target) => target.path),
            failedDetails: result.failed,
        });

        if (deletedTargets.length > 0) {
            const updatedTree = pruneTreeByTargets(fileTree, deletedTargets);
            const removedPaths = files
                .filter((file) => shouldRemovePath(file.path, deletedTargets))
                .map((file) => file.path);
            const fallbackNote = activeNote
                ? findPreviousOpenNote(activeNote.path, openTabPaths, files, deletedTargets)
                : null;
            const nextActivePath = activeNote && !shouldRemovePath(activeNote.path, deletedTargets)
                ? activeNote.path
                : fallbackNote?.path ?? null;
            console.info("[bulk-delete] confirmDelete:storeUpdate", {
                removedPaths,
                nextActivePath,
            });

            setFileTree(updatedTree);
            removeFiles(removedPaths, nextActivePath);
            clearSelection();
        }

        if (deletedTargets.length > 0) {
            toast.success(deletedTargets.length > 1 ? "Items moved to trash" : "Moved to trash");
        }

        if (failedTargets.length > 0) {
            const summary = summarizeFailedTargets(failedTargets);
            toast.error(`${getDeleteErrorMessage(lastError)}: ${summary}`);
        }
        if (deletedTargets.length === 0 && failedTargets.length === 0) {
            toast.error("No items were moved to trash");
        }
        console.info("[bulk-delete] confirmDelete:done", {
            deletedCount: deletedTargets.length,
            failedCount: failedTargets.length,
        });
    }, [targets, removeFiles, setFileTree, clearSelection]);

    return {
        requestDelete,
        cancelDelete,
        confirmDelete,
        isDeleteModalOpen: targets.length > 0,
        deleteTargets: targets,
    };
}
