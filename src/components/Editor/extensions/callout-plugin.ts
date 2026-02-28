import {
    Decoration,
    DecorationSet,
    EditorView,
    ViewPlugin,
    ViewUpdate,
    WidgetType,
} from "@codemirror/view";
import { RangeSetBuilder, StateEffect } from "@codemirror/state";

import { getCalloutType } from "../../../constants/callout-types";

// ─── Lucide Icon SVG Map ──────────────────────────────────────────────────────
// Static SVG paths for each Lucide icon used by callout types.
// This avoids mounting a full React root per widget, eliminating the memory
// leak that occurred with createRoot on every decoration rebuild.

const LUCIDE_SVG_PATHS: Record<string, string> = {
    FileText:
        '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    Info:
        '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    Flame:
        '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    BookOpen:
        '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
    AlertTriangle:
        '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    ShieldAlert:
        '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
    AlertCircle:
        '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
    Skull:
        '<circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><path d="M8 20v2h8v-2"/><path d="m12.5 17-.5-1-.5 1h1z"/><path d="M16 20a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20"/>',
    CheckCircle2:
        '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    XCircle:
        '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
    ClipboardList:
        '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
    Bug:
        '<path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/>',
    HelpCircle:
        '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    FlaskConical:
        '<path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/><path d="M8.5 2h7"/><path d="M7 16.5h10"/>',
    Quote:
        '<path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 4 4 0 0 0 4-4V5a2 2 0 0 0-2-2z"/><path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 4 4 0 0 0 4-4V5a2 2 0 0 0-2-2z"/>',
};

/** Map from callout type id -> Lucide icon component name. */
const CALLOUT_ICON_MAP: Record<string, string> = {
    note: "FileText",
    info: "Info",
    tip: "Flame",
    abstract: "BookOpen",
    warning: "AlertTriangle",
    caution: "ShieldAlert",
    important: "AlertCircle",
    danger: "Skull",
    success: "CheckCircle2",
    failure: "XCircle",
    todo: "ClipboardList",
    bug: "Bug",
    question: "HelpCircle",
    example: "FlaskConical",
    quote: "Quote",
    cite: "Quote",
};

/** Create an inline SVG element for a callout icon, without React. */
function createIconSVG(typeId: string): SVGSVGElement | null {
    const iconName = CALLOUT_ICON_MAP[typeId.toLowerCase()];
    const pathData = iconName ? LUCIDE_SVG_PATHS[iconName] : null;
    if (!pathData) return null;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.innerHTML = pathData;
    return svg;
}

// ─── StateEffect to signal a collapse toggle ─────────────────────────────────

const toggleCollapseEffect = StateEffect.define<null>();

// ─── Callout Regex ────────────────────────────────────────────────────────────

// Matches: > [!type] Optional title   or  > [!type]+/-  Optional title
const CALLOUT_HEADER_RE = /^>\s*\[!(\w+)\]([+-])?\s*(.*)?$/;
// Matches continuation lines: > content  or just >
const CALLOUT_CONTINUATION_RE = /^>\s?(.*)$/;

// ─── Collapse State Persistence ───────────────────────────────────────────────

const STORAGE_KEY = "tessellum-callout-collapse-state";

function getCollapseStore(): Record<string, boolean> {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
        return {};
    }
}

function setCollapseState(key: string, collapsed: boolean): void {
    const store = getCollapseStore();
    store[key] = collapsed;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function isCollapsed(key: string, defaultCollapsed: boolean): boolean {
    const store = getCollapseStore();
    if (key in store) return store[key];
    return defaultCollapsed;
}

/** Build a stable key for a callout using its content hash. */
function calloutKey(filePath: string, headerText: string, lineOffset: number): string {
    return `${filePath}::${lineOffset}::${headerText}`;
}

// ─── Parsed Callout Block ─────────────────────────────────────────────────────

interface CalloutBlock {
    type: string;              // e.g. "note", "warning"
    title: string;             // Custom title or type label
    foldChar: string;          // "+", "-", or "" (default open)
    headerFrom: number;        // doc position: start of header line
    headerTo: number;          // doc position: end of header line
    contentFrom: number;       // doc position: start of first content line (-1 if none)
    contentTo: number;         // doc position: end of last content line (-1 if none)
    contentLines: string[];    // Content text (with > prefix stripped)
    headerLineNumber: number;
    hasContent: boolean;       // Whether there are continuation lines
}

// ─── Callout Header Widget ────────────────────────────────────────────────────

class CalloutHeaderWidget extends WidgetType {
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
            toggle.className = "cm-callout-toggle";
            toggle.textContent = this.collapsed ? "\u25B8" : "\u25BE";

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

// ─── Callout Block Parser ─────────────────────────────────────────────────────

function parseCalloutBlocks(view: EditorView): CalloutBlock[] {
    const { state } = view;
    const blocks: CalloutBlock[] = [];

    for (const { from, to } of view.visibleRanges) {
        let pos = from;

        while (pos <= to) {
            const line = state.doc.lineAt(pos);
            const headerMatch = line.text.match(CALLOUT_HEADER_RE);

            if (headerMatch) {
                const [, type, foldChar, rawTitle] = headerMatch;
                const calloutType = getCalloutType(type);
                const title = rawTitle?.trim() || calloutType?.label || type;
                const contentLines: string[] = [];
                let contentFrom = -1;
                let contentTo = -1;

                // Scan continuation lines
                let nextPos = line.to + 1;
                while (nextPos <= state.doc.length) {
                    const nextLine = state.doc.lineAt(nextPos);
                    const contMatch = nextLine.text.match(CALLOUT_CONTINUATION_RE);
                    if (contMatch) {
                        if (contentFrom === -1) contentFrom = nextLine.from;
                        contentLines.push(contMatch[1]); // stripped content
                        contentTo = nextLine.to;
                        nextPos = nextLine.to + 1;
                    } else {
                        break;
                    }
                }

                blocks.push({
                    type: type.toLowerCase(),
                    title,
                    foldChar: foldChar || "",
                    headerFrom: line.from,
                    headerTo: line.to,
                    contentFrom,
                    contentTo,
                    contentLines,
                    headerLineNumber: line.number,
                    hasContent: contentLines.length > 0,
                });

                pos = contentTo !== -1 ? contentTo + 1 : line.to + 1;
            } else {
                pos = line.to + 1;
            }
        }
    }

    return blocks;
}

// ─── Line Decoration Factories ────────────────────────────────────────────────

function calloutLineDeco(color: string, extraClasses: string = ""): Decoration {
    const cls = `cm-callout-line${extraClasses ? ` ${extraClasses}` : ""}`;
    return Decoration.line({
        class: cls,
        attributes: { style: `--callout-color: ${color}` },
    });
}

// ─── Build Decorations ───────────────────────────────────────────────────────

function buildDecorations(view: EditorView, filePath: string): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const blocks = parseCalloutBlocks(view);
    const state = view.state;
    const selection = state.selection.main;

    for (const block of blocks) {
        // Determine the full extent of the callout block
        const blockFrom = block.headerFrom;
        const blockTo = block.hasContent ? block.contentTo : block.headerTo;

        // Resolve color for this block
        const calloutType = getCalloutType(block.type);
        const color = calloutType?.color || "#448aff";

        // Determine collapsed state
        const key = calloutKey(filePath, `${block.type}:${block.title}`, block.headerLineNumber);
        const defaultCollapsed = block.foldChar === "-";
        const collapsed = isCollapsed(key, defaultCollapsed);

        // If cursor is inside this block AND the callout is expanded,
        // show raw markdown so the user can edit.
        // For collapsed callouts, ALWAYS render decorations so the
        // toggle button stays visible and the content stays hidden.
        if (!collapsed) {
            const cursorOverlaps = selection.from <= blockTo && selection.to >= blockFrom;
            if (cursorOverlaps) continue;
        }

        // Determine header-line CSS class
        let headerLineClass = "cm-callout-header-line";
        if (collapsed) {
            headerLineClass += " cm-callout-header-line-collapsed";
        }
        if (!block.hasContent) {
            headerLineClass += " cm-callout-header-line-solo";
        }

        // 1. Line decoration for the header's .cm-line container
        builder.add(
            block.headerFrom,
            block.headerFrom,
            Decoration.line({
                class: headerLineClass,
                attributes: { style: `--callout-color: ${color}` },
            })
        );

        // 2. Replace header line content with widget
        const headerWidget = new CalloutHeaderWidget(block, collapsed, key);
        builder.add(
            block.headerFrom,
            block.headerTo,
            Decoration.replace({ widget: headerWidget })
        );

        // 3. Style content lines (only if there are any)
        if (block.hasContent && block.contentFrom !== -1) {
            if (collapsed) {
                // Mark every content line so CSS can fully hide it
                let linePos = block.contentFrom;
                for (let i = 0; i < block.contentLines.length; i++) {
                    if (linePos > state.doc.length) break;
                    const line = state.doc.lineAt(linePos);
                    builder.add(
                        line.from,
                        line.from,
                        Decoration.line({
                            class: "cm-callout-collapsed-line",
                            attributes: { style: `--callout-color: ${color}` },
                        })
                    );
                    linePos = line.to + 1;
                }
            } else {
                // Expanded: style each content line with the callout tint
                let linePos = block.contentFrom;
                const numLines = block.contentLines.length;

                for (let i = 0; i < numLines; i++) {
                    if (linePos > state.doc.length) break;
                    const line = state.doc.lineAt(linePos);

                    // Determine positional class
                    let posClass = "";
                    if (numLines === 1) {
                        posClass = "cm-callout-first-line cm-callout-last-line";
                    } else if (i === 0) {
                        posClass = "cm-callout-first-line";
                    } else if (i === numLines - 1) {
                        posClass = "cm-callout-last-line";
                    }

                    builder.add(line.from, line.from, calloutLineDeco(color, posClass));

                    // Hide the "> " prefix
                    const prefixMatch = line.text.match(/^>\s?/);
                    if (prefixMatch) {
                        builder.add(
                            line.from,
                            line.from + prefixMatch[0].length,
                            Decoration.replace({})
                        );
                    }

                    linePos = line.to + 1;
                }
            }
        }
    }

    return builder.finish();
}

// ─── Exported Helpers for Other Plugins ───────────────────────────────────────

/**
 * Returns a Set of document positions (line.from) that belong to callout blocks.
 * Other plugins (e.g. markdown-preview-plugin) can use this to avoid applying
 * conflicting decorations on callout lines.
 */
export function getCalloutLinePositions(view: EditorView): Set<number> {
    const positions = new Set<number>();
    const { state } = view;

    for (const { from, to } of view.visibleRanges) {
        let pos = from;
        while (pos <= to) {
            const line = state.doc.lineAt(pos);
            const headerMatch = line.text.match(CALLOUT_HEADER_RE);

            if (headerMatch) {
                positions.add(line.from);
                // Scan continuation lines
                let nextPos = line.to + 1;
                while (nextPos <= state.doc.length) {
                    const nextLine = state.doc.lineAt(nextPos);
                    if (nextLine.text.match(CALLOUT_CONTINUATION_RE)) {
                        positions.add(nextLine.from);
                        nextPos = nextLine.to + 1;
                    } else {
                        break;
                    }
                }
                pos = nextPos;
            } else {
                pos = line.to + 1;
            }
        }
    }

    return positions;
}

// ─── Plugin Export ─────────────────────────────────────────────────────────────

/** Create the callout plugin. Pass filePath for collapse state persistence. */
export function createCalloutPlugin(filePath: string) {
    return ViewPlugin.fromClass(
        class {
            decorations: DecorationSet;

            constructor(view: EditorView) {
                this.decorations = buildDecorations(view, filePath);
            }

            update(update: ViewUpdate) {
                const hasCollapseToggle = update.transactions.some(
                    (tr) => tr.effects.some((e) => e.is(toggleCollapseEffect))
                );
                if (
                    update.docChanged ||
                    update.viewportChanged ||
                    update.selectionSet ||
                    hasCollapseToggle
                ) {
                    this.decorations = buildDecorations(update.view, filePath);
                }
            }
        },
        {
            decorations: (v) => v.decorations,
        }
    );
}
