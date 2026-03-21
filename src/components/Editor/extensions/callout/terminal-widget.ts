import { WidgetType, EditorView } from "@codemirror/view";
import { CalloutBlock } from "./callout-parser";
import { baseHeaderEq, buildCollapseToggle, buildIconSpan } from "./callout-header-base";
import { toast } from "sonner";

export class TerminalHeaderWidget extends WidgetType {
    constructor(
        readonly block: CalloutBlock,
        readonly collapsed: boolean,
        readonly collapseKey: string,
    ) {
        super();
    }

    eq(other: TerminalHeaderWidget): boolean {
        return baseHeaderEq(this, other);
    }

    toDOM(view: EditorView): HTMLElement {
        const label = this.block.title || "terminal";

        // Header container
        const header = document.createElement("div");
        header.className = "cm-callout-header cm-terminal-header";

        // Use a generic color base in case we need it, though terminal CSS overrides this
        header.style.setProperty("--callout-color", "var(--callout-terminal)");

        // Add dots on the left
        const dots = document.createElement("div");
        dots.className = "cm-terminal-dots";
        ["red", "yellow", "green"].forEach(color => {
            const dot = document.createElement("span");
            dot.className = `cm-terminal-dot cm-terminal-dot-${color}`;
            dots.appendChild(dot);
        });
        header.appendChild(dots);

        // Icon (pure SVG, no React)
        const iconSpan = buildIconSpan(this.block.type);

        // Title
        const titleSpan = document.createElement("span");
        titleSpan.className = "cm-callout-title";

        // Icon + Label inside titleSpan for centering
        titleSpan.appendChild(iconSpan);
        const labelText = document.createTextNode(label);
        titleSpan.appendChild(labelText);

        // Add tooltip for copy functionality
        const tooltip = document.createElement("div");
        tooltip.className = "cm-terminal-tooltip";
        tooltip.textContent = "Copy";
        titleSpan.appendChild(tooltip);

        // Enable pointer events to intercept clicks
        titleSpan.style.pointerEvents = "auto";
        titleSpan.style.cursor = "pointer";

        titleSpan.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();

            const code = this.block.contentLines.join("\n");
            navigator.clipboard.writeText(code).then(() => {
                toast.success("Code copied to clipboard!", {
                    duration: 2000,
                    position: "bottom-right"
                });
            }).catch(err => {
                console.error("Failed to copy:", err);
                toast.error("Failed to copy code");
            });
        };

        header.appendChild(titleSpan);

        // Collapse toggle (only if there are content lines)
        if (this.block.hasContent) {
            header.appendChild(buildCollapseToggle(view, this.collapsed, this.collapseKey, label));
        }

        return header;
    }

    ignoreEvent(): boolean {
        return true;
    }
}
