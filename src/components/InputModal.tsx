import type React from "react";
import { useEffect, useRef, useState } from "react";
import { theme } from "../styles/theme";

interface InputModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (value: string) => void;
    title?: string;
    placeholder?: string;
    defaultValue?: string;
    submitLabel?: string;
}

export function InputModal({
                               isOpen,
                               onClose,
                               onSubmit,
                               title = "Enter name",
                               placeholder = "Enter a name...",
                               defaultValue = "",
                               submitLabel = "Create",
                           }: InputModalProps) {
    const [value, setValue] = useState(defaultValue);
    const [isFocused, setIsFocused] = useState(false);
    const [cancelHovered, setCancelHovered] = useState(false);
    const [submitHovered, setSubmitHovered] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setValue(defaultValue);
            setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 50);
        }
    }, [isOpen, defaultValue]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === "Escape") {
                onClose();
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (value.trim()) {
            onSubmit(value.trim());
            onClose();
        }
    };

    return (
        <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 50,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            {/* Backdrop */}
            <div
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    backdropFilter: "blur(4px)",
                }}
                onClick={onClose}
            />

            {/* Modal */}
            <div
                style={{
                    position: "relative",
                    width: "100%",
                    maxWidth: "420px",
                    margin: "0 16px",
                    backgroundColor: theme.colors.background.primary,
                    border: `1px solid ${theme.colors.border.light}`,
                    borderRadius: theme.borderRadius.xl,
                    boxShadow: theme.shadows.xl,
                    overflow: "hidden",
                }}
            >
                <form onSubmit={handleSubmit}>
                    {/* Header */}
                    <div
                        style={{
                            padding: "24px 24px 16px 24px",
                        }}
                    >
                        <h2
                            style={{
                                margin: 0,
                                fontSize: "18px",
                                lineHeight: "28px",
                                color: theme.colors.text.primary,
                                fontWeight: theme.typography.fontWeight.semibold,
                            }}
                        >
                            {title}
                        </h2>
                    </div>

                    {/* Input */}
                    <div
                        style={{
                            padding: "0 24px 16px 24px",
                        }}
                    >
                        <input
                            ref={inputRef}
                            type="text"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            placeholder={placeholder}
                            style={{
                                width: "100%",
                                padding: "12px 16px",
                                fontSize: "14px",
                                lineHeight: "20px",
                                backgroundColor: isFocused
                                    ? theme.colors.background.primary
                                    : theme.colors.background.secondary,
                                border: `1px solid ${isFocused ? theme.colors.blue[500] : theme.colors.border.medium}`,
                                borderRadius: theme.borderRadius.lg,
                                color: theme.colors.text.primary,
                                outline: "none",
                                boxShadow: isFocused
                                    ? `0 0 0 3px ${theme.colors.blue[500]}33`
                                    : "none",
                                transition: "all 150ms ease",
                                boxSizing: "border-box",
                            }}
                        />
                    </div>

                    {/* Footer */}
                    <div
                        style={{
                            padding: "0 24px 24px 24px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}
                    >
                        {/* Keyboard hints */}
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                                fontSize: "12px",
                                color: theme.colors.text.muted,
                            }}
                        >
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <kbd
                    style={{
                        padding: "2px 6px",
                        fontSize: "10px",
                        fontFamily: "monospace",
                        backgroundColor: theme.colors.background.tertiary,
                        border: `1px solid ${theme.colors.border.light}`,
                        borderRadius: theme.borderRadius.base,
                        color: theme.colors.text.muted,
                    }}
                >
                  Enter
                </kbd>
                <span>confirm</span>
              </span>
                            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <kbd
                    style={{
                        padding: "2px 6px",
                        fontSize: "10px",
                        fontFamily: "monospace",
                        backgroundColor: theme.colors.background.tertiary,
                        border: `1px solid ${theme.colors.border.light}`,
                        borderRadius: theme.borderRadius.base,
                        color: theme.colors.text.muted,
                    }}
                >
                  Esc
                </kbd>
                <span>cancel</span>
              </span>
                        </div>

                        {/* Actions */}
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                            }}
                        >
                            <button
                                type="button"
                                onClick={onClose}
                                onMouseEnter={() => setCancelHovered(true)}
                                onMouseLeave={() => setCancelHovered(false)}
                                style={{
                                    padding: "8px 16px",
                                    fontSize: "14px",
                                    backgroundColor: cancelHovered
                                        ? theme.colors.background.tertiary
                                        : "transparent",
                                    color: cancelHovered
                                        ? theme.colors.text.primary
                                        : theme.colors.text.muted,
                                    border: "none",
                                    borderRadius: theme.borderRadius.lg,
                                    fontWeight: theme.typography.fontWeight.medium,
                                    cursor: "pointer",
                                    transition: "all 150ms ease",
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={!value.trim()}
                                onMouseEnter={() => setSubmitHovered(true)}
                                onMouseLeave={() => setSubmitHovered(false)}
                                style={{
                                    padding: "8px 16px",
                                    fontSize: "14px",
                                    backgroundColor:
                                        submitHovered && value.trim()
                                            ? theme.colors.blue[700]
                                            : theme.colors.blue[600],
                                    color: "#ffffff",
                                    border: "none",
                                    borderRadius: theme.borderRadius.lg,
                                    fontWeight: theme.typography.fontWeight.medium,
                                    cursor: value.trim() ? "pointer" : "not-allowed",
                                    opacity: value.trim() ? 1 : 0.5,
                                    transition: "all 150ms ease",
                                }}
                            >
                                {submitLabel}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
