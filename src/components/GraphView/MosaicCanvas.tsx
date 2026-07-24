import { useMemo } from "react";
import type { GraphData } from "../../utils/graphUtils";
import { stringToColor } from "../../utils/graphUtils";
import { countConnections } from "../../utils/graphStats";

interface Props {
    graphData: GraphData | null;
    selectedNodeId: string | null;
    onNodeClick: (nodeId: string) => void;
    onNodeDoubleClick: (nodeId: string) => void;
}

const MAX_TILES = 200;

interface MosaicTile {
    id: string;
    label: string;
    hue: number | null;
    orphan: boolean;
    unresolved: boolean;
}

function pickVisibleNodes(nodes: GraphData["nodes"], connections: Map<string, number>, selectedNodeId: string | null): GraphData["nodes"] {
    if (nodes.length <= MAX_TILES) return nodes;
    const sorted = [...nodes].sort((a, b) => (connections.get(b.id) ?? 0) - (connections.get(a.id) ?? 0));
    const top = sorted.slice(0, MAX_TILES);
    if (selectedNodeId && !top.some((n) => n.id === selectedNodeId)) {
        const selectedNode = nodes.find((n) => n.id === selectedNodeId);
        if (selectedNode) {
            top[top.length - 1] = selectedNode;  // swap out the weakest to guarantee the selection is visible
        }
    }
    return top;
}

export function MosaicCanvas({ graphData, selectedNodeId, onNodeClick, onNodeDoubleClick }: Props) {
    const tiles = useMemo<MosaicTile[] | null>(() => {
        if (!graphData) return null;
        const connections = countConnections(graphData.nodes, graphData.edges);
        return pickVisibleNodes(graphData.nodes, connections, selectedNodeId).map((n) => ({
            id: n.id,
            label: n.label,
            hue: n.tags.length > 0 ? stringToColor(n.tags[0]).h : null,
            orphan: n.orphan,
            unresolved: !n.exists,
        }));
    }, [graphData, selectedNodeId]);

    const selectedLabel = useMemo(() => {
        if (!graphData || !selectedNodeId) return null;
        return graphData.nodes.find((n) => n.id === selectedNodeId)?.label ?? null;
    }, [graphData, selectedNodeId]);

    if (!tiles) return null;

    const total = graphData?.nodes.length ?? 0;
    const showingCaption = total > MAX_TILES;

    return (
        <div
            style={{
                position: "absolute", inset: 0,
                overflow: "auto",
                background: "var(--color-bg-primary)",
            }}
        >
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(56px, 1fr))",
                    gap: 8,
                    padding: 24,
                }}
            >
                {tiles.map((t) => {
                    const isSelected = t.id === selectedNodeId;
                    const background = t.unresolved
                        ? "hsl(0 0% 62% / .16)"
                        : t.hue == null
                            ? "hsl(0 0% 62%)"
                            : `linear-gradient(147deg, hsl(${t.hue} 56% 69%), hsl(${t.hue} 56% 57%))`;
                    return (
                        <button
                            key={t.id}
                            type="button"
                            aria-label={t.label}
                            aria-pressed={isSelected}
                            onClick={() => onNodeClick(t.id)}
                            onDoubleClick={() => onNodeDoubleClick(t.id)}
                            title={t.label}
                            style={{
                                aspectRatio: "1 / 1",
                                border: t.unresolved ? "1px dashed var(--color-text-tertiary)" : "none",
                                background,
                                borderRadius: 8,
                                cursor: "pointer",
                                opacity: t.orphan ? 0.6 : 1,
                                padding: 0,
                                boxShadow: isSelected
                                    ? "0 0 0 3px var(--color-accent-default), 0 0 24px 6px var(--color-accent-soft)"
                                    : "var(--shadow-sm)",
                                transition: "box-shadow 150ms ease",
                            }}
                        />
                    );
                })}
            </div>

            {selectedLabel && (
                <div
                    style={{
                        position: "absolute", left: "50%", top: 12, transform: "translateX(-50%)",
                        fontFamily: "var(--font-editor)",
                        fontSize: 14, fontWeight: 600,
                        color: "var(--color-text-primary)",
                        background: "var(--color-bg-secondary)",
                        border: "1px solid var(--color-border-light)",
                        borderRadius: 20, padding: "4px 14px",
                        boxShadow: "var(--shadow-sm)",
                        pointerEvents: "none",
                    }}
                >
                    {selectedLabel}
                </div>
            )}

            {showingCaption && (
                <div
                    style={{
                        position: "absolute", left: 16, bottom: 16,
                        fontSize: 11, color: "var(--color-text-tertiary)",
                        background: "var(--color-bg-secondary)",
                        border: "1px solid var(--color-border-light)",
                        borderRadius: 8, padding: "4px 8px",
                    }}
                >
                    Showing top {MAX_TILES} of {total} notes by connectivity
                </div>
            )}
        </div>
    );
}
