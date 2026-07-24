import type { GraphData } from "../../utils/graphUtils";
import { computeTagClusters, computeTileBackground } from "../../utils/graphStats";
import { useDraggablePosition } from "../../hooks/useDraggablePosition";
import { useAppTranslation } from "../../i18n/react.tsx";

interface Props {
    graphData: GraphData | null;
}

const LEGEND_MAX_TAGS = 8;

export function GraphLegend({ graphData }: Props) {
    const { t } = useAppTranslation("core");
    const drag = useDraggablePosition({ initial: { x: 16, y: 16 }, storageKey: "tessellum:graphLegendPosition" });

    if (!graphData) return null;
    const allClusters = computeTagClusters(graphData.nodes);
    const clusters = allClusters.slice(0, LEGEND_MAX_TAGS);
    const orphanCount = graphData.nodes.filter((n) => n.orphan).length;
    const unresolvedCount = graphData.nodes.filter((n) => !n.exists).length;

    if (clusters.length === 0 && orphanCount === 0 && unresolvedCount === 0) return null;

    return (
        <div
            style={{
                position: "absolute", left: drag.position.x, top: drag.position.y,
                background: "var(--color-bg-secondary)",
                border: "1px solid var(--color-border-light)",
                borderRadius: 12,
                boxShadow: "var(--shadow-lg)",
                padding: "12px 14px",
                minWidth: 176,
                zIndex: 10,
            }}
        >
            <div
                onPointerDown={drag.handlePointerDown}
                onPointerMove={drag.handlePointerMove}
                onPointerUp={drag.handlePointerUp}
                style={{
                    fontSize: 10, fontWeight: 600, letterSpacing: ".1em",
                    textTransform: "uppercase",
                    color: "var(--color-text-tertiary)", marginBottom: 9,
                    cursor: drag.isDragging ? "grabbing" : "grab",
                    userSelect: "none",
                }}
            >
                {t("graph.tagClustersLabel", { defaultValue: "Tag clusters" })}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {clusters.map((c) => (
                    <LegendRow key={c.tag} label={`#${c.tag}`} count={c.count}
                        swatch={<span style={{
                            width: 13, height: 13, borderRadius: 4,
                            background: `linear-gradient(147deg, hsl(${c.hue} 56% 69%), hsl(${c.hue} 56% 57%))`,
                        }} />}
                    />
                ))}
                {(orphanCount > 0 || unresolvedCount > 0) && (
                    <div style={{ height: 1, background: "var(--color-border-light)", margin: "3px 0" }} />
                )}
                {orphanCount > 0 && (
                    <LegendRow label={t("graph.filterOrphans")} count={orphanCount}
                        swatch={<span style={{
                            width: 13, height: 13, borderRadius: 4,
                            background: "hsl(0 0% 62%)",
                        }} />}
                    />
                )}
                {unresolvedCount > 0 && (
                    <LegendRow label={t("graph.filterUnresolved")} count={unresolvedCount}
                        swatch={<span style={{
                            width: 13, height: 13, borderRadius: 4,
                            background: "hsl(0 0% 62% / .16)",
                            border: "1px solid var(--color-text-tertiary)",
                        }} />}
                    />
                )}
                {allClusters.length >= 2 && (
                    <>
                        <div style={{ height: 1, background: "var(--color-border-light)", margin: "3px 0" }} />
                        <LegendRow label={t("graph.multipleTags", { defaultValue: "Multiple tags" })}
                            swatch={<span style={{
                                width: 13, height: 13, borderRadius: 4,
                                background: computeTileBackground([allClusters[0].tag, allClusters[1].tag]),
                            }} />}
                        />
                    </>
                )}
            </div>
        </div>
    );
}

function LegendRow({ label, count, swatch }: { label: string; count?: number; swatch: React.ReactNode }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            {swatch}
            <span style={{ flex: 1, fontSize: 12, color: "var(--color-text-secondary)" }}>{label}</span>
            {count !== undefined && <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{count}</span>}
        </div>
    );
}
