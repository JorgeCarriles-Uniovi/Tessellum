import { useCallback, useEffect, useState, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { EditorView } from '@codemirror/view';
import { useEditorStore } from '../stores/editorStore';
import { invoke } from '@tauri-apps/api/core';
import { lightTheme } from '../themes/lightTheme';

export function Editor() {
    const { activeNote } = useEditorStore();

    // 1. Local state to hold the actual text content
    const [content, setContent] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);

    const saveTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

    useEffect(() => {
        if (!activeNote) return;

        // Clear any pending save timeout when switching to a different file
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        const loadFile = async () => {
            try {
                setIsLoading(true);
                // Ensure this command name matches your Rust command exactly
                const text = await invoke<string>('read_file', { path: activeNote.path });
                setContent(text);
            } catch (error) {
                console.error("Failed to read file:", error);
                setContent(`Error loading file: ${activeNote.path}\n\nDetails: ${String(error)}`);
            } finally {
                setIsLoading(false);
            }
        };

        loadFile();
    }, [activeNote?.path]); // Re-run only when the file path changes

    // 3. SAVE LOGIC: Write back to disk on change
    const onChange = useCallback((val: string) => {
        setContent(val); // Update local view immediately

        if (activeNote) {

            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }

            saveTimeoutRef.current = window.setTimeout(() => {
                invoke('write_file', { path: activeNote.path, content: val })
                    .catch(console.error);
            }, 1000);

        }
    }, [activeNote?.path]);

    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, []);

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
                key={activeNote.path} // IMPORTANT: Forces a fresh editor instance when switching files
                value={content}       // We use our local 'content' state here
                height="100%"
                extensions={[
                    markdown({ base: markdownLanguage, codeLanguages: languages }),
                    EditorView.lineWrapping,
                    lightTheme
                ]}
                onChange={onChange}
            />
        </div>
    );
}