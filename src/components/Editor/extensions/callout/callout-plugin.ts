import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { getCalloutType } from "../../../../constants/callout-types";
import { parseCalloutBlocks, CALLOUT_HEADER_RE, CALLOUT_CONTINUATION_RE } from "./callout-parser";
import { CalloutHeaderWidget, toggleCollapseEffect } from "./callout-widget";
import { isCollapsed, calloutKey } from "./callout-state";

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
