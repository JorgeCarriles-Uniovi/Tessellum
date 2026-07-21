import { ArchiveRestore, Trash2 } from "lucide-react";
import { theme } from "../../styles/theme";
import type { TrashItem } from "./types";
import { formatTrashLocation } from "./formatTrashLabel";
import { shouldShowTrashLoading } from "./state";
import { useTrashItems } from "./useTrashItems";
import { Button, Modal, ModalFooter, ModalHeader } from "../ui";

interface TrashModalProps {
    isOpen: boolean;
    onClose: () => void;
    vaultPath: string | null;
}

const mutedTextStyle = {
    padding: "24px",
    color: theme.colors.text.muted,
    fontSize: "14px",
} as const;

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
    return (
        <div
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
                <div style={{ color: theme.colors.text.muted, fontSize: "12px", marginTop: "4px" }}>
                    {item.is_dir ? "Folder" : "File"} · {formatTrashLocation(item.parent_label)}
                </div>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <Button variant="secondary" onClick={() => onRestore(item)} disabled={isPending}>
                    <ArchiveRestore size={14} />
                    Restore
                </Button>
                <Button variant="danger" onClick={() => onDelete(item)} disabled={isPending}>
                    <Trash2 size={14} />
                    Delete permanently
                </Button>
            </div>
        </div>
    );
}

export function TrashModal({ isOpen, onClose, vaultPath }: TrashModalProps) {
    const { items, isLoading, pendingPath, restoreItem, deleteItemPermanently } = useTrashItems(isOpen, vaultPath);

    let body: React.ReactNode;
    if (shouldShowTrashLoading(isLoading, items.length)) {
        body = <div style={mutedTextStyle}>Loading trash items...</div>;
    } else if (items.length === 0) {
        body = <div style={mutedTextStyle}>Trash is empty.</div>;
    } else {
        body = (
            <div style={{ maxHeight: "420px", overflowY: "auto", padding: "0 24px 24px 24px" }}>
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
        );
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} maxWidth={720} zIndex={60}>
            <ModalHeader
                title="Trash"
                description="Restore items to their original folder or delete them permanently."
            />
            {body}
            <ModalFooter>
                <Button variant="secondary" onClick={onClose}>
                    Close
                </Button>
            </ModalFooter>
        </Modal>
    );
}
