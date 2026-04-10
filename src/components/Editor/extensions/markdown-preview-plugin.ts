import {
    Decoration,
    DecorationSet,
    EditorView,
    ViewPlugin,
    ViewUpdate,
    WidgetType,
} from "@codemirror/view";
import { syntaxTree, syntaxTreeAvailable } from "@codemirror/language";
import { Extension, Facet, RangeSetBuilder } from "@codemirror/state";
import { getCalloutLinePositions } from "./callout/callout-plugin";
import { CALLOUT_HEADER_RE } from "./callout/callout-parser";
import { getTableLinePositions } from "./table/table-plugin";
import { findTaskListItems } from "./task-list/task-list-parser";

// Set of mark types we want to hide
const HIDDEN_MARKS = new Set([
    "HeaderMark",
    "EmphasisMark",
    "QuoteMark",
    "ListMark",
    "LinkMark",
    "URL",
    "ImageMark",
    "StrikethroughMark",
    "CodeMark",
]);

export const markdownPreviewForceHideFacet = Facet.define<boolean, boolean>({
    combine: (values) => values.some(Boolean),
});

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
function buildDecorations(view: EditorView, forceHide: boolean): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const selection = view.state.selection.main;
    const selectionLine = view.state.doc.lineAt(selection.from);
    const taskListLinePositions = new Set(
        findTaskListItems(view.state.doc.toString()).map((item) => item.lineStart)
    );

    // Gather callout line positions and types so we can skip hiding marks in terminal callouts.
    const calloutMap = getCalloutLinePositions(view);
    const tablePositions = getTableLinePositions(view);

    const shouldSkipForTable = (lineFrom: number) => tablePositions.has(lineFrom);
    const isTaskListLine = (lineFrom: number) => taskListLinePositions.has(lineFrom);
    const isInTerminalCallout = (lineFrom: number) => calloutMap.get(lineFrom) === "terminal";
    const isCalloutOwnedLine = (lineFrom: number) => calloutMap.has(lineFrom);
    const isLinkLike = (nodeName: string) => nodeName === "LinkMark" || nodeName === "URL";
    const isLinkParent = (parentName: string) =>
        parentName === "Link" || parentName === "Image";
    const cursorOverlapsParent = (parentFrom: number, parentTo: number) =>
        selection.from <= parentTo && selection.to >= parentFrom;
    const isCursorLine = (parentFrom: number) =>
        selectionLine.from <= parentFrom && selectionLine.to >= parentFrom;
    const addListDecoration = (from: number, to: number) => {
        const markerText = view.state.doc.sliceString(from, to);
        const isOrdered = /[0-9]/.test(markerText);
        const displayContent = isOrdered ? markerText : "-";
        builder.add(
            from,
            to,
            Decoration.replace({
                widget: new ListMarkWidget(displayContent, isOrdered),
            })
        );
    };

    syntaxTree(view.state).iterate({
        enter: (node) => {
            const { from, to, name } = node;

            if (!HIDDEN_MARKS.has(name)) {
                return;
            }

            const line = view.state.doc.lineAt(from);
            if (forceHide && CALLOUT_HEADER_RE.test(line.text)) {
                return;
            }
            if (!forceHide) {
                // Skip hiding markdown marks inside tables to prevent layout shifting
                if (shouldSkipForTable(line.from)) {
                    return;
                }
            }

            if (!forceHide) {
                // If cursor is on an embed line, keep raw syntax visible
                if (
                    line.from === selectionLine.from &&
                    /!\[\[[^\]]+\]\]|!\[[^\]]*\]\([^)]+\)/.test(line.text)
                ) {
                    return;
                }
            }

            const parent = node.node.parent;
            if (!parent) {
                return;
            }

            if (!forceHide) {
                // Skip hiding any mark inside a terminal callout
                if (isInTerminalCallout(line.from)) {
                    return;
                }

                // Skip QuoteMark nodes on lines owned by the callout plugin
                if (name === "QuoteMark" && isCalloutOwnedLine(line.from)) {
                    return;
                }

                // Skip LinkMark/URL nodes that aren't inside a standard Link or Image
                if (isLinkLike(name) && !isLinkParent(parent.name)) {
                    return;
                }
            }

            if (!forceHide) {
                // If cursor is on the same line as an image, show full raw syntax
                if (parent.name === "Image" && isCursorLine(parent.from)) {
                    return;
                }

                // Check if cursor overlaps with the parent container
                if (cursorOverlapsParent(parent.from, parent.to)) {
                    return;
                }
            }

            if (name === "ListMark") {
                if (isTaskListLine(line.from)) {
                    return;
                }

                addListDecoration(from, to);
                return;
            }

            builder.add(from, to, Decoration.replace({}));
        },
    });

    return builder.finish();
}

// ------ CM6 ViewPlugin ------------------------------------------

const markdownLivePreviewPlugin = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet;
        private treeAvailable: boolean;
        private forceHide: boolean;

        constructor(view: EditorView) {
            this.treeAvailable = syntaxTreeAvailable(view.state);
            this.forceHide = view.state.facet(markdownPreviewForceHideFacet);
            this.decorations = buildDecorations(view, this.forceHide);
        }

        update(update: ViewUpdate) {
            const nowAvailable = syntaxTreeAvailable(update.state);
            const treeJustBecameReady = nowAvailable && !this.treeAvailable;
            this.treeAvailable = nowAvailable;
            const nextForceHide = update.state.facet(markdownPreviewForceHideFacet);
            const forceHideChanged = nextForceHide !== this.forceHide;
            if (forceHideChanged) {
                this.forceHide = nextForceHide;
            }

            if (
                update.docChanged ||
                update.viewportChanged ||
                update.selectionSet ||
                treeJustBecameReady ||
                forceHideChanged
            ) {
                this.decorations = buildDecorations(update.view, this.forceHide);
            }
        }
    },
    {
        decorations: (v) => v.decorations,
    }
);

// ------ Public API ------------------------------------------

/**
 * Creates a CM6 extension that hides markdown syntax markers (Live Preview).
 * Headers (#), emphasis (*\/_), quotes(>), list markers(-), links, and image
 * syntax are hidden when the cursor is not on the parent element.
 */
export function createMarkdownPreviewPlugin(): Extension {
    return [markdownPreviewForceHideFacet.of(false), markdownLivePreviewPlugin];
}
