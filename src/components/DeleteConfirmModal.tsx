import { useEffect } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { theme } from "../styles/theme";

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
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!isOpen) {
                return;
            }
            if (event.key === "Escape") {
                onClose();
            }
            if (event.key === "Enter") {
                onConfirm();
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose, onConfirm]);

    if (!isOpen || targetNames.length === 0) {
        return null;
    }

    const isBulkDelete = targetNames.length > 1;
    const description = isBulkDelete
        ? `You are about to move ${targetNames.length} selected items to trash.`
        : hasDirectory
            ? `The folder "${targetNames[0]}" and all its contents will be moved to trash.`
            : `The file "${targetNames[0]}" will be moved to trash.`;
    const previewNames = targetNames.slice(0, 4);
    const remainingCount = targetNames.length - previewNames.length;

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 60,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <div
                onClick={onClose}
                style={{
                    position: "absolute",
                    inset: 0,
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    backdropFilter: "blur(4px)",
                }}
            />

            <div
                style={{
                    position: "relative",
                    width: "100%",
                    maxWidth: "460px",
                    margin: "0 16px",
                    backgroundColor: theme.colors.background.primary,
                    border: `1px solid ${theme.colors.border.light}`,
                    borderRadius: theme.borderRadius.xl,
                    boxShadow: theme.shadows.xl,
                    overflow: "hidden",
                }}
            >
                <div style={{ padding: "20px 24px 12px 24px" }}>
                    <div
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "32px",
                            height: "32px",
                            borderRadius: theme.borderRadius.full,
                            backgroundColor: "var(--color-alert-bg)",
                            color: "var(--color-alert-text)",
                            marginBottom: "12px",
                        }}
                    >
                        <AlertTriangle size={16} />
                    </div>
                    <h2
                        style={{
                            margin: 0,
                            color: theme.colors.text.primary,
                            fontSize: "18px",
                            lineHeight: "28px",
                            fontWeight: theme.typography.fontWeight.semibold,
                        }}
                    >
                        Move to trash?
                    </h2>
                    <p
                        style={{
                            margin: "8px 0 0 0",
                            color: theme.colors.text.muted,
                            fontSize: "14px",
                            lineHeight: "20px",
                        }}
                    >
                        {description}
                    </p>
                    {isBulkDelete && (
                        <div
                            style={{
                                marginTop: "10px",
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
                            {remainingCount > 0 ? ` and ${remainingCount} more...` : ""}
                        </div>
                    )}
                </div>

                <div
                    style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: "8px",
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
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "8px 14px",
                            borderRadius: theme.borderRadius.lg,
                            border: "none",
                            backgroundColor: "var(--color-alert-text)",
                            color: "var(--color-bg-primary)",
                            fontSize: "14px",
                            fontWeight: theme.typography.fontWeight.medium,
                            cursor: "pointer",
                        }}
                    >
                        <Trash2 size={14} />
                        Move to trash
                    </button>
                </div>
            </div>
        </div>
    );
}
