import CodeMirror from '@uiw/react-codemirror';
import { useEditorStore } from '../stores/editorStore';
import { useFileSynchronization,
         useWikiLinkNavigation,
         useEditorExtensions } from '../hooks';

export function Editor() {
    const { activeNote } = useEditorStore();

    // 1. Use the hooks
    const { content, isLoading, handleContentChange } = useFileSynchronization(activeNote);
    const onWikiLinkClick = useWikiLinkNavigation();
    const extensions = useEditorExtensions(onWikiLinkClick);

    // 2. Render logic
    if (!activeNote) {
        return (
            <div className="h-full flex items-center justify-center text-gray-400">
                Select a note to edit
            </div>
        );
    }

    if (isLoading) {
        return <div className="p-10 text-gray-400">Loading...</div>;
    }

    return (
        <div className="h-full w-full overflow-auto bg-white">
            <CodeMirror
                key={activeNote.path}
                value={content}
                height="100%"
                extensions={extensions}
                onChange={handleContentChange}
            />
        </div>
    );
}