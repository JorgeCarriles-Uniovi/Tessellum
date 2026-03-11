import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { theme } from "../styles/theme";
import { useEditorStore } from "../stores/editorStore";
import { useCreateNote, useCreateNoteFromTemplate } from "./Sidebar/hooks";

interface TemplateInfo {
    name: string;
    path: string;
}

interface TemplatePickerProps {
    isOpen: boolean;
    onClose: () => void;
    parentPath?: string;
}

export function TemplatePicker({ isOpen, onClose, parentPath }: TemplatePickerProps) {
    const { vaultPath } = useEditorStore();
    const createNote = useCreateNote();
    const createNoteFromTemplate = useCreateNoteFromTemplate();

    const [templates, setTemplates] = useState<TemplateInfo[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [title, setTitle] = useState("Untitled");
    const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

    const listItems = useMemo(() => {
        return [
            { name: "Blank note", path: "" },
            ...templates,
        ];
    }, [templates]);

    useEffect(() => {
        if (!isOpen) return;

        setTitle("Untitled");
        setIsLoading(true);

        if (!vaultPath) {
            setTemplates([]);
            setIsLoading(false);
            return;
        }

        invoke<TemplateInfo[]>("list_templates", { vaultPath })
            .then((data) => {
                setTemplates(Array.isArray(data) ? data : []);
            })
            .catch((e) => {
                console.error(e);
                toast.error("Failed to load templates");
                setTemplates([]);
            })
            .finally(() => setIsLoading(false));
    }, [isOpen, vaultPath]);

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

    const handleSelect = async (templatePath: string) => {
        if (!title.trim()) {
            toast.error("Title cannot be empty");
            return;
        }

        if (templatePath) {
            await createNoteFromTemplate(templatePath, title.trim(), parentPath);
        } else {
            await createNote(parentPath, title.trim());
        }

        onClose();
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
                    maxWidth: "520px",
                    margin: "0 16px",
                    backgroundColor: theme.colors.background.primary,
                    border: `1px solid ${theme.colors.border.light}`,
                    borderRadius: theme.borderRadius.xl,
                    boxShadow: theme.shadows.xl,
                    overflow: "hidden",
                }}
            >
                {/* Header */}
                <div
                    style={{
                        padding: "24px 24px 8px 24px",
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
                        New Note From Template
                    </h2>
                    <p
                        style={{
                            margin: "6px 0 0 0",
                            color: theme.colors.text.muted,
                            fontSize: theme.typography.fontSize.sm,
                        }}
                    >
                        Pick a template and name your note.
                    </p>
                </div>

                {/* Title Input */}
                <div
                    style={{
                        padding: "0 24px 16px 24px",
                    }}
                >
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Untitled"
                        style={{
                            width: "100%",
                            padding: "12px 16px",
                            fontSize: "14px",
                            lineHeight: "20px",
                            backgroundColor: theme.colors.background.secondary,
                            border: `1px solid ${theme.colors.border.medium}`,
                            borderRadius: theme.borderRadius.lg,
                            color: theme.colors.text.primary,
                            outline: "none",
                            transition: "all 150ms ease",
                            boxSizing: "border-box",
                        }}
                    />
                </div>

                {/* Template List */}
                <div
                    style={{
                        padding: "0 16px 16px 16px",
                        maxHeight: "320px",
                        overflowY: "auto",
                    }}
                >
                    {isLoading ? (
                        <div
                            style={{
                                padding: "12px",
                                color: theme.colors.text.muted,
                                fontSize: theme.typography.fontSize.sm,
                            }}
                        >
                            Loading templates...
                        </div>
                    ) : listItems.length === 1 ? (
                        <div
                            style={{
                                padding: "12px",
                                color: theme.colors.text.muted,
                                fontSize: theme.typography.fontSize.sm,
                            }}
                        >
                            No templates found. Add .md files to .tessellum/templates.
                        </div>
                    ) : null}

                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {listItems.map((template, index) => (
                            <button
                                key={`${template.name}-${index}`}
                                type="button"
                                onMouseEnter={() => setFocusedIndex(index)}
                                onMouseLeave={() => setFocusedIndex(null)}
                                onClick={() => handleSelect(template.path)}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    padding: "12px 16px",
                                    backgroundColor:
                                        focusedIndex === index
                                            ? theme.colors.background.tertiary
                                            : theme.colors.background.secondary,
                                    border: `1px solid ${theme.colors.border.light}`,
                                    borderRadius: theme.borderRadius.lg,
                                    cursor: "pointer",
                                    transition: "all 150ms ease",
                                    textAlign: "left",
                                }}
                            >
                                <span
                                    style={{
                                        fontSize: theme.typography.fontSize.sm,
                                        color: theme.colors.text.primary,
                                        fontWeight: template.path ? theme.typography.fontWeight.medium : theme.typography.fontWeight.semibold,
                                    }}
                                >
                                    {template.name}
                                </span>
                                <span
                                    style={{
                                        fontSize: theme.typography.fontSize.xs,
                                        color: theme.colors.text.muted,
                                    }}
                                >
                                    {template.path ? "Use" : "Start fresh"}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div
                    style={{
                        padding: "0 24px 24px 24px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                    }}
                >
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            padding: "8px 16px",
                            fontSize: "14px",
                            backgroundColor: "transparent",
                            color: theme.colors.text.muted,
                            border: "none",
                            borderRadius: theme.borderRadius.lg,
                            fontWeight: theme.typography.fontWeight.medium,
                            cursor: "pointer",
                            transition: "all 150ms ease",
                        }}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
