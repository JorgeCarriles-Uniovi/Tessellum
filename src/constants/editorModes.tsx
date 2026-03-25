import type { ReactNode } from "react";
import { BookOpen, Eye, Code2 } from "lucide-react";

export type EditorMode = "reading" | "live-preview" | "source";

export const DEFAULT_EDITOR_MODE: EditorMode = "live-preview";

export const EDITOR_MODES: Record<
    EditorMode,
    { label: string; statusLabel: string; editable: boolean; icon: ReactNode; disabled?: boolean }
> = {
    reading: {
        label: "Reading",
        statusLabel: "READING",
        editable: false,
        icon: <BookOpen size={12} />,
    },
    "live-preview": {
        label: "Live preview",
        statusLabel: "EDITING",
        editable: true,
        icon: <Eye size={12} />,
    },
    source: {
        label: "Source mode",
        statusLabel: "EDITING",
        editable: true,
        icon: <Code2 size={12} />,
        disabled: true,
    },
};

export function isEditorMode(value: string | null | undefined): value is EditorMode {
    return value === "reading" || value === "live-preview" || value === "source";
}
