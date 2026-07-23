import type { CSSProperties, ReactNode } from "react";
import { ArchiveRestore, File, Folder, Trash2, X } from "lucide-react";
import type { TrashItem } from "./types";
import { shouldShowTrashLoading } from "./state";
import { useTrashItems } from "./useTrashItems";
import { Button, IconButton, Modal, ModalFooter } from "../ui";

interface TrashModalProps {
    isOpen: boolean;
    onClose: () => void;
    vaultPath: string | null;
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Turns a trash item's stored timestamp (ms since epoch) into a short relative label. */
function formatDeletedWhen(timestampMs: number): string {
    const diffMs = Math.max(0, Date.now() - timestampMs);

    if (diffMs < MINUTE_MS) return "just now";

    if (diffMs < HOUR_MS) {
        const minutes = Math.floor(diffMs / MINUTE_MS);
        return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
    }

    if (diffMs < DAY_MS) {
        const hours = Math.floor(diffMs / HOUR_MS);
        return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    }

    const days = Math.floor(diffMs / DAY_MS);
    return days === 1 ? "yesterday" : `${days} days ago`;
}

/** Folder name shown in a row's metadata line; mirrors formatTrashLocation's root handling. */
function locationLabel(parentLabel: string): string {
    return parentLabel === "Root" ? "Vault root" : parentLabel;
}

const iconTileStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    borderRadius: "9px",
    border: "1px solid var(--color-border-light)",
    backgroundColor: "var(--color-bg-app)",
    color: "var(--color-text-tertiary)",
};

function TrashItemRow({
    item,
    isPending,
    onRestore,
    onDelete,
}: {
    item: TrashItem;
    isPending: boolean;
    onRestore: (item: TrashItem) => void;
    onDelete: (item: TrashItem) => void;
}) {
    const Icon = item.is_dir ? Folder : File;

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 0",
                borderTop: "1px solid var(--color-border-light)",
            }}
        >
            <div style={{ ...iconTileStyle, width: "34px", height: "34px" }}>
                <Icon size={16} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
                <div
                    style={{
                        color: "var(--color-text-primary)",
                        fontSize: "14px",
                        fontWeight: 500,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {item.display_name}
                </div>
                <div style={{ marginTop: "2px", fontSize: "12px", color: "var(--color-text-muted)" }}>
                    {item.is_dir ? "Folder" : "File"} · in {locationLabel(item.parent_label)} · deleted{" "}
                    {formatDeletedWhen(item.timestamp)}
                </div>
            </div>
            <div style={{ display: "flex", gap: "6px", alignItems: "center", flexShrink: 0 }}>
                <Button variant="secondary" size="sm" onClick={() => onRestore(item)} disabled={isPending}>
                    <ArchiveRestore size={13} />
                    Restore
                </Button>
                <IconButton
                    label="Delete permanently"
                    danger
                    size={30}
                    onClick={() => onDelete(item)}
                    disabled={isPending}
                    style={{ color: "var(--color-alert-text)" }}
                >
                    <Trash2 size={15} />
                </IconButton>
            </div>
        </div>
    );
}

export function TrashModal({ isOpen, onClose, vaultPath }: TrashModalProps) {
    const { items, isLoading, pendingPath, restoreItem, deleteItemPermanently } = useTrashItems(isOpen, vaultPath);

    const showLoading = shouldShowTrashLoading(isLoading, items.length);
    const isEmpty = !showLoading && items.length === 0;

    let body: ReactNode;
    if (showLoading) {
        body = (
            <div
                style={{
                    padding: "40px 24px",
                    textAlign: "center",
                    color: "var(--color-text-muted)",
                    fontSize: "14px",
                }}
            >
                Loading trash items...
            </div>
        );
    } else if (isEmpty) {
        body = (
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "12px",
                    padding: "48px 24px",
                    textAlign: "center",
                }}
            >
                <div
                    style={{
                        ...iconTileStyle,
                        width: "48px",
                        height: "48px",
                        borderRadius: "9999px",
                    }}
                >
                    <Trash2 size={20} />
                </div>
                <div>
                    <div style={{ color: "var(--color-text-primary)", fontSize: "14px", fontWeight: 600 }}>
                        Trash is empty
                    </div>
                    <div style={{ marginTop: "4px", color: "var(--color-text-muted)", fontSize: "13px" }}>
                        Deleted notes and folders will appear here.
                    </div>
                </div>
            </div>
        );
    } else {
        body = (
            <>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "12px",
                        padding: "0 24px 12px 24px",
                        fontSize: "12px",
                        color: "var(--color-text-muted)",
                    }}
                >
                    <span>
                        {items.length} {items.length === 1 ? "item" : "items"}
                    </span>
                    <span>Auto-clears after 30 days</span>
                </div>
                <div style={{ maxHeight: "380px", overflowY: "auto", padding: "0 24px 8px 24px" }}>
                    {items.map((item) => (
                        <TrashItemRow
                            key={item.path}
                            item={item}
                            isPending={pendingPath === item.path}
                            onRestore={restoreItem}
                            onDelete={deleteItemPermanently}
                        />
                    ))}
                </div>
            </>
        );
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} maxWidth={680} zIndex={60}>
            <div
                style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "12px",
                    padding: "20px 24px 16px 24px",
                }}
            >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", minWidth: 0 }}>
                    <div style={{ ...iconTileStyle, width: "36px", height: "36px" }}>
                        <Trash2 size={17} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <h2
                            style={{
                                margin: 0,
                                fontSize: "18px",
                                lineHeight: "26px",
                                fontWeight: 600,
                                color: "var(--color-text-primary)",
                            }}
                        >
                            Trash
                        </h2>
                        <p
                            style={{
                                margin: "4px 0 0 0",
                                fontSize: "13px",
                                lineHeight: "18px",
                                color: "var(--color-text-muted)",
                            }}
                        >
                            Restore items to their original folder or delete them permanently.
                        </p>
                    </div>
                </div>
                <IconButton
                    label="Close"
                    onClick={onClose}
                    size={32}
                    style={{
                        flexShrink: 0,
                        border: "1px solid var(--color-border-light)",
                        borderRadius: "9px",
                        backgroundColor: "var(--color-bg-elevated)",
                    }}
                >
                    <X size={16} />
                </IconButton>
            </div>
            {body}
            <ModalFooter>
                <Button variant="secondary" onClick={onClose}>
                    Close
                </Button>
            </ModalFooter>
        </Modal>
    );
}
