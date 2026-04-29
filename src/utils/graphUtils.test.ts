import { describe, expect, test } from "vitest";
import {
    getCytoscapeStylesheet,
    mapGraphDataToElements,
    markOrphanNodes,
    stringToColor,
    type GraphData,
} from "./graphUtils";

const graphData: GraphData = {
    nodes: [
        { id: "a", label: "Alpha", exists: true, orphan: false, tags: ["rust"] },
        { id: "b", label: "Beta", exists: false, orphan: true, tags: [] },
    ],
    edges: [
        { source: "a", target: "b", broken: true },
    ],
};

describe("graphUtils", () => {
    test("derives deterministic colors from strings", () => {
        const first = stringToColor("rust");
        const second = stringToColor("rust");

        expect(first).toEqual(second);
        expect(first.base).toMatch(/^hsl\(/);
        expect(first.dark).toMatch(/^hsla\(/);
        expect(first.h).toBeGreaterThanOrEqual(0);
        expect(first.h).toBeLessThan(360);
    });

    test("maps backend graph data into cytoscape elements", () => {
        const elements = mapGraphDataToElements(graphData);

        expect(elements).toHaveLength(3);
        expect(elements[0]).toMatchObject({
            data: {
                id: "a",
                label: "Alpha",
                exists: true,
                tags: ["rust"],
            },
            classes: "",
        });
        expect(elements[1]).toMatchObject({
            data: {
                id: "b",
                label: "Beta",
                exists: false,
                tags: [],
            },
            classes: "orphan",
        });
        expect(elements[2]).toMatchObject({
            data: {
                id: "a->b",
                source: "a",
                target: "b",
                broken: true,
            },
        });
    });

    test("reads css variables and builds the stylesheet with fallbacks", () => {
        const root = document.documentElement;
        root.style.setProperty("--graph-node", "#112233");
        root.style.setProperty("--graph-node-orphan", "#223344");
        root.style.setProperty("--graph-node-missing", "#334455");
        root.style.setProperty("--graph-node-label", "#445566");
        root.style.setProperty("--graph-edge", "#556677");
        root.style.setProperty("--graph-edge-broken", "#667788");
        root.style.setProperty("--graph-node-active", "#778899");
        root.style.setProperty("--color-accent-default", "#8899aa");

        const stylesheet = getCytoscapeStylesheet();
        const nodeRule = stylesheet.find((rule) => rule.selector === "node");
        const selectedRule = stylesheet.find((rule) => rule.selector === "node:selected, node.highlighted");
        const brokenEdgeRule = stylesheet.find((rule) => rule.selector === "edge[?broken]");

        expect(nodeRule.style["background-color"]({ data: () => null })).toBe("#112233");
        expect(nodeRule.style.color).toBe("#445566");
        expect(selectedRule.style["background-color"]({ data: () => null })).toBe("#778899");
        expect(brokenEdgeRule.style["line-color"]).toBe("#667788");
    });

    test("marks only nodes without edges as orphan", () => {
        const orphanNode = {
            connectedEdges: () => [],
            addClass: (name: string) => {
                orphanNodeClass.push(name);
            },
            removeClass: () => {
                orphanRemoved.push(true);
            },
        };
        const connectedNode = {
            connectedEdges: () => [1],
            addClass: () => {
                connectedAdded.push(true);
            },
            removeClass: (name: string) => {
                connectedRemoved.push(name);
            },
        };
        const orphanNodeClass: string[] = [];
        const orphanRemoved: boolean[] = [];
        const connectedAdded: boolean[] = [];
        const connectedRemoved: string[] = [];

        markOrphanNodes({
            nodes: () => [orphanNode, connectedNode],
        } as never);

        expect(orphanNodeClass).toEqual(["orphan"]);
        expect(orphanRemoved).toEqual([]);
        expect(connectedAdded).toEqual([]);
        expect(connectedRemoved).toEqual(["orphan"]);
    });
});
