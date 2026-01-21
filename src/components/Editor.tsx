import CodeMirror from '@uiw/react-codemirror';
import { useEditorStore } from '../stores/editorStore';
import { useFileSynchronization,
         useWikiLinkNavigation,
         useEditorExtensions,
         useNoteRenaming } from '../hooks';
import { lightTheme } from "../themes/lightTheme.ts";
import { EditorView } from '@codemirror/view';

export function Editor() {
    const { activeNote } = useEditorStore();

    // 1. Use the hooks
    const { content, isLoading, handleContentChange } = useFileSynchronization(activeNote);
    const onWikiLinkClick = useWikiLinkNavigation();
    const extensions = useEditorExtensions(onWikiLinkClick);

    const { titleInput, setTitleInput, handleRename } = useNoteRenaming();

    // 2. Render logic
    if (!activeNote) {
        return <div className="h-full flex items-center justify-center text-gray-400">
            Select a note
        </div>;
    }

    if (isLoading) {
        return <div className="p-10 text-gray-400">Loading...</div>;
    }

    return (
        // SCROLL CONTAINER: The parent div handles the scrolling for the whole document
        <div className="h-full w-full overflow-y-auto bg-white cursor-text"
             onClick={(e) => {
                 if (e.target === e.currentTarget) {
                     // logic to focus editor could go here
                 }
             }}
        >
            {/* CONTENT WRAPPER: Centers the text */}
            <div className="max-w-[800px] mx-auto px-8 py-12 flex flex-col">

                {/* THE FILE HEADING */}
                <input
                    className="text-4xl font-bold text-gray-900 mb-8 bg-transparent outline-none border-none placeholder-gray-300 w-full"
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    onBlur={handleRename} // Save on click away
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.currentTarget.blur(); // Trigger blur to save
                        }
                    }}
                    placeholder="Untitled"
                />

                {/* THE EDITOR */}
                <CodeMirror
                    key={activeNote.path} // Forces re-render on file switch
                    value={content}
                    extensions={[
                        ...extensions,
                        EditorView.lineWrapping
                    ]}
                    onChange={handleContentChange}
                    // "auto" makes the editor grow with text, so the window scrolls
                    height="auto"
                    basicSetup={{
                        lineNumbers: false,
                        foldGutter: false,
                        highlightActiveLine: false,
                        highlightActiveLineGutter: false,
                    }}
                    theme={lightTheme}
                    // Minimal styling to blend in
                    className="text-lg w-full"
                />
            </div>
        </div>
    );
}