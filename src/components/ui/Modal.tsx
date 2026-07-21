import { useEffect } from "react";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "../../lib/utils";

export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Called when the user presses Enter anywhere in the modal (e.g. confirm dialogs). */
    onEnter?: () => void;
    maxWidth?: number;
    zIndex?: number;
    closeOnBackdrop?: boolean;
    className?: string;
    style?: CSSProperties;
    children: ReactNode;
}

/**
 * Shared modal scaffold: fixed overlay, blurred backdrop, centered panel,
 * Escape-to-close (and optional Enter-to-confirm) handling.
 */
export function Modal({
    isOpen,
    onClose,
    onEnter,
    maxWidth = 420,
    zIndex = 50,
    closeOnBackdrop = true,
    className,
    style,
    children,
}: ModalProps) {
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
            else if (event.key === "Enter" && onEnter) onEnter();
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose, onEnter]);

    if (!isOpen) return null;

    return (
        <div className="ui-modal-overlay" style={{ zIndex }} role="dialog" aria-modal="true">
            <div className="ui-modal-backdrop" onClick={closeOnBackdrop ? onClose : undefined} />
            <div className={cn("ui-modal-panel", className)} style={{ maxWidth, ...style }}>
                {children}
            </div>
        </div>
    );
}

/** Standard modal title block, optionally with a leading icon badge and description. */
export function ModalHeader({
    title,
    description,
    icon,
}: {
    title: ReactNode;
    description?: ReactNode;
    icon?: ReactNode;
}) {
    return (
        <div style={{ padding: "20px 24px 12px 24px" }}>
            {icon && (
                <div
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "32px",
                        height: "32px",
                        borderRadius: "9999px",
                        backgroundColor: "var(--color-alert-bg)",
                        color: "var(--color-alert-text)",
                        marginBottom: "12px",
                    }}
                >
                    {icon}
                </div>
            )}
            <h2
                style={{
                    margin: 0,
                    color: "var(--color-text-primary)",
                    fontSize: "18px",
                    lineHeight: "28px",
                    fontWeight: 600,
                }}
            >
                {title}
            </h2>
            {description && (
                <p
                    style={{
                        margin: "8px 0 0 0",
                        color: "var(--color-text-muted)",
                        fontSize: "14px",
                        lineHeight: "20px",
                    }}
                >
                    {description}
                </p>
            )}
        </div>
    );
}

/** Right-aligned action row at the bottom of a modal; `hints` render on the left. */
export function ModalFooter({ hints, children }: { hints?: ReactNode; children: ReactNode }) {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: hints ? "space-between" : "flex-end",
                gap: "8px",
                padding: "0 24px 20px 24px",
            }}
        >
            {hints && (
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        fontSize: "12px",
                        color: "var(--color-text-muted)",
                    }}
                >
                    {hints}
                </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>{children}</div>
        </div>
    );
}
