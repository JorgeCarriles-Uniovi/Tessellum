import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { GraphLegend } from "./GraphLegend";
import type { GraphData } from "../../utils/graphUtils";

function makeData(): GraphData {
    return {
        nodes: [
            { id: "a", label: "A", exists: true, orphan: false, tags: ["alpha"] },
            { id: "b", label: "B", exists: true, orphan: false, tags: ["beta"] },
        ],
        edges: [],
    };
}

describe("GraphLegend", () => {
    beforeEach(() => localStorage.clear());

    it("shows a 'Multiple tags' row when at least two tag clusters exist", () => {
        render(<GraphLegend graphData={makeData()} />);
        expect(screen.getByText("Multiple tags")).toBeInTheDocument();
    });

    it("omits the 'Multiple tags' row when fewer than two tag clusters exist", () => {
        const oneTag: GraphData = { nodes: [{ id: "a", label: "A", exists: true, orphan: false, tags: ["alpha"] }], edges: [] };
        render(<GraphLegend graphData={oneTag} />);
        expect(screen.queryByText("Multiple tags")).not.toBeInTheDocument();
    });

    it("moves when its header is dragged", () => {
        const { container } = render(<GraphLegend graphData={makeData()} />);
        const panel = container.firstChild as HTMLElement;
        expect(panel.style.left).toBe("16px");

        const header = screen.getByText("Tag clusters");
        fireEvent.pointerDown(header, { clientX: 0, clientY: 0 });
        fireEvent.pointerMove(header, { clientX: 40, clientY: 25 });
        fireEvent.pointerUp(header, { clientX: 40, clientY: 25 });

        expect(panel.style.left).toBe("56px");
        expect(panel.style.top).toBe("41px");
    });

    it("keeps the outer wrapper click-through but the header interactive", () => {
        const { container } = render(<GraphLegend graphData={makeData()} />);
        const panel = container.firstChild as HTMLElement;
        expect(panel.style.pointerEvents).toBe("none");

        const header = screen.getByText("Tag clusters");
        expect(header.style.pointerEvents).toBe("auto");
    });
});
