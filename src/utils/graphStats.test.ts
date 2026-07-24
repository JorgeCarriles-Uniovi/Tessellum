import { describe, expect, it } from "vitest";
import { computeTagClusters, countConnections } from "./graphStats";
import type { GraphData } from "./graphUtils";

const sample: GraphData = {
    nodes: [
        { id: "a", label: "A", exists: true, orphan: false, tags: ["systems", "literature"] },
        { id: "b", label: "B", exists: true, orphan: false, tags: ["systems"] },
        { id: "c", label: "C", exists: true, orphan: true,  tags: [] },
        { id: "d", label: "D", exists: false, orphan: false, tags: [] },
    ],
    edges: [
        { source: "a", target: "b", broken: false },
        { source: "a", target: "d", broken: true },
    ],
};

describe("computeTagClusters", () => {
    it("counts tags across all nodes and sorts descending", () => {
        const clusters = computeTagClusters(sample.nodes);
        expect(clusters[0]).toMatchObject({ tag: "systems", count: 2 });
        expect(clusters[1]).toMatchObject({ tag: "literature", count: 1 });
        expect(clusters).toHaveLength(2);
    });

    it("assigns a stable hue per tag via stringToColor", () => {
        const first = computeTagClusters(sample.nodes);
        const again = computeTagClusters(sample.nodes);
        expect(first[0].hue).toEqual(again[0].hue);
        expect(first[0].hue).toBeGreaterThanOrEqual(0);
        expect(first[0].hue).toBeLessThan(360);
    });
});

describe("countConnections", () => {
    it("counts incoming + outgoing edges per node", () => {
        const counts = countConnections(sample.nodes, sample.edges);
        expect(counts.get("a")).toBe(2);  // out: a→b, a→d
        expect(counts.get("b")).toBe(1);  // in: a→b
        expect(counts.get("d")).toBe(1);  // in: a→d
        expect(counts.get("c") ?? 0).toBe(0);  // isolated
    });
});
