import type { ReactNode } from "react";
import { BookOpen, Eye, Code2 } from "lucide-react";

export type EditorMode = "reading" | "live-preview" | "source";

export const DEFAULT_EDITOR_MODE: EditorMode = "live-preview";

export const EDITOR_MODES: Record<
    EditorMode,
    { label: string; labelKey: string; statusLabel: string; statusLabelKey: string; editable: boolean; icon: ReactNode; disabled?: boolean }
> = {
    reading: {
        label: "Reading",
        labelKey: "titleBar.editorModes.reading",
        statusLabel: "READING",
        statusLabelKey: "titleBar.editorModes.readingStatus",
        editable: false,
        icon: <BookOpen size={12} />,
    },
    "live-preview": {
        label: "Live preview",
        labelKey: "titleBar.editorModes.livePreview",
        statusLabel: "EDITING",
        statusLabelKey: "titleBar.editorModes.editingStatus",
        editable: true,
        icon: <Eye size={12} />,
    },
    source: {
        label: "Source mode",
        labelKey: "titleBar.editorModes.source",
        statusLabel: "EDITING",
        statusLabelKey: "titleBar.editorModes.editingStatus",
        editable: true,
        icon: <Code2 size={12} />,
    },
};

export function isEditorMode(value: string | null | undefined): value is EditorMode {
    return value === "reading" || value === "live-preview" || value === "source";
}
