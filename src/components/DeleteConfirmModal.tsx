import { AlertTriangle, Trash2 } from "lucide-react";
import { theme } from "../styles/theme";
import { useAppTranslation } from "../i18n/react.tsx";
import { Button, Modal, ModalFooter, ModalHeader } from "./ui";

interface DeleteConfirmModalProps {
    isOpen: boolean;
    targetNames: string[];
    hasDirectory: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export function DeleteConfirmModal({
    isOpen,
    targetNames,
    hasDirectory,
    onClose,
    onConfirm,
}: DeleteConfirmModalProps) {
    const { t } = useAppTranslation("core");

    if (targetNames.length === 0) {
        return null;
    }

    const isBulkDelete = targetNames.length > 1;
    const description = isBulkDelete
        ? t("deleteModal.bulkDescription", { count: targetNames.length })
        : hasDirectory
            ? t("deleteModal.folderDescription", { name: targetNames[0] })
            : t("deleteModal.fileDescription", { name: targetNames[0] });
    const previewNames = targetNames.slice(0, 4);
    const remainingCount = targetNames.length - previewNames.length;

    return (
        <Modal isOpen={isOpen} onClose={onClose} onEnter={onConfirm} maxWidth={460} zIndex={60}>
            <ModalHeader icon={<AlertTriangle size={16} />} title={t("deleteModal.title")} description={description} />
            {isBulkDelete && (
                <div
                    style={{
                        margin: "0 24px 12px 24px",
                        padding: "10px 12px",
                        borderRadius: theme.borderRadius.md,
                        border: `1px solid ${theme.colors.border.light}`,
                        backgroundColor: theme.colors.background.secondary,
                        color: theme.colors.text.secondary,
                        fontSize: "12px",
                        lineHeight: "18px",
                    }}
                >
                    {previewNames.join(", ")}
                    {remainingCount > 0 ? t("deleteModal.moreItems", { count: remainingCount }) : ""}
                </div>
            )}

            <ModalFooter>
                <Button variant="secondary" onClick={onClose}>
                    {t("deleteModal.cancel")}
                </Button>
                <Button variant="danger" onClick={onConfirm}>
                    <Trash2 size={14} />
                    {t("deleteModal.moveToTrash")}
                </Button>
            </ModalFooter>
        </Modal>
    );
}
