import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { useEditorStore } from '../stores/editorStore';
import {
    useFileSynchronization,
    useEditorActions
} from '../hooks';
import { lightTheme } from "../themes/lightTheme.ts";
import { EditorView } from '@codemirror/view';
import { useRef } from "react";
import { useSlashCommand } from "../hooks/editorActions";
import { CommandItem } from "../types.ts";
import { SlashMenu } from "./SlashMenu.tsx";

export function Editor() {
    const { activeNote } = useEditorStore();

    // 1. Logic Hooks
    const { content, isLoading, handleContentChange } = useFileSynchronization(activeNote);

    const editorRef = useRef<ReactCodeMirrorRef>(null);

    const { noteRenaming, editorExtensions, editorClick } = useEditorActions(editorRef);

    const { slashExtension, slashProps } = useSlashCommand();

    if (!activeNote) {
        return <div className="h-full flex items-center justify-center text-gray-400 select-none">Select a note</div>;
    }

    if (isLoading) {
        return <div className="p-10 text-gray-400">Loading...</div>;
    }

    return (
        // MAIN CONTAINER
        // Contains the title and editor area
        <div className="h-full w-full bg-white flex flex-col">

            {/* TITLE AREA (Fixed at top) */}
            <div className="w-full max-w-[800px] mx-auto px-8 pt-12 pb-4 flex-shrink-0">
                <input
                    className="text-4xl font-bold text-gray-900 bg-transparent outline-none border-none placeholder-gray-300 w-full"
                    value={noteRenaming.titleInput}
                    onChange={(e) => noteRenaming.setTitleInput(e.target.value)}
                    onBlur={noteRenaming.handleRename}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                    }}
                    placeholder="Untitled"
                />
            </div>

            {/* EDITOR AREA (Fills remaining space) */}
            <div className="flex-1 w-full relative min-h-0 cursor-text"
                 onMouseDown={editorClick}>
                <CodeMirror
                    ref={editorRef}
                    key={activeNote.path}
                    value={content}
                    extensions={[...editorExtensions, slashExtension, EditorView.lineWrapping]}
                    onChange={handleContentChange}

                    height="100%"
                    className="h-full w-full"

                    basicSetup={{
                        lineNumbers: false,
                        foldGutter: false,
                        highlightActiveLine: false,
                        highlightActiveLineGutter: false,
                    }}
                    theme={lightTheme}
                />
                <SlashMenu
                    isOpen={slashProps.isOpen}
                    x={slashProps.position.x}
                    y={slashProps.position.y}
                    selectedIndex={slashProps.selectedIndex}
                    query={slashProps.query}
                    commands={slashProps.filteredCommands}
                    onSelect={(item: CommandItem) => {
                        // We need the view instance here.
                        // Access it via editorRef.current.view
                        if (editorRef.current?.view) {
                            slashProps.performCommand(editorRef.current.view, item);
                        }
                    }}
                />
            </div>
        </div>
    );
}