import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { useEditorStore } from '../../stores/editorStore';
import { useRef, useState, useCallback } from "react";
import { useSlashCommand, useWikiLinkSuggestions, useWikiLinkNavigation } from "./hooks";
import { CommandItem } from "../../types";
import { SlashMenu } from "./SlashMenu";
import { WikiLinkSuggestionsMenu } from "./WikiLinkSuggestionsMenu";
import { CalloutPicker } from "./CalloutPicker";
import { dividerPlugin } from "./extensions/divider-plugin";
import { mathClickHandler, mathPlugin } from "./extensions/math-plugin";
import { useEditorActions, useFileSynchronization } from "./hooks/useEditorActions";
import { cn } from '../../lib/utils';
import { lightTheme } from "./themes/lightTheme";
import { useEditorExtensions } from "./hooks/useEditorExtensions";
import { CalloutType } from "../../constants/callout-types";

export function Editor() {
    const { activeNote, vaultPath } = useEditorStore();
    const { content, isLoading, handleContentChange } = useFileSynchronization(activeNote);
    const editorRef = useRef<ReactCodeMirrorRef>(null);
    const { noteRenaming, editorExtensions } = useEditorActions();
    const { slashExtension, slashProps } = useSlashCommand();

    // Callout picker state
    const [calloutPickerOpen, setCalloutPickerOpen] = useState(false);
    const [calloutPickerPos, setCalloutPickerPos] = useState({ x: 0, y: 0, placement: 'bottom' as 'top' | 'bottom' });
    const [calloutPickerIndex, setCalloutPickerIndex] = useState(0);
    // Store the slash position so we can insert text at the right place
    const slashPosRef = useRef<number | null>(null);

    // WikiLink suggestions hook
    const { wikiLinkSuggestionsExtension, wikiLinkSuggestionsProps } = useWikiLinkSuggestions(vaultPath || "");

    // Navigation hook
    const handleWikiLinkNavigation = useWikiLinkNavigation();

    // Wikilink extensions - passes the path/text to the navigation hook
    const wikiLinkExtensions = useEditorExtensions(handleWikiLinkNavigation, vaultPath || "", activeNote?.path);

    // Handle slash command selection — intercept "callout" to open picker
    const handleSlashSelect = useCallback((item: CommandItem) => {
        if (item.value === 'callout') {
            // Save the current slash position for later insertion
            const view = editorRef.current?.view;
            if (view) {
                const cursorPos = view.state.selection.main.from;
                const line = view.state.doc.lineAt(cursorPos);
                const lineOffset = cursorPos - line.from;
                const slashPos = line.text.lastIndexOf('/', lineOffset);
                if (slashPos !== -1) {
                    slashPosRef.current = line.from + slashPos;
                }
            }

            // Close slash menu and open callout picker at same position
            setCalloutPickerPos({
                x: slashProps.position.x,
                y: slashProps.position.y,
                placement: slashProps.position.placement
            });
            setCalloutPickerIndex(0);
            slashProps.closeMenu();
            setCalloutPickerOpen(true);
        } else {
            // Normal command execution
            if (editorRef.current?.view) {
                slashProps.performCommand(editorRef.current.view, item);
            }
        }
    }, [slashProps]);

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
                        ...wikiLinkExtensions,
                        ...editorExtensions,
                        slashExtension,
                        wikiLinkSuggestionsExtension,
                        dividerPlugin,
                        mathPlugin,
                        mathClickHandler,
                        lightTheme
                    ]}
                    onChange={handleContentChange}
                    height="100%"
                    className={cn(
                        "h-full w-full",
                        (slashProps.isOpen || wikiLinkSuggestionsProps.isOpen || calloutPickerOpen) && "[&_.cm-scroller]:!overflow-hidden"
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
