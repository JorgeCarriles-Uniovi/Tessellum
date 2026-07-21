import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import type { TrashItem } from "./types";
import { removeTrashItem } from "./state";
import { useTessellumApp } from "../../plugins/TessellumApp";
import { getErrorMessage } from "../../lib/errors";

/**
 * Loading/restore/delete logic for the trash modal, kept separate from its
 * presentation.
 */
export function useTrashItems(isOpen: boolean, vaultPath: string | null) {
    const app = useTessellumApp();
    const [items, setItems] = useState<TrashItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [pendingPath, setPendingPath] = useState<string | null>(null);

    const loadItems = useCallback(async (options?: { showLoading?: boolean }) => {
        if (!vaultPath) {
            setItems([]);
            return;
        }

        const showLoading = options?.showLoading ?? true;
        if (showLoading) {
            setIsLoading(true);
        }
        try {
            setItems(await invoke<TrashItem[]>("list_trash_items", { vaultPath }));
        } catch (error) {
            console.error(error);
            toast.error(getErrorMessage(error, "Failed to load trash items"));
        } finally {
            if (showLoading) {
                setIsLoading(false);
            }
        }
    }, [vaultPath]);

    useEffect(() => {
        if (isOpen) {
            loadItems();
        }
    }, [isOpen, loadItems]);

    const runItemAction = useCallback(
        async (item: TrashItem, action: () => Promise<unknown>, successMessage: string, failureMessage: string) => {
            if (!vaultPath) {
                return;
            }

            setPendingPath(item.path);
            try {
                await action();
                setItems((currentItems) => removeTrashItem(currentItems, item.path));
                toast.success(successMessage);
                await loadItems({ showLoading: false });
                app.events.emit("vault:refresh-files");
            } catch (error) {
                console.error(error);
                toast.error(getErrorMessage(error, failureMessage));
            } finally {
                setPendingPath(null);
            }
        },
        [app, loadItems, vaultPath],
    );

    const restoreItem = useCallback(
        (item: TrashItem) =>
            runItemAction(
                item,
                () => invoke<string>("restore_trash_item", { trashItemPath: item.path, vaultPath }),
                `Restored ${item.display_name}`,
                "Failed to restore item",
            ),
        [runItemAction, vaultPath],
    );

    const deleteItemPermanently = useCallback(
        (item: TrashItem) =>
            runItemAction(
                item,
                () => invoke("delete_trash_item_permanently", { trashItemPath: item.path, vaultPath }),
                `Deleted ${item.display_name}`,
                "Failed to delete item permanently",
            ),
        [runItemAction, vaultPath],
    );

    return { items, isLoading, pendingPath, restoreItem, deleteItemPermanently };
}
