import { WidgetType, EditorView } from "@codemirror/view";
import { getCalloutType } from "../../../../constants/callout-types";
import { CalloutBlock } from "./callout-parser";
import { baseHeaderEq, buildCollapseToggle, buildIconSpan } from "./callout-header-base";

export class CalloutHeaderWidget extends WidgetType {
    constructor(
        readonly block: CalloutBlock,
        readonly collapsed: boolean,
        readonly collapseKey: string,
    ) {
        super();
    }

    eq(other: CalloutHeaderWidget): boolean {
        return baseHeaderEq(this, other);
    }

    toDOM(view: EditorView): HTMLElement {
        const calloutType = getCalloutType(this.block.type);
        const color = calloutType?.color || "#448aff";
        const label = this.block.title || calloutType?.label || this.block.type;

        // Header container
        const header = document.createElement("div");
        header.className = "cm-callout-header";
        header.style.setProperty("--callout-color", color);

        // Icon (pure SVG, no React)
        const iconSpan = buildIconSpan(this.block.type);
        header.appendChild(iconSpan);

        // Title
        const titleSpan = document.createElement("span");
        titleSpan.className = "cm-callout-title";
        titleSpan.textContent = label;
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
