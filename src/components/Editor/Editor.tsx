import CodeMirror, { ReactCodeMirrorRef } from "@uiw/react-codemirror";
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
import { useEditorExtensions } from "./hooks/useEditorExtensions";
import { CalloutType } from "../../constants/callout-types";
import { TessellumApp, useTessellumApp } from "../../plugins/TessellumApp";
import { PaletteCommand } from "../../plugins/api/UIAPI";
import { EditorView } from "@codemirror/view";
import { Extension } from "@codemirror/state";
import { Calendar, Clock } from "lucide-react";
import { theme } from "../../styles/theme";

function normalizeTimestampSeconds(value: number): number {
    if (value > 1_000_000_000_000) {
        return Math.floor(value / 1000);
    }
    return value;
}

function formatRelativeTime(unixSeconds: number): string {
    const now = Date.now();
    const seconds = normalizeTimestampSeconds(unixSeconds);
    const diffMs = now - seconds * 1000;
    const minutes = Math.floor(diffMs / 60000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
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
                          }: {
    vaultPath?: string | null;
    primaryAction?: PaletteCommand;
}) {
    return (
        <div className="h-full flex items-center justify-center select-none">
            <div
                className="text-center space-y-3"
                style={{ color: theme.colors.text.muted, maxWidth: "720px", margin: "0 auto" }}
            >
                <div className="text-lg font-semibold" style={{ color: theme.colors.text.secondary }}>
                    {vaultPath ? "Start a new note" : "Open a vault to begin"}
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
                        }}
                    >
                        {vaultPath ? "Create New Note" : "Open Vault"}
                    </button>
                )}
            </div>
        </div>
    );
}

function EditorLoadingState() {
    return <div className="p-10">Loading...</div>;
}

function EditorHeader({
                          title,
                          onTitleChange,
                          onTitleBlur,
                          editedAt,
                          lastModified,
                          titleFontSizePx,
                      }: {
    title: string;
    onTitleChange: (value: string) => void;
    onTitleBlur: () => void;
    editedAt: string;
    lastModified: number;
    titleFontSizePx: number;
}) {
    return (
        <div className="w-full mx-auto px-12 pt-20 pb-16 flex-shrink-0" style={{ borderColor: theme.colors.border.light }}>
            <div style={{ maxWidth: "720px", margin: "0 auto" }}>
                <input
                    className="text-[28px] font-bold bg-transparent outline-none border-none w-full"
                    style={{
                        color: theme.colors.text.primary,
                        fontFamily: theme.typography.fontFamily.mono,
                        fontSize: titleFontSizePx,
                        textAlign: "left",
                        paddingTop: 8,
                    }}
                    value={title}
                    onChange={(e) => onTitleChange(e.target.value)}
                    onBlur={onTitleBlur}
                    placeholder="Untitled"
                />
                <div className="flex items-center gap-3 text-[11px] mt-5" style={{ color: theme.colors.text.muted, paddingBottom: 20 }}>
                    <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {new Date(normalizeTimestampSeconds(lastModified) * 1000).toLocaleDateString()}
                    </span>
                    {editedAt && (
                        <span className="flex items-center gap-1">
                            <Clock size={12} />
                            Edited {editedAt}
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
                        editorFontSizePx,
                        content,
                        activeNotePath,
                        pluginExtensions,
                        slashExtension,
                        wikiLinkSuggestionsExtension,
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
    editorFontSizePx: number;
    content: string;
    activeNotePath: string;
    pluginExtensions: Extension[];
    slashExtension: Extension;
    wikiLinkSuggestionsExtension: Extension;
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
        <div className="w-full relative min-h-0 cursor-text" style={{ "--editor-font-size": `${editorFontSizePx}px` } as CSSProperties}>
            <div className="relative w-full">
                <CodeMirror
                    ref={editorRef}
                    key={activeNotePath}
                    value={content}
                    extensions={[
                        ...pluginExtensions,
                        slashExtension,
                        wikiLinkSuggestionsExtension,
                        lightTheme,
                    ]}
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
    const { activeNote, vaultPath, editorFontSizePx } = useEditorStore();
    const { content, isLoading, handleContentChange } = useFileSynchronization(activeNote);
    const editorRef = useRef<ReactCodeMirrorRef>(null);
    useEditorFontZoom(editorRef);
    const { noteRenaming } = useEditorActions();
    const app = useTessellumApp();

    const handleSlashSelectRef = useRef<(cmd: Command, view?: EditorView) => void>();
    const { slashExtension, slashProps } = useSlashCommand((cmd, view) => {
        handleSlashSelectRef.current?.(cmd, view);
    });

    const pluginExtensions = useEditorExtensions();
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

    if (!activeNote) {
        const primaryAction = getPrimaryAction(vaultPath, newNoteCommand, openVaultCommand);
        return <EmptyEditorState vaultPath={vaultPath} primaryAction={primaryAction} />;
    }

    if (isLoading) {
        return <EditorLoadingState />;
    }

    const editedAt = activeNote.last_modified ? formatRelativeTime(activeNote.last_modified) : "";

    return (
        <div className="h-full w-full flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto editor-scroll-shell">
                <EditorHeader
                    title={noteRenaming.titleInput}
                    onTitleChange={noteRenaming.setTitleInput}
                    onTitleBlur={noteRenaming.handleRename}
                    editedAt={editedAt}
                    titleFontSizePx={titleFontSizePx}
                    lastModified={activeNote.last_modified}
                />
                <div className="w-full border-b" style={dividerStyle} />
                <EditorBody
                    editorRef={editorRef}
                    content={content}
                    activeNotePath={activeNote.path}
                    pluginExtensions={pluginExtensions}
                    slashExtension={slashExtension}
                    wikiLinkSuggestionsExtension={wikiLinkSuggestionsExtension}
                    handleContentChange={handleContentChange}
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
            </div>
        </div>
    );
}






