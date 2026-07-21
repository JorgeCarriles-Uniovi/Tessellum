import { useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useEditorContentStore, type AutoSaveStatus } from "../stores/editorContentStore";
import { useVaultStore } from "../stores/vaultStore";

export type { AutoSaveStatus };

const AUTO_SAVE_DELAY_MS = 10_000;

function buildRecoveryFilename(notePath: string, vaultPath: string): string {
    const normalizedVault = vaultPath.replace(/\/$/, "");
    const normalizedNote = notePath.replace(/^\//, "");
    const relative = normalizedNote.startsWith(normalizedVault + "/")
        ? normalizedNote.slice(normalizedVault.length + 1)
        : normalizedNote;
    return relative.replace(/\//g, "__") + ".recovery.md";
}

export function useAutoSave() {
    const isDirty = useEditorContentStore((s) => s.isDirty);
    const activeNoteContent = useEditorContentStore((s) => s.activeNoteContent);
    const setAutoSaveStatus = useEditorContentStore((s) => s.setAutoSaveStatus);

    const activeNote = useVaultStore((s) => s.activeNote);
    const vaultPath = useVaultStore((s) => s.vaultPath);

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const contentRef = useRef(activeNoteContent);
    const notePathRef = useRef(activeNote?.path ?? null);

    useEffect(() => {
        contentRef.current = activeNoteContent;
    }, [activeNoteContent]);

    useEffect(() => {
        notePathRef.current = activeNote?.path ?? null;
    }, [activeNote]);

    const doAutoSave = useCallback(async () => {
        const path = notePathRef.current;
        const content = contentRef.current;
        if (!path || !vaultPath) return;

        setAutoSaveStatus({ status: "saving", lastSavedAt: null, errorMessage: null });
        try {
            await invoke("write_recovery_file", { vaultPath, notePath: path, content });
            setAutoSaveStatus({ status: "saved", lastSavedAt: Date.now(), errorMessage: null });
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setAutoSaveStatus({ status: "error", lastSavedAt: null, errorMessage: msg });
        }
    }, [vaultPath, setAutoSaveStatus]);

    useEffect(() => {
        if (!isDirty || !activeNote || !vaultPath) {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            return;
        }

        setAutoSaveStatus({ status: "pending", lastSavedAt: null, errorMessage: null });

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            timerRef.current = null;
            doAutoSave();
        }, AUTO_SAVE_DELAY_MS);

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [isDirty, activeNote, vaultPath, doAutoSave, setAutoSaveStatus]);

    // When a real save completes (isDirty goes false), clear the recovery file
    const prevDirtyRef = useRef(isDirty);
    useEffect(() => {
        if (prevDirtyRef.current && !isDirty && activeNote && vaultPath) {
            const recoveryFilename = buildRecoveryFilename(activeNote.path, vaultPath);
            invoke("clear_recovery_file", { vaultPath, recoveryFilename }).catch(() => {/* non-critical */});
            setAutoSaveStatus({ status: "idle", lastSavedAt: null, errorMessage: null });
        }
        prevDirtyRef.current = isDirty;
    }, [isDirty, activeNote, vaultPath, setAutoSaveStatus]);
}
