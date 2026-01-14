import { useCallback, useEffect, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { EditorView } from '@codemirror/view';
import { useEditorStore } from '../stores/editorStore';
import { invoke } from '@tauri-apps/api/core';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';

export function Editor() {
    const { activeNote } = useEditorStore();

    // 1. Local state to hold the actual text content
    const [content, setContent] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);

    // 2. FETCH LOGIC: When activeNote changes, read from disk
    useEffect(() => {
        if (!activeNote) return;

        const loadFile = async () => {
            try {
                setIsLoading(true);
                // Ensure this command name matches your Rust command exactly
                const text = await invoke<string>('read_file', { path: activeNote.path });
                setContent(text);
            } catch (error) {
                console.error("Failed to read file:", error);
                setContent("Error loading file.");
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
            // You might want to debounce this later, but for now it works
            invoke('write_file', { path: activeNote.path, content: val })
                .catch(console.error);
        }
    }, [activeNote]);

    // 4. THEME (Sprint 1: Styled Source Mode)
    const baseTheme = EditorView.theme({
        ".cm-content": {
            fontFamily: "'Inter', sans-serif",
            fontSize: "16px",
            lineHeight: "1.6",
            padding: "20px",
            maxWidth: "800px",
            margin: "0 auto",
        },
        ".cm-header-1": { fontSize: "2.2em", fontWeight: "bold", color: "#111827" },
        ".cm-header-2": { fontSize: "1.8em", fontWeight: "bold", color: "#1f2937" },
        ".cm-formatting": { color: "#9ca3af" }, // Makes the syntax (#, **) subtle gray
    });

    const myMarkdownTheme = HighlightStyle.define([
        {
            tag: tags.heading1,
            fontSize: "2.2em",
            fontWeight: "bold"
        },
        {
            tag: tags.heading2,
            fontSize: "1.8em",
            fontWeight: "bold"
        },
        {
            tag: tags.heading3,
            fontSize: "1.5em",
            fontWeight: "bold"
        },
        {
            tag: tags.strong,
            fontWeight: "bold"
        },
        {
            tag: tags.emphasis,
            fontStyle: "italic"
        },
        // This targets the syntax characters (#, *, >) specifically
        {
            tag: tags.processingInstruction, // or tags.meta depending on parser version
            color: "#9ca3af"
        }
    ]);

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
                    syntaxHighlighting(myMarkdownTheme),
                    EditorView.lineWrapping,
                    baseTheme
                ]}
                onChange={onChange}
            />
        </div>
    );
}