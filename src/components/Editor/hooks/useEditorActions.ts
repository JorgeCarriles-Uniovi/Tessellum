import {useCallback, useEffect, useState, useRef} from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FileMetadata } from "../../../types.ts";
import { useCreateFolder,
         useEditorExtensions,
         useNoteRenaming,
         useWikiLinkNavigation,
} from './index.ts';
import {useEditorStore} from "../../../stores/editorStore.ts";

// --- HOOK 1: Handles File I/O (Read, Write, Debounce) ---
export function useFileSynchronization(activeNote: FileMetadata | null) {
    const [content, setContent] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);
    const saveTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
    const {vaultPath} = useEditorStore();
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
                invoke('write_file', { path: activeNote.path,vaultPath: vaultPath, content: val })
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

export function useEditorActions() {
    const {vaultPath} = useEditorStore();
    const createFolder = useCreateFolder();
    const noteRenaming = useNoteRenaming();
    const wikiLinkNavigation = useWikiLinkNavigation();
    const editorExtensions = useEditorExtensions(wikiLinkNavigation, vaultPath);
    return { createFolder: createFolder, noteRenaming: noteRenaming, editorExtensions, wikiLinkNavigation };
}