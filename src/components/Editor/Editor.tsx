import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { useEditorStore } from '../../stores/editorStore';
import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useSlashCommand, useWikiLinkSuggestions } from "./hooks";
import { Command } from "../../plugins/types";
import { SlashMenu } from "./SlashMenu";
import { WikiLinkSuggestionsMenu } from "./WikiLinkSuggestionsMenu";
import { CalloutPicker } from "./CalloutPicker";
import { TableSizePicker } from "./TableSizePicker";
import { useEditorActions, useFileSynchronization } from "./hooks/useEditorActions";
import { cn } from '../../lib/utils';
import { lightTheme } from "./themes/lightTheme";
import { useEditorExtensions } from "./hooks/useEditorExtensions";
import { CalloutType } from "../../constants/callout-types";
import { TessellumApp, useTessellumApp } from "../../plugins/TessellumApp";
import { EditorView } from "@codemirror/view";
import { Calendar, Clock } from "lucide-react";
import { theme } from '../../styles/theme';

function normalizeTimestampSeconds(value: number): number { if (value > 1_000_000_000_000) { return Math.floor(value / 1000); } return value; } function formatRelativeTime(unixSeconds: number): string {
    const now = Date.now();
    const seconds = normalizeTimestampSeconds(unixSeconds); const diffMs = now - seconds * 1000;
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

export function Editor() {
    const { activeNote, vaultPath } = useEditorStore();
    const { content, isLoading, handleContentChange } = useFileSynchronization(activeNote);
    const editorRef = useRef<ReactCodeMirrorRef>(null);
    const { noteRenaming } = useEditorActions();
    const app = useTessellumApp();

    const handleSlashSelectRef = useRef<(cmd: Command, view?: EditorView) => void>();
    const { slashExtension, slashProps } = useSlashCommand((cmd, view) => {
        handleSlashSelectRef.current?.(cmd, view);
    });

    const pluginExtensions = useEditorExtensions();

    const [calloutPickerOpen, setCalloutPickerOpen] = useState(false);
    const [calloutPickerPos, setCalloutPickerPos] = useState({ x: 0, y: 0, placement: 'bottom' as 'top' | 'bottom' });
    const [calloutPickerIndex, setCalloutPickerIndex] = useState(0);

    const [tablePickerOpen, setTablePickerOpen] = useState(false);
    const [tablePickerPos, setTablePickerPos] = useState({ x: 0, y: 0, placement: 'bottom' as 'top' | 'bottom' });

    const slashPosRef = useRef<number | null>(null);

    const { wikiLinkSuggestionsExtension, wikiLinkSuggestionsProps } = useWikiLinkSuggestions(vaultPath || "");

    useEffect(() => {
        const view = editorRef.current?.view;
        if (view) {
            TessellumApp.instance.editor.setView(view);
        }
        return () => {
            TessellumApp.instance.editor.setView(null);
        };
    }, [editorRef.current?.view]);

    const handleSlashSelect = useCallback((item: Command, explicitView?: EditorView) => {
        const activeView = explicitView || editorRef.current?.view;

        const saveSlashPos = () => {
            if (activeView) {
                const cursorPos = activeView.state.selection.main.from;
                const line = activeView.state.doc.lineAt(cursorPos);
                const lineOffset = cursorPos - line.from;
                const slashPos = line.text.lastIndexOf('/', lineOffset);
                if (slashPos !== -1) {
                    slashPosRef.current = line.from + slashPos;
                }
            }
        };

        if (item.id === 'core:callout') {
            saveSlashPos();
            setCalloutPickerPos({
                x: slashProps.position.x,
                y: slashProps.position.y,
                placement: slashProps.position.placement
            });
            setCalloutPickerIndex(0);
            slashProps.closeMenu();
            setCalloutPickerOpen(true);
        } else if (item.id === 'table:insert') {
            saveSlashPos();
            setTablePickerPos({
                x: slashProps.position.x,
                y: slashProps.position.y,
                placement: slashProps.position.placement
            });
            slashProps.closeMenu();
            setTablePickerOpen(true);
        } else {
            if (activeView) {
                slashProps.performCommand(activeView, item);
            }
        }
    }, [slashProps]);

    useEffect(() => {
        handleSlashSelectRef.current = handleSlashSelect;
    }, [handleSlashSelect]);

    const handleCalloutSelect = useCallback((calloutType: CalloutType) => {
        const view = editorRef.current?.view;
        if (!view) return;

        const insertFrom = slashPosRef.current ?? view.state.selection.main.from;
        const cursorPos = view.state.selection.main.from;
        const insertText = `> [!${calloutType.id}] ${calloutType.label}\n> `;

        view.dispatch({
            changes: {
                from: insertFrom,
                to: cursorPos,
                insert: insertText,
            },
            selection: {
                anchor: insertFrom + insertText.length,
            },
        });

        setCalloutPickerOpen(false);
        slashPosRef.current = null;
        view.focus();
    }, []);

    const closeCalloutPicker = useCallback(() => {
        setCalloutPickerOpen(false);
        slashPosRef.current = null;
        editorRef.current?.view?.focus();
    }, []);

    const handleTableSelect = useCallback((rows: number, cols: number) => {
        const view = editorRef.current?.view;
        if (!view) return;

        const insertFrom = slashPosRef.current ?? view.state.selection.main.from;
        const cursorPos = view.state.selection.main.from;

        const headerCells = Array.from({ length: cols }, (_, i) => `Header ${i + 1}`);
        const separatorCells = Array.from({ length: cols }, () => "---");
        const emptyRow = Array.from({ length: cols }, () => "   ");

        const lines = [
            `| ${headerCells.join(" | ")} |`,
            `| ${separatorCells.join(" | ")} |`,
            ...Array.from({ length: rows }, () => `| ${emptyRow.join(" | ")} |`),
        ];
        const insertText = lines.join("\n") + "\n";

        view.dispatch({
            changes: {
                from: insertFrom,
                to: cursorPos,
                insert: insertText,
            },
            selection: {
                anchor: insertFrom + lines[0].length + 1 + lines[1].length + 1 + 2,
            },
        });

        setTablePickerOpen(false);
        slashPosRef.current = null;
        view.focus();
    }, []);

    const closeTablePicker = useCallback(() => {
        setTablePickerOpen(false);
        slashPosRef.current = null;
        editorRef.current?.view?.focus();
    }, []);

    const paletteCommands = app.ui.getPaletteCommands();
    const newNoteCommand = useMemo(
        () => paletteCommands.find((cmd) => cmd.id === "new-note"),
        [paletteCommands]
    );
    const openVaultCommand = useMemo(
        () => paletteCommands.find((cmd) => cmd.id === "open-vault"),
        [paletteCommands]
    );

    if (!activeNote) {
        const primaryAction = vaultPath ? newNoteCommand : openVaultCommand;
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

    if (isLoading) {
        return <div className="p-10">Loading...</div>;
    }

    const editedAt = activeNote.last_modified
        ? formatRelativeTime(activeNote.last_modified)
        : "";

    return (
        <div className="h-full w-full flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto editor-scroll-shell">
                {/* TITLE AREA */}
                <div
                    className="w-full mx-auto px-12 pt-20 pb-16 flex-shrink-0"
                    style={{ borderColor: theme.colors.border.light }}
                >
                    <div style={{ maxWidth: "720px", margin: "0 auto" }}>
                        <input
                            className="text-[28px] font-bold bg-transparent outline-none border-none w-full"
                            style={{
                                color: theme.colors.text.primary,
                                fontFamily: theme.typography.fontFamily.mono,
                                textAlign: "left",
                                paddingTop: 8
                            }}
                            value={noteRenaming.titleInput}
                            onChange={(e) => noteRenaming.setTitleInput(e.target.value)}
                            onBlur={noteRenaming.handleRename}
                            placeholder="Untitled"
                        />
                        <div
                            className="flex items-center gap-3 text-[11px] mt-5"
                            style={{ color: theme.colors.text.muted, paddingBottom: 20 }}
                        >
                            <span className="flex items-center gap-1">
                                <Calendar size={12} />
                                {new Date(normalizeTimestampSeconds(activeNote.last_modified) * 1000).toLocaleDateString()}
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
                <div
                    className="w-full border-b"
                    style={{
                        maxWidth: "860px",
                        margin: "0 auto",
                        borderColor: theme.colors.border.light,
                    }}
                />
                {/* EDITOR AREA */}
                <div className="w-full relative min-h-0 cursor-text">
                    <div className="relative w-full">
                        <CodeMirror
                            ref={editorRef}
                            key={activeNote.path}
                            value={content}
                            extensions={[
                                ...pluginExtensions,
                                slashExtension,
                                wikiLinkSuggestionsExtension,
                                lightTheme
                            ]}
                            onChange={handleContentChange}
                            height="auto"
                            className={cn(
                                "w-full",
                                (slashProps.isOpen || wikiLinkSuggestionsProps.isOpen || calloutPickerOpen || tablePickerOpen) && "[&_.cm-scroller]:!overflow-hidden"
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
                            onClose={() => { slashProps.closeMenu(); }}
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
                            onClose={() => { wikiLinkSuggestionsProps.closeMenu(); }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
