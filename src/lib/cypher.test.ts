import { describe, expect, test } from "vitest";
import { runCypherGraphFilter, applyFilterToGraphData } from "./cypherGraphFilter";
import { normalizeCypherQuery, normalizeCypherTagEqualityShorthand } from "./cypherQueryNormalizer";
import { CYPHER_QUERY_SAMPLES } from "./cypherQuerySamples";
import { cn } from "./utils";

const graphData = {
    nodes: [
        { id: "notes/a.md", label: "Architecture", exists: true, orphan: false, tags: ["rust", "backend"] },
        { id: "notes/b.md", label: "Brainstorm", exists: true, orphan: false, tags: ["frontend"] },
        { id: "notes/c.md", label: "Checklist", exists: false, orphan: false, tags: ["backend"] },
        { id: "notes/d.md", label: "Design", exists: true, orphan: true, tags: [] },
    ],
    edges: [
        { source: "notes/a.md", target: "notes/b.md", broken: false },
        { source: "notes/b.md", target: "notes/c.md", broken: true },
        { source: "notes/d.md", target: "notes/a.md", broken: false },
    ],
};

describe("cypher helpers", () => {
    test("normalizes tag equality shorthand and adds return clauses", () => {
        expect(normalizeCypherTagEqualityShorthand("MATCH (n) WHERE n.tags = rust, backend")).toBe(
            'MATCH (n) WHERE "rust" IN n.tags AND "backend" IN n.tags',
        );
        expect(normalizeCypherTagEqualityShorthand("MATCH (n) WHERE n.tags = [\"rust\", \"backend\"]")).toBe(
            'MATCH (n) WHERE n.tags = ["rust", "backend"]',
        );
        expect(normalizeCypherTagEqualityShorthand("MATCH (n) WHERE n.tags = bad tag")).toBe(
            "MATCH (n) WHERE n.tags = bad tag",
        );
        expect(normalizeCypherQuery("MATCH (a) -- (b)")).toBe(
            "MATCH (a) -[:LINKS_TO]- (b) RETURN a, b",
        );
    });

    test("filters graph data for relation, boolean, contains, and exact tag queries", () => {
        const relationFilter = runCypherGraphFilter(
            'MATCH (a) --> (b) WHERE "rust" IN a.tags AND b.label CONTAINS "brain"',
            graphData,
        );

        expect([...relationFilter.nodeIds].sort()).toEqual(["notes/a.md", "notes/b.md"]);
        expect([...relationFilter.edgeIds]).toEqual(["notes/a.md->notes/b.md"]);

        const exactTags = runCypherGraphFilter(
            'MATCH (n) WHERE n.tags = ["backend", "rust"]',
            graphData,
        );
        expect([...exactTags.nodeIds]).toEqual(["notes/a.md"]);

        const missingNodes = runCypherGraphFilter(
            "MATCH (n) WHERE n.exists = false",
            graphData,
        );
        expect([...missingNodes.nodeIds]).toEqual(["notes/c.md"]);
    });

    test("supports undirected relations and OR predicates", () => {
        const filter = runCypherGraphFilter(
            'MATCH (n) -- (m) WHERE n.label = "Design" OR m.label = "Design"',
            graphData,
        );

        expect([...filter.nodeIds].sort()).toEqual(["notes/a.md", "notes/d.md"]);
        expect([...filter.edgeIds]).toEqual(["notes/d.md->notes/a.md"]);
    });

    test("rejects unsupported syntax and unsupported return values", () => {
        expect(() => runCypherGraphFilter("CREATE (n)", graphData)).toThrow(
            "Unsupported Cypher syntax. Use MATCH (n), MATCH (n) --> (x), or MATCH (n) -- (x) --> (y).",
        );
        expect(() => runCypherGraphFilter("MATCH (n) RETURN x", graphData)).toThrow(
            'Unsupported RETURN clause "x". Use variables from MATCH.',
        );
        expect(() => runCypherGraphFilter('MATCH (n) WHERE n.title = "A"', graphData)).toThrow(
            'Unsupported WHERE predicate "n.title = "A"".',
        );
    });

    test("applies explicit edge filters and keeps only connected nodes otherwise", () => {
        const withEdges = applyFilterToGraphData(graphData, {
            nodeIds: new Set(["notes/a.md", "notes/b.md", "notes/c.md"]),
            edgeIds: new Set(["notes/b.md->notes/c.md"]),
        });
        expect(withEdges.edges).toEqual([
            { source: "notes/b.md", target: "notes/c.md", broken: true },
        ]);

        const withoutEdges = applyFilterToGraphData(graphData, {
            nodeIds: new Set(["notes/a.md", "notes/b.md"]),
            edgeIds: new Set<string>(),
        });
        expect(withoutEdges.edges).toEqual([
            { source: "notes/a.md", target: "notes/b.md", broken: false },
        ]);
    });

    test("keeps query samples well formed and merges class names", () => {
        expect(CYPHER_QUERY_SAMPLES.every((sample) => sample.query.startsWith("MATCH "))).toBe(true);
        expect(new Set(CYPHER_QUERY_SAMPLES.map((sample) => sample.id)).size).toBe(CYPHER_QUERY_SAMPLES.length);
        expect(cn("px-2", undefined, "px-4", "font-bold")).toBe("px-4 font-bold");
    });
});
