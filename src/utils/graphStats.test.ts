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

import { bucketNodesByDominantTag, computeTileBackground } from "./graphStats";

describe("computeTileBackground", () => {
    it("returns a solid grey for a note with no tags", () => {
        expect(computeTileBackground([])).toBe("hsl(0 0% 62%)");
    });

    it("returns the existing single-hue gradient for a note with one tag", () => {
        const bg = computeTileBackground(["rust"]);
        expect(bg).toMatch(/^linear-gradient\(147deg, hsl\(\d+ 56% 69%\), hsl\(\d+ 56% 57%\)\)$/);
    });

    it("returns a hard-edged N-band diagonal split for multiple tags, one band per tag in order", () => {
        const bg = computeTileBackground(["rust", "systems", "notes"]);
        expect(bg.startsWith("linear-gradient(135deg, ")).toBe(true);
        // 3 tags -> 3 comma-separated stops, each with an explicit "from% to%" hard edge
        const stops = bg.slice("linear-gradient(135deg, ".length, -1).split(", ");
        expect(stops).toHaveLength(3);
        expect(stops[0]).toMatch(/0% 33\.3+%$/);
        expect(stops[1]).toMatch(/33\.3+% 66\.6+%$/);
        expect(stops[2]).toMatch(/66\.6+% 100%$/);
    });
});

describe("bucketNodesByDominantTag", () => {
    const nodes = [
        { id: "a", label: "A", exists: true, orphan: false, tags: ["popular"] },
        { id: "b", label: "B", exists: true, orphan: false, tags: ["popular", "rare"] },
        { id: "c", label: "C", exists: true, orphan: false, tags: ["rare"] },
        { id: "d", label: "D", exists: true, orphan: false, tags: [] },
    ];
    const clusters = [
        { tag: "popular", count: 2, hue: 0 },
        { tag: "rare", count: 2, hue: 0 },
    ];

    it("groups each node under its highest-ranked tag, and untagged nodes in a final '' bucket", () => {
        const buckets = bucketNodesByDominantTag(nodes, clusters);
        expect(buckets).toEqual([
            { key: "popular", nodeIds: ["a", "b"] },
            { key: "rare", nodeIds: ["c"] },
            { key: "", nodeIds: ["d"] },
        ]);
    });

    it("omits empty buckets entirely", () => {
        const onlyPopular = [{ id: "a", label: "A", exists: true, orphan: false, tags: ["popular"] }];
        const buckets = bucketNodesByDominantTag(onlyPopular, clusters);
        expect(buckets).toEqual([{ key: "popular", nodeIds: ["a"] }]);
    });
});
