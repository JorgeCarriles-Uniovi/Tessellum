import { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { useEditorStore } from '../stores/editorStore';
import { lightTheme } from '../themes/lightTheme';
import { wikiLinkPlugin } from "../extensions/wikiLinkPlugin";
import { FileMetadata } from "../types";

// --- HOOK 1: Handles File I/O (Read, Write, Debounce) ---
export function useFileSynchronization(activeNote: FileMetadata | null) {
    const [content, setContent] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);
    const saveTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

    // Load File
    useEffect(() => {
        if (!activeNote) return;

        // Stop any pending saves from previous file
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

        const load = async () => {
            try {
                setIsLoading(true);
                const text = await invoke<string>('read_file', { path: activeNote.path });
                setContent(text);
            } catch (error) {
                console.error("Failed to read file:", error);
                setContent(`Error loading file: ${activeNote.path}`);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, [activeNote?.path]);

    // Save File (Debounced)
    const handleContentChange = useCallback((val: string) => {
        setContent(val);

        if (activeNote) {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

            saveTimeoutRef.current = window.setTimeout(() => {
                invoke('write_file', { path: activeNote.path, content: val })
                    .catch(console.error);
            }, 1000);
        }
    }, [activeNote]);

    // Cleanup on unmount
    useEffect(() => () => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    }, []);

    return { content, isLoading, handleContentChange };
}

// --- HOOK 2: Handles WikiLink Navigation & Creation ---
export function useWikiLinkNavigation() {
    const { activeNote, files, setActiveNote, setFiles } = useEditorStore();

    const onWikiLinkClick = useCallback(async (linkText: string) => {
        if (!activeNote) return;

        const targetName = linkText.trim();
        const targetFilename = `${targetName}.md`;

        // 1. Check if exists
        const existingFile = files.find(f =>
            f.filename.toLowerCase() === targetFilename.toLowerCase()
        );

        if (existingFile) {
            setActiveNote(existingFile);
            return;
        }

        // 2. If not, create new
        const separator = activeNote.path.includes("\\") ? "\\" : "/";
        const vaultPath = activeNote.path.substring(0, activeNote.path.lastIndexOf(separator));

        try {
            const newPath = await invoke<string>('create_note', {
                vaultPath,
                title: targetName
            });

            const newNote: FileMetadata = {
                path: newPath,
                filename: targetFilename,
                is_dir: false,
                size: 0,
                last_modified: Date.now()
            };

            setFiles([...files, newNote]);
            setActiveNote(newNote);
        } catch (e) {
            console.error("Failed to create wiki link note:", e);
        }
    }, [activeNote, files, setActiveNote, setFiles]);

    return onWikiLinkClick;
}

// --- HOOK 3: Bundles Editor Extensions ---
export function useEditorExtensions(onWikiLinkClick: (text: string) => void) {
    const clickHandler = useMemo(() => EditorView.domEventHandlers({
        mousedown: (event) => {
            const target = event.target as HTMLElement;
            if (target.matches(".cm-wikilink") || target.closest(".cm-wikilink")) {
                const linkElement = target.matches(".cm-wikilink")
                    ? target
                    : target.closest(".cm-wikilink");
                const destination = linkElement?.getAttribute("data-destination");

                if (destination) {
                    event.preventDefault();
                    onWikiLinkClick(destination);
                }
            }
        }
    }), [onWikiLinkClick]);

    // Return the full extension array
    return useMemo(() => [
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        EditorView.lineWrapping,
        lightTheme,
        wikiLinkPlugin,
        clickHandler
    ], [clickHandler]);
}