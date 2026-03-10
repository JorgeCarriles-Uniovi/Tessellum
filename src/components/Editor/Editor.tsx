import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { useEditorStore } from '../../stores/editorStore';
import { useRef, useState, useCallback, useEffect } from "react";
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
import { TessellumApp } from "../../plugins/TessellumApp";
import {EditorView} from "@codemirror/view";

export function Editor() {
    const { activeNote, vaultPath } = useEditorStore();
    const { content, isLoading, handleContentChange } = useFileSynchronization(activeNote);
    const editorRef = useRef<ReactCodeMirrorRef>(null);
    const { noteRenaming } = useEditorActions();

    // Workaround for callback dependency cycle
    const handleSlashSelectRef = useRef<(cmd: Command, view?: EditorView) => void>();
    const { slashExtension, slashProps } = useSlashCommand((cmd, view) => {
        handleSlashSelectRef.current?.(cmd, view);
    });

    // Plugin-provided extensions (via Compartments from EditorAPI)
    const pluginExtensions = useEditorExtensions();

    // Callout picker state
    const [calloutPickerOpen, setCalloutPickerOpen] = useState(false);
    const [calloutPickerPos, setCalloutPickerPos] = useState({ x: 0, y: 0, placement: 'bottom' as 'top' | 'bottom' });
    const [calloutPickerIndex, setCalloutPickerIndex] = useState(0);

    // Table picker state
    const [tablePickerOpen, setTablePickerOpen] = useState(false);
    const [tablePickerPos, setTablePickerPos] = useState({ x: 0, y: 0, placement: 'bottom' as 'top' | 'bottom' });

    // Store the slash position so we can insert text at the right place
    const slashPosRef = useRef<number | null>(null);

    // WikiLink suggestions hook
    const { wikiLinkSuggestionsExtension, wikiLinkSuggestionsProps } = useWikiLinkSuggestions(vaultPath || "");

    // Set the EditorView on the EditorAPI when it mounts/unmounts
    useEffect(() => {
        const view = editorRef.current?.view;
        if (view) {
            TessellumApp.instance.editor.setView(view);
        }
        return () => {
            TessellumApp.instance.editor.setView(null);
        };
    }, [editorRef.current?.view]);

    // Handle slash command selection — intercept "callout" and "table" to open pickers
    const handleSlashSelect = useCallback((item: Command, explicitView?: EditorView) => {
        const activeView = explicitView || editorRef.current?.view;

        // Helper: save current slash position for deferred insertion
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

            // Close slash menu and open callout picker at same position
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

            // Close slash menu and open table size picker at same position
            setTablePickerPos({
                x: slashProps.position.x,
                y: slashProps.position.y,
                placement: slashProps.position.placement
            });
            slashProps.closeMenu();
            setTablePickerOpen(true);
        } else {
            // Normal command execution
            if (activeView) {
                slashProps.performCommand(activeView, item);
            }
        }
    }, [slashProps]);

    useEffect(() => {
        handleSlashSelectRef.current = handleSlashSelect;
    }, [handleSlashSelect]);

    // Handle callout type selection
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

    // Handle table size selection
    const handleTableSelect = useCallback((rows: number, cols: number) => {
        const view = editorRef.current?.view;
        if (!view) return;

        const insertFrom = slashPosRef.current ?? view.state.selection.main.from;
        const cursorPos = view.state.selection.main.from;

        // Generate GFM table markdown
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
                // Place cursor in the first data cell (first row after separator)
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

    if (!activeNote) {
        return (
            <div className="h-full flex items-center justify-center select-none">
                Select a note
            </div>
        );
    }

    if (isLoading) {
        return <div className="p-10">Loading...</div>;
    }

    return (
        <div className="h-full w-full flex flex-col">
            {/* TITLE AREA */}
            <div className="w-full mx-auto px-8 pt-24 pb-8 flex-shrink-0">
                <input
                    className="text-s text-center text-text-primary bg-transparent outline-none border-none w-full placeholder-gray-300"
                    value={noteRenaming.titleInput}
                    onChange={(e) => noteRenaming.setTitleInput(e.target.value)}
                    onBlur={noteRenaming.handleRename}
                    placeholder="Untitled"
                />
            </div>

            {/* EDITOR AREA */}
            <div className="flex-1 w-full relative min-h-0 cursor-text">
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
                    height="100%"
                    className={cn(
                        "h-full w-full",
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
    );
}

