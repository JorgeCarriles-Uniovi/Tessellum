import { create } from "zustand";
import { useGraphStore } from "./graphStore";
import { useVaultStore } from "./vaultStore";

export type EditorHistoryEntry = { viewMode: "editor"; notePath: string };
export type GraphHistoryEntry = { viewMode: "graph"; notePath: string | null };
export type HistoryEntry = EditorHistoryEntry | GraphHistoryEntry;

export interface NavigationHistoryState {
    entries: HistoryEntry[];
    cursor: number;
    isReplaying: boolean;
    canGoBack: boolean;
    canGoForward: boolean;
}

export interface NavigationHistoryActions {
    record: (entry: HistoryEntry) => void;
    goBack: () => void;
    goForward: () => void;
    completeReplay: () => void;
    reset: () => void;
}

export type NavigationHistoryStore = NavigationHistoryState & NavigationHistoryActions;

function isSameEntry(a: HistoryEntry | undefined, b: HistoryEntry): boolean {
    if (!a) return false;
    return a.viewMode === b.viewMode && a.notePath === b.notePath;
}

function computeCanGoBack(cursor: number): boolean {
    return cursor > 0;
}

function computeCanGoForward(entries: HistoryEntry[], cursor: number): boolean {
    return cursor >= 0 && cursor < entries.length - 1;
}

function withCursor(state: NavigationHistoryStore, nextCursor: number): Partial<NavigationHistoryStore> {
    return {
        cursor: nextCursor,
        canGoBack: computeCanGoBack(nextCursor),
        canGoForward: computeCanGoForward(state.entries, nextCursor),
    };
}

function findValidEntryIndex(entries: HistoryEntry[], start: number, step: -1 | 1): number {
    const files = useVaultStore.getState().files;

    for (let index = start; index >= 0 && index < entries.length; index += step) {
        const entry = entries[index];
        if (entry.viewMode === "graph") {
            return index;
        }

        const exists = files.some((file) => file.path === entry.notePath);
        if (exists) {
            return index;
        }
    }

    return -1;
}

function applyEntry(entry: HistoryEntry): void {
    const graphStore = useGraphStore.getState();
    const vaultStore = useVaultStore.getState();

    if (entry.viewMode === "graph") {
        graphStore.setViewMode("graph");
        return;
    }

    const target = vaultStore.files.find((file) => file.path === entry.notePath);
    if (!target) {
        return;
    }

    vaultStore.setActiveNote(target);
    graphStore.setViewMode("editor");
}

export const useNavigationHistoryStore = create<NavigationHistoryStore>((set, get) => ({
    entries: [],
    cursor: -1,
    isReplaying: false,
    canGoBack: false,
    canGoForward: false,

    record: (entry) => set((state) => {
        if (state.isReplaying) {
            return state;
        }

        const current = state.cursor >= 0 ? state.entries[state.cursor] : undefined;
        if (isSameEntry(current, entry)) {
            return state;
        }

        const nextEntries = state.entries.slice(0, state.cursor + 1);
        nextEntries.push(entry);
        const nextCursor = nextEntries.length - 1;

        return {
            entries: nextEntries,
            cursor: nextCursor,
            canGoBack: computeCanGoBack(nextCursor),
            canGoForward: false,
        };
    }),

    goBack: () => {
        const state = get();
        if (!state.canGoBack || state.entries.length === 0) {
            return;
        }

        const targetIndex = findValidEntryIndex(state.entries, state.cursor - 1, -1);
        if (targetIndex < 0) {
            return;
        }

        // Set isReplaying and update cursor atomically before calling applyEntry
        // so that any subscribers see a consistent state (no intermediate render
        // between the flag set and the cursor update).
        set((current) => ({ isReplaying: true, ...withCursor(current, targetIndex) }));
        applyEntry(state.entries[targetIndex]);
    },

    goForward: () => {
        const state = get();
        if (!state.canGoForward || state.entries.length === 0) {
            return;
        }

        const targetIndex = findValidEntryIndex(state.entries, state.cursor + 1, 1);
        if (targetIndex < 0) {
            return;
        }

        set((current) => ({ isReplaying: true, ...withCursor(current, targetIndex) }));
        applyEntry(state.entries[targetIndex]);
    },

    // Replay stays active until the observer syncs its baseline to the replayed state.
    completeReplay: () => set({ isReplaying: false }),

    reset: () => set({
        entries: [],
        cursor: -1,
        isReplaying: false,
        canGoBack: false,
        canGoForward: false,
    }),
}));

export const selectCanGoBack = (state: NavigationHistoryStore): boolean => state.canGoBack;
export const selectCanGoForward = (state: NavigationHistoryStore): boolean => state.canGoForward;
