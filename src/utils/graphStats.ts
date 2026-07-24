import type { GraphData } from "./graphUtils";
import { stringToColor } from "./graphUtils";

export interface TagCluster {
    tag: string;
    count: number;
    hue: number;
}

export function computeTagClusters(nodes: GraphData["nodes"]): TagCluster[] {
    const counts = new Map<string, number>();
    for (const node of nodes) {
        for (const tag of node.tags) {
            counts.set(tag, (counts.get(tag) ?? 0) + 1);
        }
    }
    return Array.from(counts.entries())
        .map(([tag, count]) => ({ tag, count, hue: stringToColor(tag).h }))
        .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export function countConnections(
    nodes: GraphData["nodes"],
    edges: GraphData["edges"],
): Map<string, number> {
    const counts = new Map<string, number>();
    for (const node of nodes) counts.set(node.id, 0);
    for (const edge of edges) {
        counts.set(edge.source, (counts.get(edge.source) ?? 0) + 1);
        counts.set(edge.target, (counts.get(edge.target) ?? 0) + 1);
    }
    return counts;
}
