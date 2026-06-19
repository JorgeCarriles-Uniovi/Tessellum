import type { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import type { CSSProperties, RefObject } from "react";
import { useRef, useState } from "react";
import { List, ListOrdered, CheckSquare, ChevronDown, Sparkles } from "lucide-react";
import { theme } from "../../../styles/theme";
import { useAppTranslation } from "../../../i18n/react";
import {
    getInlineMarkdownActions,
    getMarkdownMarker,
    applyMarkdownShortcut,
    applyListFormatting,
    type MarkdownAction,
    type ListType,
} from "../utils/markdownShortcuts";
import { useSelectionToolbar } from "./useSelectionToolbar";
import {cn} from "../../../lib/utils.ts";
import { useAIStore } from "../../../stores/aiStore";

type SelectionToolbarProps = {
    editorRef: RefObject<ReactCodeMirrorRef>;
    enabled: boolean;
    placement?: "top" | "bottom";
};

const ACTION_TEXT_STYLE: Record<MarkdownAction, CSSProperties> = {
    bold: { fontWeight: Number(theme.typography.fontWeight.bold) },
    italic: { fontStyle: "italic" },
    strikethrough: { textDecoration: "line-through" },
};

const ACTION_LABEL_KEYS: Record<MarkdownAction, string> = {
    bold: "editor.selectionToolbar.bold",
    italic: "editor.selectionToolbar.italic",
    strikethrough: "editor.selectionToolbar.strikethrough",
};

function getActionButtonLabel(action: MarkdownAction): string {
    if (action === "strikethrough") {
        return "S";
    }

    return action === "bold" ? "B" : "I";
}

function ListDropdown({
                          onSelect,
                          t,
                      }: {
    onSelect: (listType: ListType) => void;
    t: (key: string) => string;
}, placement = "bottom",) {
    const [isOpen, setIsOpen] = useState(false);

    const options: { type: ListType; icon: React.ReactNode; label: string }[] = [
        { type: "bulleted", icon: <List size={14} />, label: t("editor.selectionToolbar.bulletedList") },
        { type: "numbered", icon: <ListOrdered size={14} />, label: t("editor.selectionToolbar.numberedList") },
        { type: "todo", icon: <CheckSquare size={14} />, label: t("editor.selectionToolbar.todoList") },
    ];

    return (
        <div className={cn("relative flex items-center h-8", placement === 'top'
            ? "-translate-y-full mb-2 origin-bottom"
            : "mt-2 origin-top")} style={{ fontFamily: theme.typography.fontFamily.sans }}>
            {/* Primary Action Button (Bulleted List) */}
            <button
                type="button"
                aria-label={options[0].label}
                title={options[0].label}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSelect("bulleted")}
                className="flex items-center justify-center h-8 w-8 rounded-l-md border-none transition-colors hover:bg-black/5"
                style={{
                    color: theme.colors.text.primary,
                    backgroundColor: "transparent",
                    cursor: "pointer",
                }}
            >
                <List size={16} />
            </button>

            {/* Dropdown Trigger */}
            <button
                type="button"
                aria-haspopup="true"
                aria-expanded={isOpen}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-center h-8 w-4 rounded-r-md border-none transition-colors hover:bg-black/5"
                style={{
                    color: theme.colors.text.secondary,
                    backgroundColor: "transparent",
                    cursor: "pointer",
                    borderLeft: `1px solid ${theme.colors.border.light}`,
                }}
            >
                <ChevronDown size={12} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onMouseDown={(e) => {
                            setIsOpen(false);
                            e.preventDefault();
                        }}
                    />
                    <div
                        className="absolute bottom-full mb-1 left-0 flex flex-col overflow-hidden rounded-md border min-w-[160px] z-50 py-1"
                        style={{
                            backgroundColor: theme.colors.background.secondary,
                            borderColor: theme.colors.border.light,
                            boxShadow: theme.shadows.md,
                        }}
                    >
                        {options.map((option) => (
                            <button
                                key={option.type}
                                type="button"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    setIsOpen(false);
                                    onSelect(option.type);
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm transition-colors hover:bg-black/5 w-full text-left"
                                style={{
                                    color: theme.colors.text.primary,
                                    backgroundColor: "transparent",
                                    border: "none",
                                    cursor: "pointer",
                                }}
                            >
                                <span style={{ color: theme.colors.text.secondary }}>{option.icon}</span>
                                {option.label}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

const AI_ACTIONS = [
    { id: "summarise", label: "Summarise", prompt: "Summarise the following text concisely:" },
    { id: "expand", label: "Expand", prompt: "Expand and elaborate on the following text:" },
    { id: "rephrase", label: "Rephrase", prompt: "Rephrase the following text to improve clarity:" },
    { id: "translate", label: "Translate to English", prompt: "Translate the following text to English:" },
];

function AIDropdown({ onSelect }: { onSelect: (prompt: string, context: string) => void }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative flex items-center h-8">
            <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setIsOpen((v) => !v)}
                title="AI Writing Assistant"
                className="flex items-center gap-1 px-2 h-8 rounded-md border-none transition-colors hover:bg-black/5 text-xs font-medium"
                style={{ color: "var(--primary)", backgroundColor: "transparent", cursor: "pointer" }}
            >
                <Sparkles size={13} />
                AI
                <ChevronDown size={11} />
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onMouseDown={(e) => { setIsOpen(false); e.preventDefault(); }}
                    />
                    <div
                        className="absolute bottom-full mb-1 left-0 flex flex-col overflow-hidden rounded-md border min-w-[160px] z-50 py-1"
                        style={{
                            backgroundColor: theme.colors.background.secondary,
                            borderColor: theme.colors.border.light,
                            boxShadow: theme.shadows.md,
                        }}
                    >
                        <div
                            className="px-3 py-1 text-[0.625rem] font-semibold uppercase tracking-widest"
                            style={{ color: theme.colors.text.muted }}
                        >
                            AI Actions
                        </div>
                        {AI_ACTIONS.map((action) => (
                            <button
                                key={action.id}
                                type="button"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    setIsOpen(false);
                                    onSelect(action.prompt, "");
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm transition-colors hover:bg-black/5 w-full text-left"
                                style={{
                                    color: theme.colors.text.primary,
                                    backgroundColor: "transparent",
                                    border: "none",
                                    cursor: "pointer",
                                }}
                            >
                                {action.label}
                            </button>
                        ))}
                        <div style={{ height: 1, background: theme.colors.border.light, margin: "4px 0" }} />
                        <button
                            type="button"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                setIsOpen(false);
                                onSelect("", "");
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm transition-colors hover:bg-black/5 w-full text-left"
                            style={{
                                color: "var(--primary)",
                                backgroundColor: "transparent",
                                border: "none",
                                cursor: "pointer",
                            }}
                        >
                            <Sparkles size={12} />
                            Open AI Panel…
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

export function SelectionToolbar({ editorRef, enabled }: SelectionToolbarProps) {
    const { t } = useAppTranslation("core");
    const toolbarRef = useRef<HTMLDivElement>(null);
    const { isOpen, x, y, placement, refresh } = useSelectionToolbar({
        editorRef,
        toolbarRef,
        enabled,
    });
    const openAIPanel = useAIStore((s) => s.openPanel);

    if (!isOpen) {
        return null;
    }

    const handleAction = (action: MarkdownAction) => {
        const view = editorRef.current?.view;
        if (!view) {
            return;
        }

        applyMarkdownShortcut(view, getMarkdownMarker(action));
        view.focus();
        requestAnimationFrame(refresh);
    };

    const handleAIAction = (prompt: string, _context: string) => {
        const view = editorRef.current?.view;
        const selectedText = view
            ? view.state.sliceDoc(
                  view.state.selection.main.from,
                  view.state.selection.main.to
              )
            : "";
        openAIPanel({ prompt, context: selectedText });
    };

    return (
        <div
            ref={toolbarRef}
            role="toolbar"
            aria-label={t("editor.selectionToolbar.label")}
            className="flex items-center gap-1 px-2 py-1.5"
            style={{
                position: "absolute",
                left: x,
                top: y,
                transform: `translate(-50%, ${placement === 'top' ? '-100%' : '0'})`,
                zIndex: 50,
                borderRadius: theme.borderRadius.lg,
                backgroundColor: theme.colors.background.secondary,
                border: `1px solid ${theme.colors.border.light}`,
                boxShadow: theme.shadows.lg,
            }}
        >
            {getInlineMarkdownActions().map((action) => {
                const actionLabel = t(ACTION_LABEL_KEYS[action.id]);

                return (
                    <button
                        key={action.id}
                        type="button"
                        aria-label={actionLabel}
                        title={actionLabel}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handleAction(action.id)}
                        className="h-8 w-8 rounded-md border-none text-sm transition-colors"
                        style={{
                            color: theme.colors.text.primary,
                            backgroundColor: "transparent",
                            cursor: "pointer",
                            fontFamily: theme.typography.fontFamily.sans,
                            ...ACTION_TEXT_STYLE[action.id],
                        }}
                    >
                        {getActionButtonLabel(action.id)}
                    </button>
                );
            })}

            <div
                className="h-5 w-px mx-1"
                style={{ backgroundColor: theme.colors.border.light }}
            />

            <ListDropdown
                t={t}
                onSelect={(listType) => {
                    const view = editorRef.current?.view;
                    if (!view) return;
                    applyListFormatting(view, listType);
                    view.focus();
                    requestAnimationFrame(refresh);
                }}
            />

            <div
                className="h-5 w-px mx-1"
                style={{ backgroundColor: theme.colors.border.light }}
            />

            <AIDropdown onSelect={handleAIAction} />
        </div>
    );
}