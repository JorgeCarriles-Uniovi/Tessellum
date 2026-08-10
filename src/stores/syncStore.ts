import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getSecret, migratePlaintextSecret, setSecret, SECRET_KEYS } from "../lib/secretStorage";

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
            // `password` is a PAT-style credential. It stays in memory for the
            // session and lives at rest in the OS credential store — never in
            // localStorage, which is a plaintext file in the webview's data
            // directory. Call `hydrateSyncSecret()` once at startup to load it.
            partialize: (s) => {
                const { password: _password, ...safeConfig } = s.config;
                return { config: safeConfig };
            },
        }
    )
);

const SYNC_STORAGE_KEY = "tessellum:sync";

/**
 * Load the git remote password from the OS credential store into memory.
 *
 * Also performs the one-time migration for vaults upgraded from a build that
 * persisted the password in plaintext localStorage. Call once at app startup,
 * before any sync command runs.
 */
export async function hydrateSyncSecret(): Promise<void> {
    const migrated = await migratePlaintextSecret({
        storageKey: SYNC_STORAGE_KEY,
        secretKey: SECRET_KEYS.syncPassword,
        extract: (parsed) =>
            (parsed as { state?: { config?: { password?: string } } })?.state?.config?.password,
        strip: (parsed) => {
            const blob = parsed as { state?: { config?: Record<string, unknown> } };
            if (blob?.state?.config) delete blob.state.config.password;
            return blob;
        },
    });

    const password = migrated ?? (await getSecret(SECRET_KEYS.syncPassword));
    if (password) {
        useSyncStore.setState((s) => ({ config: { ...s.config, password } }));
    }
}

/**
 * Write the current in-memory password through to the OS credential store.
 * Resolves to `false` (rather than throwing) if the write fails, so the
 * caller can surface the failure to the user instead of losing it silently.
 */
export async function persistSyncSecret(): Promise<boolean> {
    return setSecret(SECRET_KEYS.syncPassword, useSyncStore.getState().config.password ?? "");
}
