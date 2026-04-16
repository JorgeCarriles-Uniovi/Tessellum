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
    const lastPersistedContentByPathRef = useRef<Map<string, string>>(new Map());
    const lastScheduledContentByPathRef = useRef<Map<string, string>>(new Map());
    const latestContentByPathRef = useRef<Map<string, string>>(new Map());
    const saveTokenRef = useRef(0);
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
            saveTokenRef.current += 1;
            loadRequestIdRef.current += 1;
            setContent("");
            setActiveNoteContent("");
            setIsDirty(false);
            setIsLoading(false);
            return;
        }

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTokenRef.current += 1;
        const requestId = loadRequestIdRef.current + 1;
        loadRequestIdRef.current = requestId;
        let cancelled = false;

        // Clear stale content immediately so dependent UI, including the outline,
        // does not render the previous note while the new note is loading.
        setContent("");
        setActiveNoteContent("");
        setIsDirty(false);

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
                lastPersistedContentByPathRef.current.set(activeNote.path, text);
                latestContentByPathRef.current.set(activeNote.path, text);
                lastScheduledContentByPathRef.current.delete(activeNote.path);
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

        const note = activeNoteRef.current;
        const vault = vaultPathRef.current;
        if (note) {
            const path = note.path;
            latestContentByPathRef.current.set(path, val);

            const lastPersisted = lastPersistedContentByPathRef.current.get(path);
            if (lastPersisted === val) {
                if (saveTimeoutRef.current) {
                    clearTimeout(saveTimeoutRef.current);
                    saveTimeoutRef.current = null;
                }
                lastScheduledContentByPathRef.current.delete(path);
                setIsDirty(false);
                return;
            }

            const lastScheduled = lastScheduledContentByPathRef.current.get(path);
            if (lastScheduled === val && saveTimeoutRef.current) {
                setIsDirty(true);
                return;
            }

            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

            setIsDirty(true);
            lastScheduledContentByPathRef.current.set(path, val);
            const saveToken = ++saveTokenRef.current;

            saveTimeoutRef.current = window.setTimeout(() => {
                invoke('write_file', { path, vaultPath: vault, content: val })
                    .then(() => {
                        if (saveTokenRef.current !== saveToken) {
                            return;
                        }
                        lastPersistedContentByPathRef.current.set(path, val);
                        lastScheduledContentByPathRef.current.delete(path);
                        if (latestContentByPathRef.current.get(path) === val) {
                            setIsDirty(false);
                        }
                        if (activeNoteRef.current?.path === path) {
                            setActiveNote({ ...note, last_modified: Math.floor(Date.now() / 1000) });
                        }
                    })
                    .catch(console.error);
            }, 1000);
        }
    }, [setActiveNoteContent, setIsDirty, setActiveNote]);

    useEffect(() => () => {
        saveTokenRef.current += 1;
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    }, []);

    return { content, isLoading, handleContentChange };
}

export function useEditorActions() {
    const createFolder = useCreateFolder();
    const noteRenaming = useNoteRenaming();
    return { createFolder, noteRenaming };
}
