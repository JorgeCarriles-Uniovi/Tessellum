import {
    Decoration,
    DecorationSet,
    EditorView,
    ViewPlugin,
    ViewUpdate,
    WidgetType,
} from "@codemirror/view";
import { syntaxTree, syntaxTreeAvailable } from "@codemirror/language";
import { Extension, RangeSetBuilder } from "@codemirror/state";
import { getCalloutLinePositions } from "./callout/callout-plugin";
import { getTableLinePositions } from "./table/table-plugin";

// Set of mark types we want to hide
const HIDDEN_MARKS = new Set([
    "HeaderMark",
    "EmphasisMark",
    "QuoteMark",
    "ListMark",
    "LinkMark",
    "URL",
    "ImageMark",
    "StrikethroughMark"
]);

/**
 * Widget to render a list marker (dot or number) in preview mode.
 */
class ListMarkWidget extends WidgetType {
    constructor(readonly content: string, readonly isOrdered: boolean) {
        super();
    }

    toDOM() {
        const span = document.createElement("span");
        span.className = "cm-list-marker-widget";
        if (this.isOrdered) {
            span.classList.add("cm-ordered-list-marker");
        } else {
            span.classList.add("cm-unordered-list-marker");
        }
        span.textContent = this.content;
        return span;
    }

    eq(other: ListMarkWidget) {
        return this.content === other.content && this.isOrdered === other.isOrdered;
    }
}

/**
 * Builds decorations to hide markdown syntax markers when not focused.
 */
function buildDecorations(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const selection = view.state.selection.main;

    // Gather callout line positions and types so we can skip hiding marks in terminal callouts.
    const calloutMap = getCalloutLinePositions(view);
    const tablePositions = getTableLinePositions(view);

    syntaxTree(view.state).iterate({
        enter: (node) => {
            const { from, to, name } = node;

            if (HIDDEN_MARKS.has(name)) {
                // Skip hiding markdown marks inside tables to prevent layout shifting
                const line = view.state.doc.lineAt(from);
                if (tablePositions.has(line.from)) {
                    return;
                }

                const parent = node.node.parent;

                if (parent) {
                    const calloutType = calloutMap.get(line.from);

                    // Skip hiding any mark inside a terminal callout
                    if (calloutType === "terminal") {
                        return;
                    }

                    // Skip QuoteMark nodes on lines owned by the callout plugin
                    if (name === "QuoteMark") {
                        if (calloutMap.has(line.from)) {
                            return;
                        }
                    }

                    // Skip LinkMark/URL nodes that aren't inside a standard Link or Image
                    if (
                        (name === "LinkMark" || name === "URL") &&
                        parent.name !== "Link" &&
                        parent.name !== "Image"
                    ) {
                        return;
                    }

                    // Check if cursor overlaps with the parent container
                    const cursorOverlaps =
                        selection.from <= parent.to && selection.to >= parent.from;

                    if (!cursorOverlaps) {
                        if (name === "ListMark") {
                            const markerText = view.state.doc.sliceString(from, to);
                            const isOrdered = /[0-9]/.test(markerText);
                            const displayContent = isOrdered ? markerText : "•";
                            builder.add(
                                from,
                                to,
                                Decoration.replace({
                                    widget: new ListMarkWidget(displayContent, isOrdered),
                                })
                            );
                        } else {
                            builder.add(from, to, Decoration.replace({}));
                        }
                    }
                }
            }
        },
    });

    return builder.finish();
}

// ─── CM6 ViewPlugin ───────────────────────────────────────────────────────────

const markdownLivePreviewPlugin = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet;
        private treeAvailable: boolean;

        constructor(view: EditorView) {
            this.treeAvailable = syntaxTreeAvailable(view.state);
            this.decorations = buildDecorations(view);
        }

        update(update: ViewUpdate) {
            const nowAvailable = syntaxTreeAvailable(update.state);
            const treeJustBecameReady = nowAvailable && !this.treeAvailable;
            this.treeAvailable = nowAvailable;

            if (
                update.docChanged ||
                update.viewportChanged ||
                update.selectionSet ||
                treeJustBecameReady
            ) {
                this.decorations = buildDecorations(update.view);
            }
        }
    },
    {
        decorations: (v) => v.decorations,
    }
);

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Creates a CM6 extension that hides markdown syntax markers (Live Preview).
 * Headers (#), emphasis (*\/_), quotes(>), list markers(-), links, and image
 * syntax are hidden when the cursor is not on the parent element.
 */
export function createMarkdownPreviewPlugin(): Extension {
    return markdownLivePreviewPlugin;
}