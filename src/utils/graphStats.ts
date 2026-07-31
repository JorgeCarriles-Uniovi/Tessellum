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

export function computeTileBackground(tags: string[]): string {
    if (tags.length === 0) return "hsl(0 0% 62%)";
    if (tags.length === 1) {
        const hue = stringToColor(tags[0]).h;
        return `linear-gradient(147deg, hsl(${hue} 56% 69%), hsl(${hue} 56% 57%))`;
    }
    const bandCount = tags.length;
    const stops = tags.map((tag, i) => {
        const hue = stringToColor(tag).h;
        const from = (i / bandCount) * 100;
        const to = ((i + 1) / bandCount) * 100;
        return `hsl(${hue} 56% 63%) ${from}% ${to}%`;
    });
    return `linear-gradient(135deg, ${stops.join(", ")})`;
}

export function bucketNodesByDominantTag(
    nodes: GraphData["nodes"],
    clusters: TagCluster[],
): { key: string; nodeIds: string[] }[] {
    const rank = new Map(clusters.map((c, i) => [c.tag, i]));
    const byKey = new Map<string, string[]>();

    for (const node of nodes) {
        const dominant = node.tags.length === 0
            ? ""
            : [...node.tags].sort((a, b) => (rank.get(a) ?? Infinity) - (rank.get(b) ?? Infinity))[0];
        const bucket = byKey.get(dominant) ?? [];
        bucket.push(node.id);
        byKey.set(dominant, bucket);
    }

    const ordered = clusters
        .map((c) => ({ key: c.tag, nodeIds: byKey.get(c.tag) ?? [] }))
        .filter((b) => b.nodeIds.length > 0);
    const untagged = byKey.get("");
    if (untagged && untagged.length > 0) ordered.push({ key: "", nodeIds: untagged });
    return ordered;
}
