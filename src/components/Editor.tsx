import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';
import { useEffect, useState, useRef } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { invoke } from '@tauri-apps/api/core';
import { WikiLinkExtension } from '../extensions';
import { createRoot, Root } from 'react-dom/client';
import { Content } from '@tiptap/core';

// Placeholder Selector component - replace with actual implementation
function Selector({ text, onSelection }: { text: string; onSelection: (data: { id: string; text: string }) => void }) {
    return (
        <div className="bg-white border rounded shadow-lg p-2">
            <div
                className="cursor-pointer hover:bg-gray-100 p-1"
                onClick={() => onSelection({ id: text.replace(/\[|\]/g, ''), text: text.replace(/\[|\]/g, '') })}
            >
                {text.replace(/\[|\]/g, '')}
            </div>
        </div>
    );
}

// Debounce helper
function useDebounce(value: string, delay: number) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

export function Editor() {
    const { activeNote, activeNoteContent, setActiveNoteContent, isDirty } = useEditorStore();

    const elRoot = useRef<Root | null>(null);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({ placeholder: 'Start writing...' }),
            Link.configure({ openOnClick: false }),
            WikiLinkExtension.configure({
                renderSuggestionFunction: (element, text, editor, range) => {
                    if (!elRoot.current) {
                        elRoot.current = createRoot(element);
                    }
                    elRoot.current.render(
                        <>
                            <Selector
                                text={text}
                                onSelection={({ id, text }: { id: string; text: string }) => {
                                    let content: Content = [
                                        {
                                            type: "wikiLink",
                                            attrs: { name: text, id: id },
                                        },
                                    ];
                                    console.log({ editor });
                                    return editor.chain().focus().insertContentAt(range, content).insertContent(" ").run();
                                }}
                            />
                        </>
                    );
                },
                onWikiLinkClick: (id, name, event) => {
                    console.log({ id, name, event });
                },
            }),
            Markdown.configure({
                html: false,
                transformPastedText: true,
                transformCopiedText: true,
            }),
        ],
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose lg:prose-lg max-w-none focus:outline-none min-h-[500px]',
            },
        },
        content: '',
        onUpdate: ({ editor }) => {
            // We save Markdown
            const md = (editor.storage as any).markdown.getMarkdown();
            setActiveNoteContent(md);
        },
    });

    // Load active note content
    useEffect(() => {
        if (!activeNote || !editor) return;

        const loadContent = async () => {
            try {
                const content = await invoke<string>('get_file_content', { path: activeNote.path });
                // Compare with current? If we setContent it resets cursor.
                // Only set if completely different (new note).
                // But we can't easily diff.
                // Strategy: When activeNote ID/Path changes, we load.
                // We assume activeNote object identity changes when selected.
                editor.commands.setContent(content);
                // Reset dirty?
                setActiveNoteContent(content); // Sync store immediately
            } catch (e) {
                console.error("Failed to load note", e);
            }
        };

        loadContent();
    }, [activeNote?.path, editor]); // Only re-run if path changes

    // Debounce save
    const debouncedNoteContent = useDebounce(activeNoteContent, 1000);

    useEffect(() => {
        if (!activeNote || !activeNote.path) return;
        // Only save if dirty? Since we update store on every keypress, content updates.
        // But we don't track "original content" to verify dirty.
        // We just save if content exists and user stopped typing.
        // But this runs on mount too?
        // Issue: On mount, we load X. setContent triggers onUpdate?
        // Tiptap: setContent triggers onUpdate.
        // So loading triggers a "save" 1s later.
        // This is inefficient but safe (idempotent).
        // Ideally we check if content != saved content.

        if (debouncedNoteContent) {
            invoke('save_file_content', { path: activeNote.path, content: debouncedNoteContent })
                .catch(e => console.error("Save failed", e));
        }
    }, [debouncedNoteContent, activeNote]);

    if (!activeNote) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50 h-full">
                <h2 className="text-xl font-medium mb-2">No Note Selected</h2>
                <p>Select a note from the sidebar or create a new one.</p>
            </div>
        );
    }

    return (
        <div className="flex-1 h-full overflow-y-auto bg-white relative">
            <EditorContent editor={editor} className="p-8 pb-32" />
            {/* Status Indicator */}
            <div className="absolute bottom-4 right-8 text-xs text-gray-400">
                {isDirty ? 'Unsaved' : 'Saved'}
            </div>
        </div>
    );
}
