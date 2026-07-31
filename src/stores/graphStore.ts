import { create } from "zustand";

export interface GraphState {
    viewMode: "editor" | "graph" | "canvas";
    canvasPath: string | null;
    isLocalGraphOpen: boolean;
    selectedGraphNode: string | null;
    graphMode: "network" | "mosaic";
    graphFilter: "all" | "orphans" | "unresolved";
}

export interface GraphActions {
    setViewMode: (mode: "editor" | "graph" | "canvas") => void;
    setCanvasPath: (path: string | null) => void;
    toggleLocalGraph: () => void;
    setSelectedGraphNode: (path: string | null) => void;
    setGraphMode: (mode: "network" | "mosaic") => void;
    setGraphFilter: (filter: "all" | "orphans" | "unresolved") => void;
}

export type GraphStore = GraphState & GraphActions;

export const useGraphStore = create<GraphStore>((set) => ({
    viewMode: "editor",
    canvasPath: null,
    isLocalGraphOpen: false,
    selectedGraphNode: null,
    graphMode: "network",
    graphFilter: "all",

    setViewMode: (mode) => set({ viewMode: mode, selectedGraphNode: null }),
    setCanvasPath: (path) => set({ canvasPath: path }),
    toggleLocalGraph: () => set((state) => ({ isLocalGraphOpen: !state.isLocalGraphOpen, selectedGraphNode: null })),
    setSelectedGraphNode: (path) => set({ selectedGraphNode: path }),
    setGraphMode: (graphMode) => set({ graphMode }),
    setGraphFilter: (graphFilter) => set({ graphFilter }),
}));
