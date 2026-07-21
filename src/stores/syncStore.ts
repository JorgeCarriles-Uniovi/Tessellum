import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SyncStateKind =
    | "no_remote"
    | "synced"
    | "ahead"
    | "behind"
    | "diverged"
    | "conflict"
    | "syncing"
    | "error";

export interface GitSyncConfig {
    remoteUrl?: string;
    remoteName?: string;
    branch?: string;
    authorName?: string;
    authorEmail?: string;
    username?: string;
    password?: string;
}

interface SyncState {
    config: GitSyncConfig;
    state: SyncStateKind;
    ahead: number;
    behind: number;
    uncommittedChanges: number;
    conflicts: string[];
    lastSyncMs: number | null;
    errorMessage: string | null;

    setConfig: (config: Partial<GitSyncConfig>) => void;
    setState: (state: SyncStateKind) => void;
    setStatus: (status: {
        state: SyncStateKind;
        ahead: number;
        behind: number;
        uncommitted_changes: number;
        conflicts: string[];
        message?: string | null;
    }) => void;
    setError: (msg: string) => void;
    clearError: () => void;
}

export const useSyncStore = create<SyncState>()(
    persist(
        (set) => ({
            config: {},
            state: "no_remote",
            ahead: 0,
            behind: 0,
            uncommittedChanges: 0,
            conflicts: [],
            lastSyncMs: null,
            errorMessage: null,

            setConfig: (config) =>
                set((s) => ({ config: { ...s.config, ...config } })),

            setState: (state) => set({ state }),

            setStatus: (status) =>
                set({
                    state: status.state,
                    ahead: status.ahead,
                    behind: status.behind,
                    uncommittedChanges: status.uncommitted_changes,
                    conflicts: status.conflicts,
                    errorMessage: status.message ?? null,
                }),

            setError: (msg) => set({ state: "error", errorMessage: msg }),

            clearError: () => set({ errorMessage: null }),
        }),
        {
            name: "tessellum:sync",
            partialize: (s) => ({ config: s.config }),
        }
    )
);
