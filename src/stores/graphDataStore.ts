import { create } from "zustand";
import type { GraphData } from "../utils/graphUtils";

export interface GraphDataStoreState {
    graphData: GraphData | null;
    cachedForVault: string | null;
    nodePositions: Record<string, { x: number; y: number }> | null;
    isStale: boolean;
    isFetching: boolean;
    fetchError: string | null;
}

export interface GraphDataStoreActions {
    setGraphData: (data: GraphData, forVault: string) => void;
    markStale: () => void;
    setNodePositions: (positions: Record<string, { x: number; y: number }>) => void;
    setFetching: (isFetching: boolean) => void;
    setError: (message: string | null) => void;
    clearForVaultChange: (newVault: string | null) => void;
}

export const useGraphDataStore = create<GraphDataStoreState & GraphDataStoreActions>((set) => ({
    graphData: null,
    cachedForVault: null,
    nodePositions: null,
    isStale: false,
    isFetching: false,
    fetchError: null,

    setGraphData: (graphData, forVault) => set({
        graphData,
        cachedForVault: forVault,
        isStale: false,
        fetchError: null,
    }),
    markStale: () => set({ isStale: true }),
    setNodePositions: (nodePositions) => set({ nodePositions }),
    setFetching: (isFetching) => set({ isFetching }),
    setError: (fetchError) => set({ fetchError }),
    clearForVaultChange: (newVault) => set((state) => {
        if (state.cachedForVault === newVault) return state;
        return {
            graphData: null,
            cachedForVault: null,
            nodePositions: null,
            isStale: false,
            fetchError: null,
        };
    }),
}));
