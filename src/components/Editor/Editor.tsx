import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { useEditorStore } from '../../stores/editorStore';
import { useRef } from "react";
import { useSlashCommand, useWikiLinkSuggestions, useWikiLinkNavigation } from "./hooks";
import { CommandItem } from "../../types";
import { SlashMenu } from "./SlashMenu";
import { WikiLinkSuggestionsMenu } from "./WikiLinkSuggestionsMenu";
import { dividerPlugin } from "./extensions/divider-plugin";
import { mathClickHandler, mathPlugin } from "./extensions/math-plugin";
import { useEditorActions, useFileSynchronization } from "./hooks/useEditorActions";
import { cn } from '../../lib/utils';
import { lightTheme } from "./themes/lightTheme";
import { useEditorExtensions } from "./hooks/useEditorExtensions";

export function Editor() {
    const { activeNote, vaultPath } = useEditorStore();
    const { content, isLoading, handleContentChange } = useFileSynchronization(activeNote);
    const editorRef = useRef<ReactCodeMirrorRef>(null);
    const { noteRenaming, editorExtensions } = useEditorActions();
    const { slashExtension, slashProps } = useSlashCommand();

    // WikiLink suggestions hook
    const { wikiLinkSuggestionsExtension, wikiLinkSuggestionsProps } = useWikiLinkSuggestions(vaultPath || "");

    // Navigation hook
    const handleWikiLinkNavigation = useWikiLinkNavigation();

    // Wikilink extensions - passes the path/text to the navigation hook
    const wikiLinkExtensions = useEditorExtensions(handleWikiLinkNavigation, vaultPath || "");

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
                        (slashProps.isOpen || wikiLinkSuggestionsProps.isOpen) && "[&_.cm-scroller]:!overflow-hidden"
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
                    onSelect={(item: CommandItem) => {
                        if (editorRef.current?.view) {
                            slashProps.performCommand(editorRef.current.view, item);
                        }
                    }}
                    onClose={() => { slashProps.closeMenu(); }}
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
