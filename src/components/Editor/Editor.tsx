import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { useEditorStore } from '../../stores/editorStore';
import { useRef } from "react";
import { useSlashCommand } from "./hooks";
import { CommandItem } from "../../types";
import { SlashMenu } from "./SlashMenu";
import { dividerPlugin } from "./extensions/divider-plugin";
import { mathClickHandler, mathPlugin } from "./extensions/math-plugin";
import { useEditorActions, useFileSynchronization } from "./hooks/useEditorActions";

// 1. Import your CodeMirror extension (The file you just showed me)
import { lightTheme } from "./themes/lightTheme";

export function Editor() {
    const { activeNote } = useEditorStore();
    const { content, isLoading, handleContentChange } = useFileSynchronization(activeNote);
    const editorRef = useRef<ReactCodeMirrorRef>(null);
    const { noteRenaming, editorExtensions } = useEditorActions();
    const { slashExtension, slashProps } = useSlashCommand();

    if (!activeNote) {
        return (
            <div
                className="h-full flex items-center justify-center select-none"
            >
                Select a note
            </div>
        );
    }

    if (isLoading) {
        return <div className="p-10">Loading...</div>;
    }

    return (
        // 4. INJECT VARIABLES into the wrapper
        <div
            className="h-full w-full flex flex-col">

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
                        ...editorExtensions,
                        slashExtension,
                        dividerPlugin,
                        mathPlugin,
                        mathClickHandler,
                        lightTheme
                    ]}
                    onChange={handleContentChange}
                    height="100%"
                    className="h-full w-full"

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
                    selectedIndex={slashProps.selectedIndex}
                    commands={slashProps.filteredCommands}
                    onSelect={(item: CommandItem) => {
                        if (editorRef.current?.view) {
                            slashProps.performCommand(editorRef.current.view, item);
                        }
                    }}
                />
            </div>
        </div>
    );
}