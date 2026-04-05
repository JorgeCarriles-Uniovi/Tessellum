import { useEffect, useRef } from "react";
import { useGraphStore, useVaultStore } from "../stores";
import { type HistoryEntry, useNavigationHistoryStore } from "../stores/navigationHistoryStore";

interface UseWorkspaceNavigationHistoryParams {
    workspaceRestored: boolean;
}

function toHistoryEntry(viewMode: "editor" | "graph", activePath: string | null): HistoryEntry | null {
    if (viewMode === "graph") {
        return { viewMode: "graph", notePath: activePath };
    }

    if (!activePath) {
        return null;
    }

    return { viewMode: "editor", notePath: activePath };
}

function isSameEntry(a: HistoryEntry | null, b: HistoryEntry | null): boolean {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return a.viewMode === b.viewMode && a.notePath === b.notePath;
}

export function useWorkspaceNavigationHistory({ workspaceRestored }: UseWorkspaceNavigationHistoryParams): void {
    const vaultPath = useVaultStore((state) => state.vaultPath);
    const activePath = useVaultStore((state) => state.activeNote?.path ?? null);
    const viewMode = useGraphStore((state) => state.viewMode);
    const record = useNavigationHistoryStore((state) => state.record);
    const reset = useNavigationHistoryStore((state) => state.reset);
    const isReplaying = useNavigationHistoryStore((state) => state.isReplaying);

    const lastVaultRef = useRef<string | null>(null);
    const seededVaultRef = useRef<string | null>(null);
    const previousEntryRef = useRef<HistoryEntry | null>(null);

    useEffect(() => {
        if (vaultPath !== lastVaultRef.current) {
            reset();
            previousEntryRef.current = null;
            seededVaultRef.current = null;
            lastVaultRef.current = vaultPath;
        }
    }, [vaultPath, reset]);

    useEffect(() => {
        if (!workspaceRestored || !vaultPath || seededVaultRef.current === vaultPath) {
            return;
        }

        const initialEntry = toHistoryEntry(viewMode, activePath);
        if (initialEntry) {
            record(initialEntry);
            previousEntryRef.current = initialEntry;
        } else {
            previousEntryRef.current = null;
        }
        seededVaultRef.current = vaultPath;
    }, [activePath, record, vaultPath, viewMode, workspaceRestored]);

    useEffect(() => {
        if (!workspaceRestored || !vaultPath || seededVaultRef.current !== vaultPath) {
            return;
        }

        const currentEntry = toHistoryEntry(viewMode, activePath);

        // Replayed transitions should update the baseline but must not append entries.
        if (isReplaying) {
            previousEntryRef.current = currentEntry;
            return;
        }

        if (currentEntry && !isSameEntry(previousEntryRef.current, currentEntry)) {
            record(currentEntry);
        }

        previousEntryRef.current = currentEntry;
    }, [activePath, isReplaying, record, vaultPath, viewMode, workspaceRestored]);
}
