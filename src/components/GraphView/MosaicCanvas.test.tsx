import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MosaicCanvas } from "./MosaicCanvas";
import type { GraphData } from "../../utils/graphUtils";

function makeData(count: number): GraphData {
    return {
        nodes: Array.from({ length: count }, (_, i) => ({
            id: `n${i}`, label: `N${i}`, exists: true, orphan: false, tags: [i % 3 === 0 ? "tagA" : "tagB"],
        })),
        edges: Array.from({ length: Math.max(0, count - 1) }, (_, i) => ({
            source: `n${i}`, target: `n${i + 1}`, broken: false,
        })),
    };
}

describe("MosaicCanvas", () => {
    it("renders one tile per note when count is under the cap", () => {
        const onClick = vi.fn();
        render(<MosaicCanvas graphData={makeData(12)} selectedNodeId={null} onNodeClick={onClick} onNodeDoubleClick={vi.fn()} />);
        expect(screen.getAllByRole("button", { name: /^N\d+$/ })).toHaveLength(12);
    });

    it("caps at 200 tiles + always includes the selected node", () => {
        const data = makeData(250);
        // n249 is the LAST node, so likely to be edge-connected but not necessarily in the top-200 by count
        // The selected node MUST be present regardless of ranking
        render(<MosaicCanvas graphData={data} selectedNodeId="n249" onNodeClick={vi.fn()} onNodeDoubleClick={vi.fn()} />);
        const tiles = screen.getAllByRole("button", { name: /^N\d+$/ });
        expect(tiles.length).toBeLessThanOrEqual(200);
        expect(screen.getByRole("button", { name: "N249" })).toBeInTheDocument();
    });

    it("calls onNodeClick when a tile is clicked", () => {
        const onClick = vi.fn();
        render(<MosaicCanvas graphData={makeData(3)} selectedNodeId={null} onNodeClick={onClick} onNodeDoubleClick={vi.fn()} />);
        fireEvent.click(screen.getByRole("button", { name: "N1" }));
        expect(onClick).toHaveBeenCalledWith("n1");
    });

    it("marks the selected tile with an aria-pressed=true and a distinct visual", () => {
        render(<MosaicCanvas graphData={makeData(3)} selectedNodeId="n1" onNodeClick={vi.fn()} onNodeDoubleClick={vi.fn()} />);
        expect(screen.getByRole("button", { name: "N1" })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("button", { name: "N0" })).toHaveAttribute("aria-pressed", "false");
    });

    it("renders nothing when graphData is null", () => {
        const { container } = render(<MosaicCanvas graphData={null} selectedNodeId={null} onNodeClick={vi.fn()} onNodeDoubleClick={vi.fn()} />);
        expect(container.firstChild).toBeNull();
    });
});
