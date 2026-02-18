import {
    Decoration,
    DecorationSet,
    EditorView,
    ViewPlugin,
    ViewUpdate,
} from "@codemirror/view";
import { syntaxTree, syntaxTreeAvailable } from "@codemirror/language";
import { RangeSetBuilder } from "@codemirror/state";

// Set of mark types we want to hide
const HIDDEN_MARKS = new Set([
    "HeaderMark",
    "EmphasisMark",
    "QuoteMark",
    "ListMark",
    "LinkMark",
    "URL",
    "ImageMark"
]);

/**
 * Builds decorations to hide markdown syntax markers when not focused.
 */
function buildDecorations(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const selection = view.state.selection.main;

    syntaxTree(view.state).iterate({
        enter: (node) => {
            const { from, to, name } = node;

            if (HIDDEN_MARKS.has(name)) {
                const parent = node.node.parent;

                if (parent) {
                    // Skip LinkMark/URL nodes that aren't inside a standard Link or Image
                    // This avoids conflicting with the wikilink plugin on [[...]] syntax
                    if ((name === "LinkMark" || name === "URL") &&
                        parent.name !== "Link" && parent.name !== "Image") {
                        return;
                    }

                    // Check if cursor overlaps with the parent container
                    const cursorOverlaps = (selection.from <= parent.to && selection.to >= parent.from);

                    if (!cursorOverlaps) {
                        builder.add(
                            from,
                            to,
                            Decoration.replace({})
                        );
                    }
                }
            }
        },
    });

    return builder.finish();
}

/**
 * Plugin to hide markdown syntax markers (Live Preview behavior).
 *
 * Rebuilds decorations when:
 * - The document changes
 * - The viewport changes (scrolling)
 * - The selection changes (cursor movement)
 * - The syntax tree finishes background parsing (critical for large files)
 */
export const markdownLivePreview = ViewPlugin.fromClass(
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
