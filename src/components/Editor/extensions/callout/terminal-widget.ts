import { WidgetType, EditorView } from "@codemirror/view";
import { CalloutBlock } from "./callout-parser";
import { setCollapseState } from "./callout-state";
import { createIconSVG, createChevronSVG, toggleCollapseEffect } from "./callout-widget";
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
        return (
            this.block.type === other.block.type &&
            this.block.title === other.block.title &&
            this.collapsed === other.collapsed &&
            this.block.headerFrom === other.block.headerFrom &&
            this.block.hasContent === other.block.hasContent
        );
    }

    toDOM(view: EditorView): HTMLElement {
        const label = this.block.title || "terminal";

        // Header container
        const header = document.createElement("div");
        header.className = "cm-callout-header cm-terminal-header";

        // Use a generic color base in case we need it, though terminal CSS overrides this
        header.style.setProperty("--callout-color", "#e1e4e8");

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
        const iconSpan = document.createElement("span");
        iconSpan.className = "cm-callout-icon";
        const svgIcon = createIconSVG(this.block.type);
        if (svgIcon) {
            iconSpan.appendChild(svgIcon);
        }

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
            const toggle = document.createElement("span");
            toggle.className = this.collapsed
                ? "cm-callout-toggle cm-callout-toggle-collapsed"
                : "cm-callout-toggle";

            // SVG chevron-down (CSS rotates it -90deg when collapsed)
            const chevron = createChevronSVG();
            toggle.appendChild(chevron);

            // Accessibility
            toggle.setAttribute("role", "button");
            toggle.setAttribute("aria-expanded", String(!this.collapsed));
            toggle.setAttribute("aria-label", `Toggle ${label} callout`);
            toggle.setAttribute("tabindex", "0");

            const doToggle = (e: Event) => {
                e.preventDefault();
                e.stopPropagation();
                const newCollapsed = !this.collapsed;
                setCollapseState(this.collapseKey, newCollapsed);
                view.dispatch({
                    effects: toggleCollapseEffect.of(null),
                });
            };

            toggle.addEventListener("mousedown", doToggle);
            toggle.addEventListener("keydown", (e: KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                    doToggle(e);
                }
            });

            header.appendChild(toggle);
        }

        return header;
    }

    ignoreEvent(): boolean {
        return true;
    }
}
