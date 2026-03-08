import { WidgetType, EditorView } from "@codemirror/view";
import { StateEffect } from "@codemirror/state";
import { getCalloutType } from "../../../../constants/callout-types";
import { CalloutBlock } from "./callout-parser";
import { setCollapseState } from "./callout-state";

// ─── Lucide Icon SVG Map ──────────────────────────────────────────────────────
const LUCIDE_SVG_PATHS: Record<string, string> = {
    FileText: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    Info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    Flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    BookOpen: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
    AlertTriangle: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    ShieldAlert: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
    AlertCircle: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
    Skull: '<circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><path d="M8 20v2h8v-2"/><path d="m12.5 17-.5-1-.5 1h1z"/><path d="M16 20a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20"/>',
    CheckCircle2: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    XCircle: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
    ClipboardList: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
    Bug: '<path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/>',
    HelpCircle: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    FlaskConical: '<path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/><path d="M8.5 2h7"/><path d="M7 16.5h10"/>',
    Quote: '<path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 4 4 0 0 0 4-4V5a2 2 0 0 0-2-2z"/><path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 4 4 0 0 0 4-4V5a2 2 0 0 0-2-2z"/>',
};

const CALLOUT_ICON_MAP: Record<string, string> = {
    note: "FileText", info: "Info", tip: "Flame", abstract: "BookOpen",
    warning: "AlertTriangle", caution: "ShieldAlert", important: "AlertCircle",
    danger: "Skull", success: "CheckCircle2", failure: "XCircle",
    todo: "ClipboardList", bug: "Bug", question: "HelpCircle",
    example: "FlaskConical", quote: "Quote", cite: "Quote",
};

const CHEVRON_DOWN_PATH = '<path d="m6 9 6 6 6-6"/>';

export function createIconSVG(typeId: string): SVGSVGElement | null {
    const iconName = CALLOUT_ICON_MAP[typeId.toLowerCase()];
    const pathData = iconName ? LUCIDE_SVG_PATHS[iconName] : null;
    if (!pathData) return null;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "18");
    svg.setAttribute("height", "18");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.innerHTML = pathData;
    return svg;
}

export function createChevronSVG(): SVGSVGElement {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.innerHTML = CHEVRON_DOWN_PATH;
    return svg;
}

export const toggleCollapseEffect = StateEffect.define<null>();

export class CalloutHeaderWidget extends WidgetType {
    constructor(
        readonly block: CalloutBlock,
        readonly collapsed: boolean,
        readonly collapseKey: string,
    ) {
        super();
    }

    eq(other: CalloutHeaderWidget): boolean {
        return (
            this.block.type === other.block.type &&
            this.block.title === other.block.title &&
            this.collapsed === other.collapsed &&
            this.block.headerFrom === other.block.headerFrom &&
            this.block.hasContent === other.block.hasContent
        );
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
        const iconSpan = document.createElement("span");
        iconSpan.className = "cm-callout-icon";
        const svgIcon = createIconSVG(this.block.type);
        if (svgIcon) {
            iconSpan.appendChild(svgIcon);
        }
        header.appendChild(iconSpan);

        // Title
        const titleSpan = document.createElement("span");
        titleSpan.className = "cm-callout-title";
        titleSpan.textContent = label;
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
