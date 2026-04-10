import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ArchiveRestore, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { theme } from "../../styles/theme";
import type { TrashItem } from "./types";
import { formatTrashLocation } from "./formatTrashLabel";
import { removeTrashItem, shouldShowTrashLoading } from "./state";
import { useTessellumApp } from "../../plugins/TessellumApp";

interface TrashModalProps {
    isOpen: boolean;
    onClose: () => void;
    vaultPath: string | null;
}

const overlayStyle: CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 60,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
};

const cardStyle: CSSProperties = {
    position: "relative",
    width: "100%",
    maxWidth: "720px",
    margin: "0 16px",
    backgroundColor: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.light}`,
    borderRadius: theme.borderRadius.xl,
    boxShadow: theme.shadows.xl,
    overflow: "hidden",
};

function getErrorMessage(error: unknown, fallback: string): string {
    if (typeof error === "string" && error.trim()) {
        return error;
    }

    if (error && typeof error === "object") {
        const message = Reflect.get(error, "message");
        if (typeof message === "string" && message.trim()) {
            return message;
        }
    }

    return fallback;
}

export function TrashModal({ isOpen, onClose, vaultPath }: TrashModalProps) {
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
            const nextItems = await invoke<TrashItem[]>("list_trash_items", { vaultPath });
            setItems(nextItems);
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
        if (!isOpen) {
            return;
        }
        loadItems();
    }, [isOpen, loadItems]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (isOpen && event.key === "Escape") {
                onClose();
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    const handleRestore = useCallback(async (item: TrashItem) => {
        if (!vaultPath) {
            return;
        }

        setPendingPath(item.path);
        try {
            await invoke<string>("restore_trash_item", {
                trashItemPath: item.path,
                vaultPath,
            });
            setItems((currentItems) => removeTrashItem(currentItems, item.path));
            toast.success(`Restored ${item.display_name}`);
            await loadItems({ showLoading: false });
            app.events.emit("vault:refresh-files");
        } catch (error) {
            console.error(error);
            toast.error(getErrorMessage(error, "Failed to restore item"));
        } finally {
            setPendingPath(null);
        }
    }, [app, loadItems, vaultPath]);

    const handlePermanentDelete = useCallback(async (item: TrashItem) => {
        if (!vaultPath) {
            return;
        }

        setPendingPath(item.path);
        try {
            await invoke("delete_trash_item_permanently", {
                trashItemPath: item.path,
                vaultPath,
            });
            setItems((currentItems) => removeTrashItem(currentItems, item.path));
            toast.success(`Deleted ${item.display_name}`);
            await loadItems({ showLoading: false });
            app.events.emit("vault:refresh-files");
        } catch (error) {
            console.error(error);
            toast.error(getErrorMessage(error, "Failed to delete item permanently"));
        } finally {
            setPendingPath(null);
        }
    }, [app, loadItems, vaultPath]);

    const body = useMemo(() => {
        if (shouldShowTrashLoading(isLoading, items.length)) {
            return (
                <div style={{ padding: "24px", color: theme.colors.text.muted, fontSize: "14px" }}>
                    Loading trash items...
                </div>
            );
        }

        if (items.length === 0) {
            return (
                <div style={{ padding: "24px", color: theme.colors.text.muted, fontSize: "14px" }}>
                    Trash is empty.
                </div>
            );
        }

        return (
            <div style={{ maxHeight: "420px", overflowY: "auto", padding: "0 24px 24px 24px" }}>
                {items.map((item) => {
                    const isPending = pendingPath === item.path;
                    return (
                        <div
                            key={item.path}
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: "16px",
                                padding: "14px 0",
                                borderTop: `1px solid ${theme.colors.border.light}`,
                            }}
                        >
                            <div style={{ minWidth: 0 }}>
                                <div
                                    style={{
                                        color: theme.colors.text.primary,
                                        fontSize: "14px",
                                        fontWeight: theme.typography.fontWeight.semibold,
                                    }}
                                >
                                    {item.display_name}
                                </div>
                                <div
                                    style={{
                                        color: theme.colors.text.muted,
                                        fontSize: "12px",
                                        marginTop: "4px",
                                    }}
                                >
                                    {item.is_dir ? "Folder" : "File"} · {formatTrashLocation(item.parent_label)}
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                <button
                                    type="button"
                                    onClick={() => handleRestore(item)}
                                    disabled={isPending}
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "6px",
                                        padding: "8px 12px",
                                        borderRadius: theme.borderRadius.lg,
                                        border: `1px solid ${theme.colors.border.light}`,
                                        backgroundColor: "transparent",
                                        color: theme.colors.text.secondary,
                                        cursor: isPending ? "not-allowed" : "pointer",
                                    }}
                                >
                                    <ArchiveRestore size={14} />
                                    Restore
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handlePermanentDelete(item)}
                                    disabled={isPending}
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "6px",
                                        padding: "8px 12px",
                                        borderRadius: theme.borderRadius.lg,
                                        border: "none",
                                        backgroundColor: "var(--color-alert-text)",
                                        color: "var(--color-bg-primary)",
                                        cursor: isPending ? "not-allowed" : "pointer",
                                    }}
                                >
                                    <Trash2 size={14} />
                                    Delete permanently
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }, [handlePermanentDelete, handleRestore, isLoading, items, pendingPath]);

    if (!isOpen) {
        return null;
    }

    return (
        <div style={overlayStyle}>
            <div
                onClick={onClose}
                style={{
                    position: "absolute",
                    inset: 0,
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    backdropFilter: "blur(4px)",
                }}
            />
            <div style={cardStyle}>
                <div style={{ padding: "20px 24px 12px 24px" }}>
                    <h2
                        style={{
                            margin: 0,
                            color: theme.colors.text.primary,
                            fontSize: "18px",
                            lineHeight: "28px",
                            fontWeight: theme.typography.fontWeight.semibold,
                        }}
                    >
                        Trash
                    </h2>
                    <p
                        style={{
                            margin: "8px 0 0 0",
                            color: theme.colors.text.muted,
                            fontSize: "14px",
                            lineHeight: "20px",
                        }}
                    >
                        Restore items to their original folder or delete them permanently.
                    </p>
                </div>
                {body}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        padding: "0 24px 20px 24px",
                    }}
                >
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            padding: "8px 14px",
                            borderRadius: theme.borderRadius.lg,
                            border: `1px solid ${theme.colors.border.light}`,
                            backgroundColor: "transparent",
                            color: theme.colors.text.secondary,
                            fontSize: "14px",
                            cursor: "pointer",
                        }}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
