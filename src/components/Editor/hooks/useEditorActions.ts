import { useCallback, useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FileMetadata } from "../../../types.ts";
import {
    useCreateFolder,
    useNoteRenaming,
} from './index.ts';
import { useEditorStore } from "../../../stores/editorStore.ts";
import { isMediaFile } from "../../../utils/fileType";

export function useFileSynchronization(activeNote: FileMetadata | null) {
    const [content, setContent] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);
    const saveTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
    const loadRequestIdRef = useRef(0);
    const { vaultPath, setActiveNoteContent, setIsDirty, setActiveNote } = useEditorStore();
    const activeNoteRef = useRef(activeNote);
    const vaultPathRef = useRef(vaultPath);

    useEffect(() => {
        activeNoteRef.current = activeNote;
        vaultPathRef.current = vaultPath;
    }, [activeNote, vaultPath]);

    useEffect(() => {
        if (!activeNote) {
            loadRequestIdRef.current += 1;
            setContent("");
            setActiveNoteContent("");
            setIsDirty(false);
            setIsLoading(false);
            return;
        }

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        const requestId = loadRequestIdRef.current + 1;
        loadRequestIdRef.current = requestId;
        let cancelled = false;

        const load = async () => {
            try {
                setIsLoading(true);

                if (isMediaFile(activeNote.path)) {
                    if (cancelled || loadRequestIdRef.current !== requestId) {
                        return;
                    }
                    setContent("");
                    setActiveNoteContent("");
                    setIsDirty(false);
                    return;
                }

                const text = await invoke<string>('read_file', { vaultPath, path: activeNote.path });
                if (cancelled || loadRequestIdRef.current !== requestId) {
                    return;
                }
                setContent(text);
                setActiveNoteContent(text);
                setIsDirty(false);
            } catch (error) {
                if (cancelled || loadRequestIdRef.current !== requestId) {
                    return;
                }
                console.error("Failed to read file:", error);
                const errorText = `Error loading file: ${activeNote.path}`;
                setContent(errorText);
                setActiveNoteContent(errorText);
                setIsDirty(false);
            } finally {
                if (!cancelled && loadRequestIdRef.current === requestId) {
                    setIsLoading(false);
                }
            }
        };
        load();

        return () => {
            cancelled = true;
        };
    }, [activeNote?.path, setActiveNoteContent, setIsDirty, vaultPath]);

    const handleContentChange = useCallback((val: string) => {
        setContent(val);
        setActiveNoteContent(val);
        setIsDirty(true);

        const note = activeNoteRef.current;
        const vault = vaultPathRef.current;
        if (note) {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

            saveTimeoutRef.current = window.setTimeout(() => {
                invoke('write_file', { path: note.path, vaultPath: vault, content: val })
                    .then(() => {
                        setIsDirty(false);
                        setActiveNote({ ...note, last_modified: Math.floor(Date.now() / 1000) });
                    })
                    .catch(console.error);
            }, 1000);
        }
    }, [setActiveNoteContent, setIsDirty, setActiveNote]);

    useEffect(() => () => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    }, []);

    return { content, isLoading, handleContentChange };
}

export function useEditorActions() {
    const createFolder = useCreateFolder();
    const noteRenaming = useNoteRenaming();
    return { createFolder, noteRenaming };
}
