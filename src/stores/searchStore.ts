import { create } from "zustand";

const MAX_RECENT_SEARCHES = 7;
const BASE_RECENT_SEARCHES_KEY = "tessellum:search:recent";

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
}

export interface SearchActions {
    setRecentSearches: (list: string[], vaultPath?: string) => void;
    addRecentSearch: (query: string, vaultPath?: string) => void;
    loadRecentSearches: (vaultPath?: string) => void;
}

export type SearchStore = SearchState & SearchActions;

export const useSearchStore = create<SearchStore>((set) => ({
    recentSearches: readStringArray(resolveRecentKey()),

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
}));
