import { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {EditorView} from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { useEditorStore } from '../stores/editorStore';
import { lightTheme } from '../themes/lightTheme';
import { wikiLinkPlugin } from "../extensions/wikiLinkPlugin";
import { FileMetadata } from "../types";
import { dirname } from '@tauri-apps/api/path';
import { toast } from 'sonner';

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

        try {
            // 1. Sanitize Input
            const rawName = linkText.trim();
            if (!rawName) return;

            // This throws an error if malicious, or returns a clean string if messy
            const targetName = sanitizeFilename(rawName);

            // If the name became empty after sanitization (e.g. "[[???]]"), stop.
            if (!targetName) {
                return;
            }

            const targetFilename = `${targetName}.md`;

            // 2. Check if exists (Using the CLEAN name)
            const existingFile = files.find(f =>
                f.filename.toLowerCase() === targetFilename.toLowerCase()
            );

            if (existingFile) {
                setActiveNote(existingFile);
                return;
            }

            // 3. Create New Note

            const vaultPath = await dirname(activeNote.path);

            const newPath = await invoke<string>('create_note', {
                vaultPath,
                title: targetName // Pass the sanitized name
            });

            const newNote: FileMetadata = {
                path: newPath,
                filename: targetFilename,
                is_dir: false,
                size: 0,
                last_modified: Math.floor(Date.now() / 1000)
            };

            setFiles([...files, newNote]);
            setActiveNote(newNote);

        } catch (e: any) {
            toast.error(e.message || "Failed to open link");
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

function sanitizeFilename(name: string): string {
    // 1. Remove dangerous control characters
    let cleanName = name.replace(/[\x00-\x1F]/g, '');

    // 2. SECURITY CRITICAL: Block Traversal
    if (cleanName.includes('..')) {
        throw new Error("Invalid WikiLink: '..' sequence is not allowed");
    }

    // Block slashes (Folder separators)
    if (cleanName.includes('/') || cleanName.includes('\\')) {
        throw new Error("Invalid WikiLink: Path separators are not allowed");
    }

    cleanName = cleanName.replace(/[^a-zA-Z0-9 \-_\(\)\.]/g, '');

    // 4. Windows Safety: Trim trailing dots/spaces
    // "Note." is invalid on Windows. "Note" is valid.
    cleanName = cleanName.replace(/[. ]+$/, "");

    return cleanName;
}