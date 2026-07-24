import type { GraphData } from "../../utils/graphUtils";
import { computeTagClusters } from "../../utils/graphStats";
import { useAppTranslation } from "../../i18n/react.tsx";

interface Props {
    graphData: GraphData | null;
}

const LEGEND_MAX_TAGS = 8;

export function GraphLegend({ graphData }: Props) {
    const { t } = useAppTranslation("core");
    if (!graphData) return null;
    const clusters = computeTagClusters(graphData.nodes).slice(0, LEGEND_MAX_TAGS);
    const orphanCount = graphData.nodes.filter((n) => n.orphan).length;
    const unresolvedCount = graphData.nodes.filter((n) => !n.exists).length;

    if (clusters.length === 0 && orphanCount === 0 && unresolvedCount === 0) return null;

    return (
        <div
            style={{
                position: "absolute", top: 16, left: 16,
                background: "var(--color-bg-secondary)",
                border: "1px solid var(--color-border-light)",
                borderRadius: 12,
                boxShadow: "var(--shadow-lg)",
                padding: "12px 14px",
                minWidth: 176,
                zIndex: 10,
                pointerEvents: "none",
            }}
        >
            <div
                style={{
                    fontSize: 10, fontWeight: 600, letterSpacing: ".1em",
                    textTransform: "uppercase",
                    color: "var(--color-text-tertiary)", marginBottom: 9,
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
            </div>
        </div>
    );
}

function LegendRow({ label, count, swatch }: { label: string; count: number; swatch: React.ReactNode }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            {swatch}
            <span style={{ flex: 1, fontSize: 12, color: "var(--color-text-secondary)" }}>{label}</span>
            <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{count}</span>
        </div>
    );
}
