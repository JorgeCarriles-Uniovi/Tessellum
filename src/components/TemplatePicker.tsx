import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { File, FileText, X } from "lucide-react";
import { useEditorStore } from "../stores/editorStore";
import { useCreateNote } from "./Sidebar/hooks/useCreateNote";
import { useCreateNoteFromTemplate } from "./Sidebar/hooks/useCreateNoteFromTemplate";
import { Button, IconButton, Modal, ModalFooter } from "./ui";

interface TemplateInfo {
    name: string;
    path: string;
}

interface TemplatePickerProps {
    isOpen: boolean;
    onClose: () => void;
    parentPath?: string;
}

/** v2: icon tile tint rotates through the soft accent tokens so cards read as distinct at a glance. */
const ICON_TILE_TOKENS = [
    { bg: "var(--color-accent-soft)", fg: "var(--color-accent-default)" },
    { bg: "var(--color-amber-soft)", fg: "var(--color-amber)" },
    { bg: "var(--color-pink-soft)", fg: "var(--color-pink)" },
];

/** Last path segment of the target folder, for the footer's "Creating in {folder}" hint. */
function folderDisplayName(parentPath?: string): string | null {
    if (!parentPath) return null;
    const trimmed = parentPath.replace(/[\\/]+$/, "");
    const segments = trimmed.split(/[\\/]/).filter(Boolean);
    return segments.length > 0 ? segments[segments.length - 1] : null;
}

function useTemplates(isOpen: boolean, vaultPath: string | null, loadErrorMessage: string) {
    const [templates, setTemplates] = useState<TemplateInfo[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        if (!vaultPath) {
            setTemplates([]);
            return;
        }

        setIsLoading(true);
        invoke<TemplateInfo[]>("list_templates", { vaultPath })
            .then((data) => setTemplates(Array.isArray(data) ? data : []))
            .catch((e) => {
                console.error(e);
                toast.error(loadErrorMessage);
                setTemplates([]);
            })
            .finally(() => setIsLoading(false));
    }, [isOpen, vaultPath, loadErrorMessage]);

    return { templates, isLoading };
}

export function TemplatePicker({ isOpen, onClose, parentPath }: TemplatePickerProps) {
    const { t } = useTranslation("core");
    const { vaultPath } = useEditorStore();
    const createNote = useCreateNote();
    const createNoteFromTemplate = useCreateNoteFromTemplate();

    const [title, setTitle] = useState("");
    const { templates, isLoading } = useTemplates(isOpen, vaultPath, t("templatePicker.loadError", "Failed to load templates"));

    const listItems = useMemo(
        () => [{ name: t("templatePicker.blankNote", "Blank note"), path: "" }, ...templates],
        [templates, t],
    );

    useEffect(() => {
        if (isOpen) {
            setTitle(t("templatePicker.untitled", "Untitled"));
        }
    }, [isOpen, t]);

    const handleSelect = async (templatePath: string) => {
        if (!title.trim()) {
            toast.error(t("templatePicker.emptyTitleError", "Title cannot be empty"));
            return;
        }

        if (templatePath) {
            await createNoteFromTemplate(templatePath, title.trim(), parentPath);
        } else {
            await createNote(parentPath, title.trim());
        }

        onClose();
    };

    const folderLabel = folderDisplayName(parentPath) ?? t("templatePicker.vaultRoot", "vault root");

    return (
        <Modal isOpen={isOpen} onClose={onClose} maxWidth={660}>
            <div style={{ padding: "20px 24px 16px 24px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
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
                            {t("templatePicker.title", "New note")}
                        </h2>
                        <p
                            style={{
                                margin: "6px 0 0 0",
                                fontSize: "13px",
                                lineHeight: "18px",
                                color: "var(--color-text-muted)",
                            }}
                        >
                            {t("templatePicker.description", "Name it and pick a starting point.")}
                        </p>
                    </div>
                    <IconButton
                        label={t("templatePicker.close", "Close")}
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

                <div
                    style={{
                        marginTop: "16px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "10px 12px",
                        border: "1px solid var(--color-border-light)",
                        borderRadius: "10px",
                        backgroundColor: "var(--color-bg-elevated)",
                    }}
                >
                    <FileText size={16} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={t("templatePicker.untitled", "Untitled")}
                        style={{
                            flex: 1,
                            minWidth: 0,
                            border: "none",
                            outline: "none",
                            background: "transparent",
                            fontSize: "14px",
                            color: "var(--color-text-primary)",
                        }}
                    />
                    <span
                        style={{
                            flexShrink: 0,
                            fontFamily: "var(--font-mono)",
                            fontSize: "11px",
                            color: "var(--color-text-muted)",
                            backgroundColor: "var(--color-bg-tertiary)",
                            border: "1px solid var(--color-border-light)",
                            borderRadius: "6px",
                            padding: "2px 6px",
                        }}
                    >
                        .md
                    </span>
                </div>
            </div>

            <div style={{ padding: "0 24px 20px 24px", maxHeight: "360px", overflowY: "auto" }}>
                {(isLoading || listItems.length === 1) && (
                    <div style={{ padding: "12px 2px", color: "var(--color-text-muted)", fontSize: "13px" }}>
                        {isLoading
                            ? t("templatePicker.loading", "Loading templates...")
                            : t("templatePicker.noTemplatesFound", "No templates found. Add .md files to .tessellum/templates.")}
                    </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" }}>
                    {listItems.map((template, index) => {
                        const isBlank = template.path === "";
                        const tile = ICON_TILE_TOKENS[index % ICON_TILE_TOKENS.length];
                        const Icon = isBlank ? File : FileText;

                        return (
                            <button
                                key={`${template.name}-${index}`}
                                type="button"
                                onClick={() => handleSelect(template.path)}
                                className="cursor-pointer text-left transition-colors hover:border-[color:var(--color-accent-default)] hover:bg-[color:var(--color-accent-soft)] focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent-default)]"
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "flex-start",
                                    gap: "8px",
                                    border: "2px solid var(--color-border-light)",
                                    borderRadius: "13px",
                                    padding: "13px",
                                    backgroundColor: "transparent",
                                    minWidth: 0,
                                }}
                            >
                                <div
                                    style={{
                                        width: "38px",
                                        height: "38px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        borderRadius: "10px",
                                        backgroundColor: tile.bg,
                                        color: tile.fg,
                                        flexShrink: 0,
                                    }}
                                >
                                    <Icon size={17} />
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <div
                                        style={{
                                            fontSize: "14px",
                                            fontWeight: 500,
                                            color: "var(--color-text-primary)",
                                        }}
                                    >
                                        {template.name}
                                    </div>
                                    <div
                                        style={{
                                            marginTop: "2px",
                                            fontSize: "12px",
                                            color: "var(--color-text-muted)",
                                        }}
                                    >
                                        {isBlank
                                            ? t("templatePicker.startFresh", "Start fresh")
                                            : t("templatePicker.useTemplate", "Use")}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            <ModalFooter
                hints={t("templatePicker.creatingIn", "Creating in {{folder}}", { folder: folderLabel })}
            >
                <Button variant="ghost" onClick={onClose}>
                    {t("templatePicker.cancel", "Cancel")}
                </Button>
            </ModalFooter>
        </Modal>
    );
}
