import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { theme } from "../styles/theme";
import { useEditorStore } from "../stores/editorStore";
import { useCreateNote } from "./Sidebar/hooks/useCreateNote";
import { useCreateNoteFromTemplate } from "./Sidebar/hooks/useCreateNoteFromTemplate";
import { Button, Modal, ModalFooter, ModalHeader, TextInput } from "./ui";

interface TemplateInfo {
    name: string;
    path: string;
}

interface TemplatePickerProps {
    isOpen: boolean;
    onClose: () => void;
    parentPath?: string;
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

    return (
        <Modal isOpen={isOpen} onClose={onClose} maxWidth={520}>
            <ModalHeader
                title={t("templatePicker.title", "New Note From Template")}
                description={t("templatePicker.description", "Pick a template and name your note.")}
            />

            <div style={{ padding: "4px 24px 16px 24px" }}>
                <TextInput
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t("templatePicker.untitled", "Untitled")}
                />
            </div>

            <div style={{ padding: "0 16px 16px 16px", maxHeight: "320px", overflowY: "auto" }}>
                {(isLoading || listItems.length === 1) && (
                    <div
                        style={{
                            padding: "12px",
                            color: theme.colors.text.muted,
                            fontSize: theme.typography.fontSize.sm,
                        }}
                    >
                        {isLoading
                            ? t("templatePicker.loading", "Loading templates...")
                            : t("templatePicker.noTemplatesFound", "No templates found. Add .md files to .tessellum/templates.")}
                    </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {listItems.map((template, index) => (
                        <button
                            key={`${template.name}-${index}`}
                            type="button"
                            className="ui-option"
                            onClick={() => handleSelect(template.path)}
                        >
                            <span
                                style={{
                                    fontSize: theme.typography.fontSize.sm,
                                    color: theme.colors.text.primary,
                                    fontWeight: template.path
                                        ? theme.typography.fontWeight.medium
                                        : theme.typography.fontWeight.semibold,
                                }}
                            >
                                {template.name}
                            </span>
                            <span style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.text.muted }}>
                                {template.path
                                    ? t("templatePicker.useTemplate", "Use")
                                    : t("templatePicker.startFresh", "Start fresh")}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            <ModalFooter>
                <Button variant="ghost" onClick={onClose}>
                    {t("templatePicker.close", "Close")}
                </Button>
            </ModalFooter>
        </Modal>
    );
}
