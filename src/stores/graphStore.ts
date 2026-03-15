import { create } from "zustand";

export interface GraphState {
    viewMode: "editor" | "graph";
    isLocalGraphOpen: boolean;
    selectedGraphNode: string | null;
}

export interface GraphActions {
    setViewMode: (mode: "editor" | "graph") => void;
    toggleLocalGraph: () => void;
    setSelectedGraphNode: (path: string | null) => void;
}

export type GraphStore = GraphState & GraphActions;

export const useGraphStore = create<GraphStore>((set) => ({
    viewMode: "editor",
    isLocalGraphOpen: false,
    selectedGraphNode: null,

    setViewMode: (mode) => set({ viewMode: mode, selectedGraphNode: null }),
    toggleLocalGraph: () => set((state) => ({ isLocalGraphOpen: !state.isLocalGraphOpen, selectedGraphNode: null })),
    setSelectedGraphNode: (path) => set({ selectedGraphNode: path }),
}));
