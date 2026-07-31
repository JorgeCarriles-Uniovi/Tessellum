import { describe, expect, it, beforeEach } from "vitest";
import { useGraphDataStore } from "./graphDataStore";
import type { GraphData } from "../utils/graphUtils";

const sampleData: GraphData = {
    nodes: [{ id: "a", label: "A", exists: true, orphan: false, tags: [] }],
    edges: [],
};

describe("graphDataStore", () => {
    beforeEach(() => {
        useGraphDataStore.getState().clearForVaultChange(null);
    });

    it("stores fetched graph data with its vault path", () => {
        useGraphDataStore.getState().setGraphData(sampleData, "/vault");
        expect(useGraphDataStore.getState().graphData).toBe(sampleData);
        expect(useGraphDataStore.getState().cachedForVault).toBe("/vault");
        expect(useGraphDataStore.getState().isStale).toBe(false);
    });

    it("marks the cache stale but keeps the data (so UI keeps showing something)", () => {
        useGraphDataStore.getState().setGraphData(sampleData, "/vault");
        useGraphDataStore.getState().markStale();
        expect(useGraphDataStore.getState().isStale).toBe(true);
        expect(useGraphDataStore.getState().graphData).toBe(sampleData);
    });

    it("clears everything when switching vaults", () => {
        useGraphDataStore.getState().setGraphData(sampleData, "/vault");
        useGraphDataStore.getState().setNodePositions({ a: { x: 1, y: 2 } });
        useGraphDataStore.getState().clearForVaultChange("/other-vault");
        expect(useGraphDataStore.getState().graphData).toBeNull();
        expect(useGraphDataStore.getState().cachedForVault).toBeNull();
        expect(useGraphDataStore.getState().nodePositions).toBeNull();
    });

    it("preserves cache when clearForVaultChange is called with the same vault", () => {
        useGraphDataStore.getState().setGraphData(sampleData, "/vault");
        useGraphDataStore.getState().clearForVaultChange("/vault");
        expect(useGraphDataStore.getState().graphData).toBe(sampleData);
    });
});
