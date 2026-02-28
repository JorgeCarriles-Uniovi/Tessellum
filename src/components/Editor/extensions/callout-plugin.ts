import {
    Decoration,
    DecorationSet,
    EditorView,
    ViewPlugin,
    ViewUpdate,
    WidgetType,
} from "@codemirror/view";
import { RangeSetBuilder, StateEffect } from "@codemirror/state";
import { createElement } from "react";
import { createRoot } from "react-dom/client";

// StateEffect to signal a collapse toggle — forces plugin rebuild
const toggleCollapseEffect = StateEffect.define<null>();

import { getCalloutType } from "../../../constants/callout-types";

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
    type: string;           // e.g. "note", "warning"
    title: string;          // Custom title or type label
    foldChar: string;       // "+", "-", or "" (default open)
    headerFrom: number;     // doc position: start of header line
    headerTo: number;       // doc position: end of header line
    contentFrom: number;    // doc position: start of first content line
    contentTo: number;      // doc position: end of last content line
    contentLines: string[]; // Content text (with > prefix stripped)
    headerLineNumber: number;
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
            this.block.headerFrom === other.block.headerFrom
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

        // Icon
        const iconSpan = document.createElement("span");
        iconSpan.className = "cm-callout-icon";
        if (calloutType) {
            const root = createRoot(iconSpan);
            root.render(createElement(calloutType.icon, { size: 16 }));
        }
        header.appendChild(iconSpan);

        // Title
        const titleSpan = document.createElement("span");
        titleSpan.className = "cm-callout-title";
        titleSpan.textContent = label;
        header.appendChild(titleSpan);

        // Collapse toggle
        const toggle = document.createElement("span");
        toggle.className = "cm-callout-toggle";
        toggle.textContent = this.collapsed ? "▸" : "▾";
        toggle.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const newCollapsed = !this.collapsed;
            setCollapseState(this.collapseKey, newCollapsed);
            view.dispatch({
                effects: toggleCollapseEffect.of(null),
            });
        });
        header.appendChild(toggle);

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
                let contentFrom = line.to + 1;
                let contentTo = line.to;

                // Scan continuation lines
                let nextPos = line.to + 1;
                while (nextPos <= state.doc.length) {
                    const nextLine = state.doc.lineAt(nextPos);
                    const contMatch = nextLine.text.match(CALLOUT_CONTINUATION_RE);
                    if (contMatch) {
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
                });

                pos = contentTo + 1;
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
        const blockTo = block.contentLines.length > 0 ? block.contentTo : block.headerTo;

        // Resolve color for this block
        const calloutType = getCalloutType(block.type);
        const color = calloutType?.color || "#448aff";

        // Determine collapsed state
        const key = calloutKey(filePath, `${block.type}:${block.title}`, block.headerLineNumber);
        const defaultCollapsed = block.foldChar === "-";
        const collapsed = isCollapsed(key, defaultCollapsed);

        // If cursor is inside this block AND the callout is expanded,
        // show raw markdown — skip all decorations so the user can edit.
        // For collapsed callouts, ALWAYS render decorations so the
        // toggle button stays visible and the content stays hidden.
        if (!collapsed) {
            const cursorOverlaps = selection.from <= blockTo && selection.to >= blockFrom;
            if (cursorOverlaps) continue;
        }

        // 1. Add line decoration for the header's .cm-line container
        const headerLineClass = collapsed
            ? "cm-callout-header-line cm-callout-header-line-collapsed"
            : "cm-callout-header-line";
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

        // 3. Style content lines
        if (block.contentLines.length > 0 && block.contentFrom <= state.doc.length) {

            if (collapsed) {
                let linePos = block.contentFrom;
                for (let i = 0; i < block.contentLines.length; i++) {
                    if (linePos > state.doc.length) break;
                    const line = state.doc.lineAt(linePos);

                    // Mark the .cm-line wrapper so CSS can hide it entirely
                    builder.add(
                        line.from,
                        line.from,
                        Decoration.line({ class: "cm-callout-collapsed-line" })
                    );

                    linePos = line.to + 1;
                }
            } else {
                let linePos = block.contentFrom;
                const numLines = block.contentLines.length;

                for (let i = 0; i < numLines; i++) {
                    if (linePos > state.doc.length) break;
                    const line = state.doc.lineAt(linePos);

                    if (numLines === 1) {
                        builder.add(line.from, line.from, calloutLineDeco(color, "cm-callout-first-line cm-callout-last-line"));
                    } else if (i === 0) {
                        builder.add(line.from, line.from, calloutLineDeco(color, "cm-callout-first-line"));
                    } else if (i === numLines - 1) {
                        builder.add(line.from, line.from, calloutLineDeco(color, "cm-callout-last-line"));
                    } else {
                        builder.add(line.from, line.from, calloutLineDeco(color));
                    }

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
