import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

const MAX_RECENT_SEARCHES = 7;
const BASE_RECENT_SEARCHES_KEY = "tessellum:search:recent";

type SearchReadinessPayload = {
    status: "idle" | "warming" | "ready" | "failed";
    attempt_count: number;
    max_attempts: number;
    retry_delay_ms: number;
    reopen_required: boolean;
    last_error?: string | null;
};

const readinessGetInFlight = new Map<string, Promise<SearchReadinessPayload>>();
const readinessEnsureInFlight = new Map<string, Promise<SearchReadinessPayload>>();

function singleFlight(
    registry: Map<string, Promise<SearchReadinessPayload>>,
    vaultPath: string,
    factory: () => Promise<SearchReadinessPayload>,
): Promise<SearchReadinessPayload> {
    const existing = registry.get(vaultPath);
    if (existing) {
        return existing;
    }
    const pending = factory().finally(() => {
        registry.delete(vaultPath);
    });
    registry.set(vaultPath, pending);
    return pending;
}

function resolveRecentKey(vaultPath?: string): string {
    if (!vaultPath) return BASE_RECENT_SEARCHES_KEY;
    return `${BASE_RECENT_SEARCHES_KEY}:${vaultPath}`;
}

function readStringArray(key: string): string[] {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
    } catch {
        return [];
    }
}

function writeStringArray(key: string, value: string[]): void {
    localStorage.setItem(key, JSON.stringify(value));
}

function normalizeQuery(query: string): string {
    return query.trim().toLowerCase();
}

function buildRecentSearches(query: string, existing: string[]): string[] {
    const normalized = normalizeQuery(query);
    if (!normalized) return existing;
    const filtered = existing.filter((item) => normalizeQuery(item) !== normalized);
    return [query, ...filtered].slice(0, MAX_RECENT_SEARCHES);
}

export interface SearchState {
    recentSearches: string[];
    readinessStatus: "idle" | "warming" | "ready" | "failed";
    readinessAttemptCount: number;
    readinessMaxAttempts: number;
    readinessRetryDelayMs: number;
    readinessReopenRequired: boolean;
    readinessLastError: string | null;
}

export interface SearchActions {
    setRecentSearches: (list: string[], vaultPath?: string) => void;
    addRecentSearch: (query: string, vaultPath?: string) => void;
    loadRecentSearches: (vaultPath?: string) => void;
    setReadinessState: (payload: SearchReadinessPayload) => void;
    resetReadinessState: () => void;
    syncReadiness: (vaultPath: string) => Promise<void>;
    ensureReadiness: (vaultPath: string) => Promise<void>;
    resetAndEnsureReadiness: (vaultPath: string) => Promise<void>;
}

export type SearchStore = SearchState & SearchActions;

export const useSearchStore = create<SearchStore>((set, get) => ({
    recentSearches: readStringArray(resolveRecentKey()),
    readinessStatus: "idle",
    readinessAttemptCount: 0,
    readinessMaxAttempts: 10,
    readinessRetryDelayMs: 5000,
    readinessReopenRequired: false,
    readinessLastError: null,

    setRecentSearches: (list, vaultPath) => set(() => {
        const next = list.slice(0, MAX_RECENT_SEARCHES);
        const key = resolveRecentKey(vaultPath);
        writeStringArray(key, next);
        return { recentSearches: next };
    }),

    addRecentSearch: (query, vaultPath) => set((state) => {
        const key = resolveRecentKey(vaultPath);
        const base = vaultPath ? readStringArray(key) : state.recentSearches;
        const next = buildRecentSearches(query, base);
        writeStringArray(key, next);
        return { recentSearches: next };
    }),
    loadRecentSearches: (vaultPath) => set(() => {
        const key = resolveRecentKey(vaultPath);
        return { recentSearches: readStringArray(key) };
    }),

    setReadinessState: (payload) => set(() => ({
        readinessStatus: payload.status,
        readinessAttemptCount: payload.attempt_count,
        readinessMaxAttempts: payload.max_attempts,
        readinessRetryDelayMs: payload.retry_delay_ms,
        readinessReopenRequired: payload.reopen_required,
        readinessLastError: payload.last_error ?? null,
    })),

    resetReadinessState: () => set(() => ({
        readinessStatus: "idle",
        readinessAttemptCount: 0,
        readinessMaxAttempts: 10,
        readinessRetryDelayMs: 5000,
        readinessReopenRequired: false,
        readinessLastError: null,
    })),

    syncReadiness: async (vaultPath) => {
        if (!vaultPath) {
            return;
        }
        const readiness = await singleFlight(readinessGetInFlight, vaultPath, () =>
            invoke<SearchReadinessPayload>("get_search_readiness", { vaultPath })
        );
        get().setReadinessState(readiness);
    },

    ensureReadiness: async (vaultPath) => {
        if (!vaultPath) {
            return;
        }
        const readiness = await singleFlight(readinessEnsureInFlight, vaultPath, () =>
            invoke<SearchReadinessPayload>("ensure_search_ready", { vaultPath })
        );
        get().setReadinessState(readiness);
    },

    resetAndEnsureReadiness: async (vaultPath) => {
        if (!vaultPath) {
            return;
        }
        const resetPayload = await invoke<SearchReadinessPayload>("reset_search_readiness_attempts", { vaultPath });
        get().setReadinessState(resetPayload);
        await get().ensureReadiness(vaultPath);
    },
}));
