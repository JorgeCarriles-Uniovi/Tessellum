import {
    Decoration,
    DecorationSet,
    EditorView,
    ViewPlugin,
    ViewUpdate,
    WidgetType,
} from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder } from "@codemirror/state";

// Widget to replace syntax markers (zero width)
class HiddenWidget extends WidgetType {
    toDOM() {
        const span = document.createElement("span");
        span.style.display = "none";
        return span;
    }
}

/**
 * Builds decorations to hide markdown syntax markers when not focused.
 */
function buildDecorations(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const selection = view.state.selection.main;

    // We need to iterate over the document in order for RangeSetBuilder

    syntaxTree(view.state).iterate({
        enter: (node) => {
            const { from, to, name } = node;

            // Define which mark types we want to hide
            const marks = [
                "HeaderMark",
                "EmphasisMark",
                "QuoteMark",
                "ListMark",
                "LinkMark",
                "URL",
                "ImageMark"
            ];

            if (marks.includes(name)) {
                // Determine the parent context
                // Mark nodes are children of their respective containers (ATXHeading1, StrongEmphasis, Link, Image, etc.)
                const parent = node.node.parent;

                if (parent) {
                    // Check if cursor overlaps with the parent container
                    // "Inside" means overlap: cursor range touches or is within parent range
                    // We check if selection overlaps [parent.from, parent.to]

                    const cursorOverlaps = (selection.from <= parent.to && selection.to >= parent.from);

                    if (!cursorOverlaps) {
                        // Hide the mark
                        builder.add(
                            from,
                            to,
                            Decoration.replace({
                                widget: new HiddenWidget(),
                            })
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
 */
export const markdownLivePreview = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
            this.decorations = buildDecorations(view);
        }

        update(update: ViewUpdate) {
            if (update.docChanged || update.viewportChanged || update.selectionSet) {
                this.decorations = buildDecorations(update.view);
            }
        }
    },
    {
        decorations: (v) => v.decorations,
    }
);
