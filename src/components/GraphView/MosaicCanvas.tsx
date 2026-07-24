import { useMemo } from "react";
import type { GraphData } from "../../utils/graphUtils";
import { computeTagClusters, countConnections, bucketNodesByDominantTag, computeTileBackground } from "../../utils/graphStats";
import { packHexClusters, HEX_CLIP_PATH, HEX_TILE_WIDTH, HEX_TILE_HEIGHT } from "../../utils/hexGrid";
import { useAppTranslation } from "../../i18n/react.tsx";

interface Props {
    graphData: GraphData | null;
    selectedNodeId: string | null;
    onNodeClick: (nodeId: string) => void;
    onNodeDoubleClick: (nodeId: string) => void;
}

const MAX_TILES = 200;
const HALO_MARGIN = 13;

interface MosaicTile {
    id: string;
    label: string;
    tags: string[];
    orphan: boolean;
    unresolved: boolean;
    x: number;
    y: number;
}

function pickVisibleNodes(nodes: GraphData["nodes"], connections: Map<string, number>, selectedNodeId: string | null): GraphData["nodes"] {
    if (nodes.length <= MAX_TILES) return nodes;
    const sorted = [...nodes].sort((a, b) => (connections.get(b.id) ?? 0) - (connections.get(a.id) ?? 0));
    const top = sorted.slice(0, MAX_TILES);
    if (selectedNodeId && !top.some((n) => n.id === selectedNodeId)) {
        const selectedNode = nodes.find((n) => n.id === selectedNodeId);
        if (selectedNode) {
            top[top.length - 1] = selectedNode;
        }
    }
    return top;
}

export function MosaicCanvas({ graphData, selectedNodeId, onNodeClick, onNodeDoubleClick }: Props) {
    const { t } = useAppTranslation("core");

    const layout = useMemo(() => {
        if (!graphData) return null;
        const connections = countConnections(graphData.nodes, graphData.edges);
        const visible = pickVisibleNodes(graphData.nodes, connections, selectedNodeId);
        const nodesById = new Map(visible.map((n) => [n.id, n]));
        const clusters = computeTagClusters(visible);
        const buckets = bucketNodesByDominantTag(visible, clusters).map((b) => ({ items: b.nodeIds }));
        const { tiles: hexTiles, width, height } = packHexClusters(buckets);

        const tiles: MosaicTile[] = hexTiles.map((hexTile) => {
            const node = nodesById.get(hexTile.item)!;
            return {
                id: node.id,
                label: node.label,
                tags: node.tags,
                orphan: node.orphan,
                unresolved: !node.exists,
                x: hexTile.x,
                y: hexTile.y,
            };
        });

        return { tiles, width, height };
    }, [graphData, selectedNodeId]);

    if (!layout) return null;

    const total = graphData?.nodes.length ?? 0;
    const showingCaption = total > MAX_TILES;
    const selectedTile = layout.tiles.find((t) => t.id === selectedNodeId) ?? null;

    return (
        <div style={{ position: "absolute", inset: 0, overflow: "auto", background: "var(--color-bg-primary)" }}>
            <div style={{ position: "relative", width: layout.width, height: layout.height, margin: "40px auto" }}>
                {selectedTile && (
                    <div
                        data-testid="mosaic-halo"
                        style={{
                            position: "absolute",
                            left: selectedTile.x - HALO_MARGIN / 2,
                            top: selectedTile.y - HALO_MARGIN / 2,
                            width: HEX_TILE_WIDTH + HALO_MARGIN,
                            height: HEX_TILE_HEIGHT + HALO_MARGIN,
                            clipPath: HEX_CLIP_PATH,
                            background: "var(--color-text-primary)",
                        }}
                    />
                )}

                {layout.tiles.map((tile) => {
                    const isSelected = tile.id === selectedNodeId;
                    const background = tile.unresolved
                        ? "hsl(0 0% 62% / .16)"
                        : computeTileBackground(tile.tags);
                    return (
                        <button
                            key={tile.id}
                            type="button"
                            aria-label={tile.label}
                            aria-pressed={isSelected}
                            onClick={() => onNodeClick(tile.id)}
                            onDoubleClick={() => onNodeDoubleClick(tile.id)}
                            title={tile.label}
                            style={{
                                position: "absolute",
                                left: tile.x, top: tile.y,
                                width: HEX_TILE_WIDTH, height: HEX_TILE_HEIGHT,
                                clipPath: HEX_CLIP_PATH,
                                border: tile.unresolved ? "1px dashed var(--color-text-tertiary)" : "none",
                                background,
                                cursor: "pointer",
                                opacity: tile.orphan ? 0.6 : 1,
                                padding: 0,
                            }}
                        />
                    );
                })}

                {selectedTile && (
                    <div
                        style={{
                            position: "absolute",
                            left: selectedTile.x + HEX_TILE_WIDTH / 2,
                            top: selectedTile.y - 36,
                            transform: "translateX(-50%)",
                            whiteSpace: "nowrap",
                            fontFamily: "var(--font-sans)",
                            fontSize: 11, fontWeight: 600,
                            color: "var(--color-bg-app)",
                            background: "var(--color-text-primary)",
                            padding: "4px 10px", borderRadius: 7,
                            boxShadow: "var(--shadow)",
                            zIndex: 5, pointerEvents: "none",
                        }}
                    >
                        {selectedTile.label}
                    </div>
                )}
            </div>

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
                    {t("graph.mosaicTopNCaption", { shown: MAX_TILES, total })}
                </div>
            )}
        </div>
    );
}
