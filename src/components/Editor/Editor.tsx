import CodeMirror, { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { invoke } from "@tauri-apps/api/core";
import {
    useRef,
    useState,
    useCallback,
    useEffect,
    useMemo,
    RefObject
} from "react";
import type { CSSProperties } from "react";
import { useEditorStore } from "../../stores/editorStore";
import { useEditorFontZoom, useSlashCommand, useWikiLinkSuggestions } from "./hooks";
import { Command } from "../../plugins/types";
import { SlashMenu } from "./SlashMenu";
import { WikiLinkSuggestionsMenu } from "./WikiLinkSuggestionsMenu";
import { CalloutPicker } from "./CalloutPicker";
import { TableSizePicker } from "./TableSizePicker";
import { useEditorActions, useFileSynchronization } from "./hooks/useEditorActions";
import { cn } from "../../lib/utils";
import { lightTheme } from "./themes/lightTheme";
import { useEditorExtensions } from "./hooks";
import { CalloutType } from "../../constants/callout-types";
import { TessellumApp, useTessellumApp } from "../../plugins/TessellumApp";
import { PaletteCommand } from "../../plugins/api/UIAPI";
import { EditorView } from "@codemirror/view";
import { Extension } from "@codemirror/state";
import { Calendar, Clock } from "lucide-react";
import { theme } from "../../styles/theme";
import { isMediaFile } from "../../utils/fileType";
import { MediaPreview } from "./MediaPreview";
import { EDITOR_MODES } from "../../constants/editorModes";
import { useEditorModeStore } from "../../stores/editorModeStore";
import { markdownPreviewForceHideFacet } from "./extensions/markdown-preview-plugin";
import { TabStrip, type Tab } from "./TabStrip";
import { useAccessibilityStore } from "../../stores";
import { WorkspaceOverview } from "./workspaceOverview/WorkspaceOverview";
import type { HeroProjection, WorkspaceCardItem } from "./workspaceOverview/types";
import { useAppTranslation } from "../../i18n/react.tsx";
import { SelectionToolbar } from "./toolbar/SelectionToolbar";
import {
    applyMarkdownShortcut,
    getMarkdownMarker,
    matchesMarkdownShortcut,
    matchesTabNavigationShortcut,
} from "./utils/markdownShortcuts.ts";

interface NoteCardMetadata {
    contentPreview: string;
    tags: string[];
}

function extractFrontmatter(rawContent: string): { frontmatter: string; body: string } {
    const normalized = rawContent.replace(/\r\n/g, "\n");
    if (!normalized.startsWith("---\n")) {
        return { frontmatter: "", body: normalized };
    }

    const endIndex = normalized.indexOf("\n---\n", 4);
    if (endIndex === -1) {
        return { frontmatter: "", body: normalized };
    }

    return {
        frontmatter: normalized.slice(4, endIndex),
        body: normalized.slice(endIndex + 5),
    };
}

function parseFrontmatterTags(frontmatter: string): string[] {
    if (!frontmatter.trim()) {
        return [];
    }

    const inlineTagsMatch = frontmatter.match(/^\s*tags\s*:\s*\[(.*?)\]\s*$/m);
    if (inlineTagsMatch) {
        const inner = inlineTagsMatch[1].trim();
        if (!inner) return [];
        return inner
            .split(",")
            .map((value) => value.trim().replace(/^['"]|['"]$/g, ""))
            .filter(Boolean);
    }

    const lineMatch = frontmatter.match(/^\s*tags\s*:\s*(.+)\s*$/m);
    if (lineMatch && !lineMatch[1].startsWith("[")) {
        const inlineValue = lineMatch[1].trim().replace(/^['"]|['"]$/g, "");
        if (inlineValue) {
            return [inlineValue];
        }
    }

    const blockMatch = frontmatter.match(/^\s*tags\s*:\s*\n((?:\s*-\s*.+\n?)*)/m);
    if (!blockMatch) {
        return [];
    }

    return blockMatch[1]
        .split("\n")
        .map((line) => line.match(/^\s*-\s*(.+)\s*$/)?.[1] ?? "")
        .map((value) => value.trim().replace(/^['"]|['"]$/g, ""))
        .filter(Boolean);
}

function stripMarkdownSyntax(rawText: string): string {
    return rawText
        .replace(/`{1,3}[^`]*`{1,3}/g, " ")
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
        .replace(/(^|\s)(#{1,6}\s*)/g, "$1")
        .replace(/^[-*_]{3,}\s*$/gm, " ")
        .replace(/^\s*>\s?/gm, "")
        .replace(/^\s*[-*]\s+/gm, "")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .replace(/~~([^~]+)~~/g, "$1")
        .replace(/[*_~`>#-]/g, " ");
}

function buildContentPreview(rawContent: string, emptyPreviewText: string): NoteCardMetadata {
    const { frontmatter, body } = extractFrontmatter(rawContent);
    const tags = parseFrontmatterTags(frontmatter);
    const plainText = stripMarkdownSyntax(body);
    const collapsed = plainText
        .replace(/\r\n/g, "\n")
        .replace(/\t/g, " ")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join(" ");

    if (!collapsed) {
        return { contentPreview: emptyPreviewText, tags };
    }

    return {
        contentPreview: collapsed.slice(0, 180),
        tags,
    };
}

function buildShortPath(path: string, minSegments = 2, maxSegments = 3): string {
    const segments = path
        .split(/[\\/]+/)
        .map((segment) => segment.trim())
        .filter(Boolean);

    if (segments.length <= maxSegments) {
        return segments.join(" / ");
    }

    const takeCount = Math.max(minSegments, maxSegments);
    return segments.slice(-takeCount).join(" / ");
}

function normalizeTimestampSeconds(value: number): number {
    if (value > 1_000_000_000_000) {
        return Math.floor(value / 1000);
    }
    return value;
}

function formatRelativeTime(unixSeconds: number, locale: string): string {
    const now = Date.now();
    const seconds = normalizeTimestampSeconds(unixSeconds);
    const diffMs = now - seconds * 1000;
    const minutes = Math.floor(diffMs / 60000);

    if (minutes < 1) {
        return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(0, "minute");
    }
    if (minutes < 60) {
        return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-minutes, "minute");
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-hours, "hour");
    }

    const days = Math.floor(hours / 24);
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-days, "day");
}

function createTableMarkdown(rows: number, cols: number) {
    const headerCells = Array.from({ length: cols }, (_, i) => `Header ${i + 1}`);
    const separatorCells = Array.from({ length: cols }, () => "---");
    const emptyRow = Array.from({ length: cols }, () => "   ");

    const lines = [
        `| ${headerCells.join(" | ")} |`,
        `| ${separatorCells.join(" | ")} |`,
        ...Array.from({ length: rows }, () => `| ${emptyRow.join(" | ")} |`),
    ];

    const insertText = `${lines.join("\n")}\n`;
    const selectionOffset = lines[0].length + 1 + lines[1].length + 1 + 2;

    return { insertText, selectionOffset };
}

function getPrimaryAction(vaultPath: string | null | undefined, newNote?: PaletteCommand, openVault?: PaletteCommand) {
    return vaultPath ? newNote : openVault;
}

function useEditorViewRegistration(editorRef: React.RefObject<ReactCodeMirrorRef>) {
    useEffect(() => {
        const view = editorRef.current?.view;
        if (view) {
            TessellumApp.instance.editor.setView(view);
        }
        return () => {
            TessellumApp.instance.editor.setView(null);
        };
    }, [editorRef.current?.view]);
}

function useSlashInsertions(
    editorRef: React.RefObject<ReactCodeMirrorRef>,
    slashProps: ReturnType<typeof useSlashCommand>["slashProps"]
) {
    const slashPosRef = useRef<number | null>(null);

    const [calloutPickerOpen, setCalloutPickerOpen] = useState(false);
    const [calloutPickerPos, setCalloutPickerPos] = useState({ x: 0, y: 0, placement: "bottom" as "top" | "bottom" });
    const [calloutPickerIndex, setCalloutPickerIndex] = useState(0);

    const [tablePickerOpen, setTablePickerOpen] = useState(false);
    const [tablePickerPos, setTablePickerPos] = useState({ x: 0, y: 0, placement: "bottom" as "top" | "bottom" });

    const { position, closeMenu, performCommand } = slashProps;

    const getActiveView = (explicitView?: EditorView) => explicitView || editorRef.current?.view;

    const saveSlashPos = (view?: EditorView) => {
        if (!view) return;
        const cursorPos = view.state.selection.main.from;
        const line = view.state.doc.lineAt(cursorPos);
        const lineOffset = cursorPos - line.from;
        const slashPos = line.text.lastIndexOf("/", lineOffset);
        if (slashPos !== -1) {
            slashPosRef.current = line.from + slashPos;
        }
    };

    const closePicker = useCallback(
        (close: () => void) => {
            close();
            slashPosRef.current = null;
            editorRef.current?.view?.focus();
        },
        [editorRef]
    );

    const openPicker = useCallback(
        (
            view: EditorView | undefined,
            setOpen: (open: boolean) => void,
            setPos: (pos: { x: number; y: number; placement: "top" | "bottom" }) => void
        ) => {
            saveSlashPos(view);
            setPos({
                x: position.x,
                y: position.y,
                placement: position.placement,
            });
            closeMenu();
            setOpen(true);
        },
        [closeMenu, position.x, position.y, position.placement]
    );

    const insertTextAtSelection = useCallback(
        (view: EditorView, insertText: string, selectionOffset: number) => {
            const insertFrom = slashPosRef.current ?? view.state.selection.main.from;
            const cursorPos = view.state.selection.main.from;

            view.dispatch({
                changes: {
                    from: insertFrom,
                    to: cursorPos,
                    insert: insertText,
                },
                selection: {
                    anchor: insertFrom + selectionOffset,
                },
            });
        },
        []
    );

    const handleSlashSelect = useCallback(
        (item: Command, explicitView?: EditorView) => {
            const activeView = getActiveView(explicitView);

            if (item.id === "core:callout") {
                openPicker(activeView, setCalloutPickerOpen, setCalloutPickerPos);
                setCalloutPickerIndex(0);
                return;
            }

            if (item.id === "table:insert") {
                openPicker(activeView, setTablePickerOpen, setTablePickerPos);
                return;
            }

            if (activeView) {
                performCommand(activeView, item);
            }
        },
        [openPicker, performCommand]
    );

    const handleCalloutSelect = useCallback(
        (calloutType: CalloutType) => {
            const view = editorRef.current?.view;
            if (!view) return;

            const insertText = `> [!${calloutType.id}] ${calloutType.label}\n> `;
            insertTextAtSelection(view, insertText, insertText.length);
            closePicker(() => setCalloutPickerOpen(false));
        },
        [closePicker, editorRef, insertTextAtSelection]
    );

    const closeCalloutPicker = useCallback(() => {
        closePicker(() => setCalloutPickerOpen(false));
    }, [closePicker]);

    const handleTableSelect = useCallback(
        (rows: number, cols: number) => {
            const view = editorRef.current?.view;
            if (!view) return;

            const { insertText, selectionOffset } = createTableMarkdown(rows, cols);
            insertTextAtSelection(view, insertText, selectionOffset);
            closePicker(() => setTablePickerOpen(false));
        },
        [closePicker, editorRef, insertTextAtSelection]
    );

    const closeTablePicker = useCallback(() => {
        closePicker(() => setTablePickerOpen(false));
    }, [closePicker]);

    return {
        handleSlashSelect,
        calloutPickerOpen,
        calloutPickerPos,
        calloutPickerIndex,
        setCalloutPickerIndex,
        handleCalloutSelect,
        closeCalloutPicker,
        tablePickerOpen,
        tablePickerPos,
        handleTableSelect,
        closeTablePicker,
    };
}

function EmptyEditorState({
                              vaultPath,
                              primaryAction,
                              t,
                          }: {
    vaultPath?: string | null;
    primaryAction?: PaletteCommand;
    t: (key: string, options?: Record<string, unknown>) => string;
}) {
    return (
        <div className="h-full flex items-center justify-center select-none">
            <div
                className="text-center space-y-3"
                style={{ color: theme.colors.text.muted, maxWidth: "720px", margin: "0 auto" }}
            >
                <div className="text-lg font-semibold" style={{ color: theme.colors.text.secondary }}>
                    {vaultPath ? t("editor.startNewNote") : t("editor.openVaultToBegin")}
                </div>
                {primaryAction && (
                    <button
                        onClick={primaryAction.onTrigger}
                        className="px-4 py-2 rounded-lg text-sm font-medium"
                        style={{
                            backgroundColor: theme.colors.blue[600],
                            color: "#fff",
                            border: "none",
                            cursor: "pointer",
                            padding: "0.5rem 1rem"
                        }}
                    >
                        {vaultPath ? t("editor.createNewNote") : t("editor.openVault")}
                    </button>
                )}
            </div>
        </div>
    );
}

function buildTabsFromPaths(openTabPaths: string[], files: { path: string; filename: string }[]): Tab[] {
    const fileByPath = new Map(files.map((file) => [file.path, file]));

    return openTabPaths.map((path) => {
        const file = fileByPath.get(path);
        return {
            id: path,
            title: file?.filename ?? path.split(/[\\/]/).pop() ?? path,
            path,
        };
    });
}

function EditorHeader({
                          title,
                          onTitleChange,
                          onTitleBlur,
                          editedAt,
                          lastModified,
                          titleFontSizePx,
                          readOnly,
                          t,
                          locale,
                      }: {
    title: string;
    onTitleChange: (value: string) => void;
    onTitleBlur: () => void;
    editedAt: string;
    lastModified: number;
    titleFontSizePx: number;
    readOnly: boolean;
    t: (key: string, options?: Record<string, unknown>) => string;
    locale: string;
}) {
    return (
        <div className="w-full mx-auto px-12 pt-20 pb-16 flex-shrink-0" style={{ borderColor: theme.colors.border.light }}>
            <div style={{ maxWidth: "720px", margin: "0 auto" }}>
                <input
                    className="text-[1.75rem] font-bold bg-transparent outline-none border-none w-full"
                    style={{
                        color: theme.colors.text.primary,
                        fontFamily: theme.typography.fontFamily.sans,
                        fontSize: `calc(${titleFontSizePx}px * var(--ui-scale, 1))`,
                        textAlign: "left",
                        paddingTop: 8,
                        opacity: readOnly ? 0.7 : 1,
                    }}
                    value={title}
                    onChange={(e) => onTitleChange(e.target.value)}
                    onBlur={onTitleBlur}
                    placeholder={t("editor.untitled")}
                    readOnly={readOnly}
                    disabled={readOnly}
                />
                <div className="flex items-center gap-3 text-[0.6875rem] mt-5" style={{ color: theme.colors.text.muted, paddingBottom: 20 }}>
                    <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {new Date(normalizeTimestampSeconds(lastModified) * 1000).toLocaleDateString(locale)}
                    </span>
                    {editedAt && (
                        <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {t("editor.edited", { value: editedAt })}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

const dividerStyle: CSSProperties = {
    maxWidth: "860px",
    margin: "0 auto",
    borderColor: theme.colors.border.light,
};

function EditorBody({
                        editorRef,
                        activeNotePath,
                        selectionToolbarEnabled,
                        editorFontSizePx,
                        content,
                        editorExtensions,
                        handleContentChange,
                        slashProps,
                        wikiLinkSuggestionsProps,
                        calloutPickerOpen,
                        calloutPickerPos,
                        calloutPickerIndex,
                        setCalloutPickerIndex,
                        handleCalloutSelect,
                        closeCalloutPicker,
                        tablePickerOpen,
                        tablePickerPos,
                        handleTableSelect,
                        closeTablePicker,
                        handleSlashSelect,
                    }: {
    editorRef: RefObject<ReactCodeMirrorRef>;
    activeNotePath: string;
    selectionToolbarEnabled: boolean;
    editorFontSizePx: number;
    content: string;
    editorExtensions: Extension[];
    handleContentChange: (value: string) => void;
    slashProps: ReturnType<typeof useSlashCommand>["slashProps"];
    wikiLinkSuggestionsProps: ReturnType<typeof useWikiLinkSuggestions>["wikiLinkSuggestionsProps"];
    calloutPickerOpen: boolean;
    calloutPickerPos: { x: number; y: number; placement: "top" | "bottom" };
    calloutPickerIndex: number;
    setCalloutPickerIndex: (value: number) => void;
    handleCalloutSelect: (calloutType: CalloutType) => void;
    closeCalloutPicker: () => void;
    tablePickerOpen: boolean;
    tablePickerPos: { x: number; y: number; placement: "top" | "bottom" };
    handleTableSelect: (rows: number, cols: number) => void;
    closeTablePicker: () => void;
    handleSlashSelect: (command: Command, view?: EditorView) => void;
}) {
    return (
        <div
            className="w-full relative min-h-0 cursor-text"
            style={{ "--editor-font-size": `calc(${editorFontSizePx}px * var(--ui-scale, 1))` } as CSSProperties}
        >
            <div className="relative w-full">
                <CodeMirror
                    key={activeNotePath}
                    ref={editorRef}
                    value={content}
                    extensions={editorExtensions}
                    onChange={handleContentChange}
                    height="auto"
                    className={cn(
                        "w-full",
                        (slashProps.isOpen || wikiLinkSuggestionsProps.isOpen || calloutPickerOpen || tablePickerOpen) &&
                        "[&_.cm-scroller]:!overflow-hidden"
                    )}
                    theme={lightTheme}
                    basicSetup={{
                        lineNumbers: false,
                        foldGutter: false,
                        highlightActiveLine: false,
                        highlightActiveLineGutter: false,
                    }}
                />

                <SelectionToolbar
                    editorRef={editorRef}
                    enabled={selectionToolbarEnabled}
                />

                <SlashMenu
                    isOpen={slashProps.isOpen}
                    x={slashProps.position.x}
                    y={slashProps.position.y}
                    placement={slashProps.position.placement}
                    selectedIndex={slashProps.selectedIndex}
                    commands={slashProps.filteredCommands}
                    setSelectedIndex={slashProps.setSelectedIndex}
                    onSelect={handleSlashSelect}
                    onClose={() => {
                        slashProps.closeMenu();
                    }}
                />

                <CalloutPicker
                    isOpen={calloutPickerOpen}
                    x={calloutPickerPos.x}
                    y={calloutPickerPos.y}
                    placement={calloutPickerPos.placement}
                    selectedIndex={calloutPickerIndex}
                    setSelectedIndex={setCalloutPickerIndex}
                    onSelect={handleCalloutSelect}
                    onClose={closeCalloutPicker}
                />

                <TableSizePicker
                    isOpen={tablePickerOpen}
                    x={tablePickerPos.x}
                    y={tablePickerPos.y}
                    placement={tablePickerPos.placement}
                    onSelect={handleTableSelect}
                    onClose={closeTablePicker}
                />

                <WikiLinkSuggestionsMenu
                    isOpen={wikiLinkSuggestionsProps.isOpen}
                    x={wikiLinkSuggestionsProps.position.x}
                    y={wikiLinkSuggestionsProps.position.y}
                    placement={wikiLinkSuggestionsProps.position.placement}
                    selectedIndex={wikiLinkSuggestionsProps.selectedIndex}
                    suggestions={wikiLinkSuggestionsProps.filteredSuggestions}
                    setSelectedIndex={wikiLinkSuggestionsProps.setSelectedIndex}
                    query={wikiLinkSuggestionsProps.query}
                    onSelect={(suggestion) => {
                        if (editorRef.current?.view) {
                            wikiLinkSuggestionsProps.insertWikiLink(editorRef.current.view, suggestion);
                        }
                    }}
                    onClose={() => {
                        wikiLinkSuggestionsProps.closeMenu();
                    }}
                />
            </div>
        </div>
    );
}

export function Editor() {
    const OVERVIEW_DURATION_MS = 460;
    const {
        activeNote,
        vaultPath,
        files,
        openTabPaths,
        setActiveNote,
        reorderOpenTabs,
        closeTab,
        editorFontSizePx,
    } = useEditorStore();
    const editorMode = useEditorModeStore((state) => state.editorMode);
    const reducedMotion = useAccessibilityStore((state) => state.reducedMotion);
    const { content, isLoading, handleContentChange } = useFileSynchronization(activeNote);
    const editorRef = useRef<ReactCodeMirrorRef>(null);
    const editorContainerRef = useRef<HTMLDivElement | null>(null);
    useEditorFontZoom(editorRef);
    const { noteRenaming } = useEditorActions();
    const app = useTessellumApp();
    const { t, i18n } = useAppTranslation("core");
    const [isOverviewOpen, setIsOverviewOpen] = useState(false);
    const [isOverviewMounted, setIsOverviewMounted] = useState(false);
    const [heroProjection] = useState<HeroProjection | null>(null);
    const [reducedMotionFade, setReducedMotionFade] = useState(false);
    const [tabMetadataByPath, setTabMetadataByPath] = useState<Record<string, NoteCardMetadata>>({});
    const transitionTimersRef = useRef<number[]>([]);

    const handleSlashSelectRef = useRef<(cmd: Command, view?: EditorView) => void>();
    const { slashExtension, slashProps } = useSlashCommand((cmd, view) => {
        handleSlashSelectRef.current?.(cmd, view);
    });

    const pluginExtensions = useEditorExtensions(editorMode);
    const { wikiLinkSuggestionsExtension, wikiLinkSuggestionsProps } = useWikiLinkSuggestions(vaultPath || "");
    const {
        handleSlashSelect,
        calloutPickerOpen,
        calloutPickerPos,
        calloutPickerIndex,
        setCalloutPickerIndex,
        handleCalloutSelect,
        closeCalloutPicker,
        tablePickerOpen,
        tablePickerPos,
        handleTableSelect,
        closeTablePicker,
    } = useSlashInsertions(editorRef, slashProps);

    useEditorViewRegistration(editorRef);

    const queueTimer = useCallback((fn: () => void, delay: number) => {
        const id = window.setTimeout(() => {
            transitionTimersRef.current = transitionTimersRef.current.filter((timerId) => timerId !== id);
            fn();
        }, delay);
        transitionTimersRef.current.push(id);
    }, []);

    const closeOverview = useCallback(() => {
        setIsOverviewOpen(false);
        if (reducedMotion) {
            queueTimer(() => setIsOverviewMounted(false), 160);
            return;
        }
        queueTimer(() => setIsOverviewMounted(false), OVERVIEW_DURATION_MS);
    }, [OVERVIEW_DURATION_MS, queueTimer, reducedMotion]);

    const openOverview = useCallback(() => {
        setIsOverviewMounted(true);
        requestAnimationFrame(() => setIsOverviewOpen(true));
    }, []);

    useEffect(() => {
        if (!isOverviewOpen || !vaultPath || openTabPaths.length === 0) {
            return;
        }

        const missingPaths = openTabPaths.filter((path) => tabMetadataByPath[path] === undefined);
        if (missingPaths.length === 0) {
            return;
        }

        let cancelled = false;

        const loadPreviews = async () => {
            const previews = await Promise.all(
                missingPaths.map(async (path) => {
                    if (isMediaFile(path)) {
                        const metadata: NoteCardMetadata = { contentPreview: t("editor.emptyPreview"), tags: [] };
                        return [path, metadata] as const;
                    }
                    try {
                        const content = await invoke<string>("read_file", { vaultPath, path });
                        return [path, buildContentPreview(content, t("editor.emptyPreview"))] as const;
                    } catch (error) {
                        console.error(`Failed to load preview for ${path}:`, error);
                        const metadata: NoteCardMetadata = { contentPreview: t("editor.emptyPreview"), tags: [] };
                        return [path, metadata] as const;
                    }
                })
            );

            if (cancelled) {
                return;
            }

            setTabMetadataByPath((current) => {
                const next = { ...current };
                for (const [path, metadata] of previews) {
                    next[path] = metadata;
                }
                return next;
            });
        };

        loadPreviews();

        return () => {
            cancelled = true;
        };
    }, [isOverviewOpen, openTabPaths, tabMetadataByPath, vaultPath]);

    useEffect(() => {
        if (!vaultPath) {
            setTabMetadataByPath({});
            return;
        }

        setTabMetadataByPath((current) => {
            const openPaths = new Set(openTabPaths);
            let changed = false;
            const next: Record<string, NoteCardMetadata> = {};

            for (const path of Object.keys(current)) {
                if (openPaths.has(path)) {
                    next[path] = current[path];
                } else {
                    changed = true;
                }
            }

            return changed ? next : current;
        });
    }, [openTabPaths, vaultPath]);

    useEffect(() => {
        return () => {
            transitionTimersRef.current.forEach((id) => window.clearTimeout(id));
            transitionTimersRef.current = [];
        };
    }, []);

    useEffect(() => {
        handleSlashSelectRef.current = handleSlashSelect;
    }, [handleSlashSelect]);

    const paletteCommands = app.ui.getPaletteCommands();
    const newNoteCommand = useMemo(
        () => paletteCommands.find((cmd) => cmd.id === "new-note"),
        [paletteCommands]
    );
    const openVaultCommand = useMemo(
        () => paletteCommands.find((cmd) => cmd.id === "open-vault"),
        [paletteCommands]
    );

    const titleFontSizePx = useMemo(() => Math.round(28 * editorFontSizePx / 16), [editorFontSizePx]);
    const isEditable = EDITOR_MODES[editorMode].editable;
    const selectionToolbarEnabled = isEditable && (editorMode === "live-preview" || editorMode === "source");
    const editableExtension = useMemo(() => EditorView.editable.of(isEditable), [isEditable]);
    const previewForceHideExtension = useMemo(
        () => markdownPreviewForceHideFacet.of(!isEditable),
        [isEditable]
    );
    const editorExtensions = useMemo(
        () => [
            ...pluginExtensions,
            editableExtension,
            previewForceHideExtension,
            slashExtension,
            wikiLinkSuggestionsExtension,
            lightTheme,
        ],
        [
            pluginExtensions,
            editableExtension,
            previewForceHideExtension,
            slashExtension,
            wikiLinkSuggestionsExtension,
        ]
    );
    const handleContentChangeGuarded = useCallback(
        (value: string) => {
            if (!isEditable) return;
            handleContentChange(value);
        },
        [handleContentChange, isEditable]
    );

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (target) {
                const tag = target.tagName;
                const isEditor = target.closest(".cm-editor");
                if ((tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) && !isEditor) {
                    return;
                }
            }

            const usesPrimaryModifier = event.ctrlKey || event.metaKey;
            if (!usesPrimaryModifier || event.altKey) {
                return;
            }

            const isOverviewShortcut = !event.shiftKey && (event.code === "Space" || event.key === " ");
            if (isOverviewShortcut) {
                event.preventDefault();
                if (isOverviewOpen) {
                    closeOverview();
                } else {
                    openOverview();
                }
                return;
            }

            if (matchesMarkdownShortcut(event, "bold")) {
                event.preventDefault();
                applyMarkdownShortcut(editorRef.current?.view, getMarkdownMarker("bold"));
                return;
            }

            if (matchesMarkdownShortcut(event, "italic")) {
                event.preventDefault();
                applyMarkdownShortcut(editorRef.current?.view, getMarkdownMarker("italic"));
                return;
            }

            const direction = matchesTabNavigationShortcut(event, "previous")
                ? -1
                : matchesTabNavigationShortcut(event, "next")
                    ? 1
                    : 0;

            if (direction === 0) {
                return;
            }

            const activePath = activeNote?.path;
            if (!activePath) return;

            const activeIndex = openTabPaths.indexOf(activePath);
            if (activeIndex === -1) return;

            const targetIndex = activeIndex + direction;
            if (targetIndex < 0 || targetIndex >= openTabPaths.length) {
                return;
            }

            const targetPath = openTabPaths[targetIndex];
            const targetFile = files.find((file) => file.path === targetPath);
            if (!targetFile) return;

            event.preventDefault();
            setActiveNote(targetFile);
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [activeNote?.path, closeOverview, files, isOverviewOpen, openOverview, openTabPaths, setActiveNote]);

    if (!activeNote) {
        const primaryAction = getPrimaryAction(vaultPath, newNoteCommand, openVaultCommand);
        return <EmptyEditorState vaultPath={vaultPath} primaryAction={primaryAction} t={t} />;
    }

    const editedAt = activeNote.last_modified ? formatRelativeTime(activeNote.last_modified, i18n.language) : "";

    const isMedia = isMediaFile(activeNote.path);
    const tabs = buildTabsFromPaths(openTabPaths, files);
    const filesByPath = new Map(files.map((file) => [file.path, file]));
    const overviewCards: WorkspaceCardItem[] = tabs.map((tab, order) => {
        const file = filesByPath.get(tab.path);
        return {
            id: tab.id,
            title: tab.title,
            path: tab.path,
            shortPath: buildShortPath(tab.path),
            contentPreview: tabMetadataByPath[tab.path]?.contentPreview ?? t("editor.emptyPreview"),
            tags: tabMetadataByPath[tab.path]?.tags ?? [],
            lastModified: file?.last_modified ?? 0,
            isActive: tab.id === activeNote.path,
            order,
        };
    });

    const handleTabChange = (id: string) => {
        const target = files.find((file) => file.path === id);
        if (!target) return;
        setActiveNote(target);
    };

    const handleTabClose = (id: string) => {
        closeTab(id);
    };

    const handleTabReorder = (sourceId: string, targetIndex: number) => {
        reorderOpenTabs(sourceId, targetIndex);
    };

    const handleOverviewToggle = () => {
        if (isOverviewOpen) {
            closeOverview();
        } else {
            openOverview();
        }
    };

    const handleOverviewSelect = (id: string) => {
        const target = filesByPath.get(id);
        if (!target) return;

        if (reducedMotion) {
            setReducedMotionFade(true);
            setActiveNote(target);
            closeOverview();
            queueTimer(() => setReducedMotionFade(false), 180);
            return;
        }

        const editorRect = editorContainerRef.current?.getBoundingClientRect();

        if (!editorRect) {
            setActiveNote(target);
            closeOverview();
            return;
        }

        queueTimer(() => setActiveNote(target), 0);
        queueTimer(() => {
            setIsOverviewMounted(false);
        }, OVERVIEW_DURATION_MS);
        setIsOverviewOpen(false);
    };

    const editorSurface = (
        <div
            className="min-h-full overflow-hidden"
            style={{
                backgroundColor: theme.colors.background.primary,
                border: `0.5px solid ${theme.colors.border.light}`,
            }}
        >
            <EditorHeader
                title={noteRenaming.titleInput}
                onTitleChange={noteRenaming.setTitleInput}
                onTitleBlur={noteRenaming.handleRename}
                editedAt={editedAt}
                titleFontSizePx={titleFontSizePx}
                lastModified={activeNote.last_modified}
                readOnly={!isEditable}
                t={t}
                locale={i18n.language}
            />
            <div className="w-full border-b" style={dividerStyle} />
            <EditorBody
                editorRef={editorRef}
                activeNotePath={activeNote.path}
                selectionToolbarEnabled={selectionToolbarEnabled}
                content={content}
                editorExtensions={editorExtensions}
                handleContentChange={handleContentChangeGuarded}
                slashProps={slashProps}
                wikiLinkSuggestionsProps={wikiLinkSuggestionsProps}
                editorFontSizePx={editorFontSizePx}
                calloutPickerOpen={calloutPickerOpen}
                calloutPickerPos={calloutPickerPos}
                calloutPickerIndex={calloutPickerIndex}
                setCalloutPickerIndex={setCalloutPickerIndex}
                handleCalloutSelect={handleCalloutSelect}
                closeCalloutPicker={closeCalloutPicker}
                tablePickerOpen={tablePickerOpen}
                tablePickerPos={tablePickerPos}
                handleTableSelect={handleTableSelect}
                closeTablePicker={closeTablePicker}
                handleSlashSelect={handleSlashSelect}
            />
            {isLoading && (
                <div className="pointer-events-none px-12 py-3 text-xs" style={{ color: theme.colors.text.muted }}>
                    {t("editor.loadingNote")}
                </div>
            )}
        </div>
    );

    return (
        <div className="h-full w-full flex flex-col overflow-hidden pt-1">
            <TabStrip
                tabs={tabs}
                activeTabId={activeNote.path}
                onTabChange={handleTabChange}
                onTabClose={handleTabClose}
                onTabReorder={handleTabReorder}
                onOverviewToggle={handleOverviewToggle}
                isOverviewOpen={isOverviewOpen}
                editorFontSizePx={editorFontSizePx}
            />
            <div className="flex-1 min-h-0 relative" ref={editorContainerRef}>
                {!isMedia && (
                    <div className="flex h-full px-3 py-3 gap-2">
                        <div
                            className="flex-1 min-w-0 h-full overflow-y-auto editor-scroll-shell"
                            style={{
                                transform: isOverviewOpen && !reducedMotion ? "scale(0.85)" : "scale(1)",
                                transformOrigin: "center center",
                                borderRadius: isOverviewOpen && !reducedMotion ? "0.5rem" : "0.25rem",
                                boxShadow: isOverviewOpen && !reducedMotion ? "0 26px 54px rgba(0,0,0,0.35)" : "0 0 0 rgba(0,0,0,0)",
                                opacity: reducedMotionFade ? 0.7 : 1,
                                transition: reducedMotion
                                    ? "opacity 170ms linear"
                                    : `transform ${OVERVIEW_DURATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1), border-radius ${OVERVIEW_DURATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow ${OVERVIEW_DURATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1), opacity 170ms linear`,
                                willChange: "transform, opacity",
                            }}
                        >
                            {editorSurface}
                        </div>
                    </div>
                )}
                {isMedia && (
                    <div className="h-full w-full">
                        <MediaPreview path={activeNote.path} />
                    </div>
                )}
                <WorkspaceOverview
                    cards={overviewCards}
                    isOpen={isOverviewOpen}
                    isMounted={isOverviewMounted}
                    reducedMotion={reducedMotion}
                    durationMs={OVERVIEW_DURATION_MS}
                    heroProjection={heroProjection}
                    onClose={closeOverview}
                    onSelectCard={handleOverviewSelect}
                />
            </div>
        </div>
    );
}
