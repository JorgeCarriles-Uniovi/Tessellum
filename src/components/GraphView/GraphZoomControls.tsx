import type cytoscape from "cytoscape";
import { Plus, Minus, Maximize2 } from "lucide-react";

interface Props { cy: cytoscape.Core | null }

const ZOOM_STEP = 1.25;

export function GraphZoomControls({ cy }: Props) {
    if (!cy) return null;
    const zoom = (factor: number) => {
        const currentZoom = cy.zoom();
        const w = cy.width(), h = cy.height();
        cy.zoom({ level: currentZoom * factor, renderedPosition: { x: w / 2, y: h / 2 } });
    };
    const fit = () => { cy.animate({ fit: { eles: cy.elements(), padding: 60 }, duration: 300 } as any); };

    return (
        <div
            style={{
                position: "absolute", bottom: 16, right: 16,
                display: "flex", flexDirection: "column",
                background: "var(--color-bg-secondary)",
                border: "1px solid var(--color-border-light)",
                borderRadius: 10,
                boxShadow: "var(--shadow-sm)",
                overflow: "hidden", zIndex: 10,
            }}
        >
            <ZoomBtn onClick={() => zoom(ZOOM_STEP)} title="Zoom in"><Plus size={15} /></ZoomBtn>
            <div style={{ height: 1, background: "var(--color-border-light)" }} />
            <ZoomBtn onClick={() => zoom(1 / ZOOM_STEP)} title="Zoom out"><Minus size={15} /></ZoomBtn>
            <div style={{ height: 1, background: "var(--color-border-light)" }} />
            <ZoomBtn onClick={fit} title="Fit to view"><Maximize2 size={15} /></ZoomBtn>
        </div>
    );
}

function ZoomBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            title={title}
            aria-label={title}
            style={{
                width: 34, height: 34,
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "none", background: "transparent",
                color: "var(--color-text-tertiary)", cursor: "pointer",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-bg-hover)"; e.currentTarget.style.color = "var(--color-text-primary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--color-text-tertiary)"; }}
        >
            {children}
        </button>
    );
}
