import {
    Decoration,
    DecorationSet,
    EditorView,
    ViewPlugin,
    ViewUpdate,
    WidgetType,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

// 1. The Visual Widget
class DividerWidget extends WidgetType {
    constructor(readonly start: number, readonly end: number) {
        super();
    }

    eq(other: DividerWidget) {
        return this.start === other.start && this.end === other.end;
    }

    toDOM(view: EditorView) {
        const div = document.createElement("div");
        div.className = "cm-divider-widget";

        // Add click listener to select the divider line
        div.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();

            view.dispatch({
                selection: { anchor: this.start, head: this.end }
            });
            view.focus();
        });

        return div;
    }
}

// 3. The Optimized Plugin
export const dividerPlugin = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
            this.decorations = this.buildDecorations(view);
        }

        update(update: ViewUpdate) {
            // Only rebuild if the document changed OR the user scrolled (viewport changed)
            if (update.docChanged || update.viewportChanged || update.selectionSet) {
                this.decorations = this.buildDecorations(update.view);
            }
        }

        buildDecorations(view: EditorView) {
            const builder = new RangeSetBuilder<Decoration>();
            const { state } = view;
            const selection = state.selection.main;

            // Optimization: Only loop through the visible lines (Viewport)
            // This makes performance independent of total file size.
            for (const { from, to } of view.visibleRanges) {

                // Iterate line-by-line within the visible range
                // 'state.doc.iterLines' is efficient but we need positions.
                // Using lineBlockAt allows precise line handling.

                let pos = from;
                while (pos <= to) {
                    const line = state.doc.lineAt(pos);

                    // Super fast check: No Regex needed
                    if (line.text === '---') {
                        // Check if cursor overlaps with this line
                        const cursorOverlaps = selection.from >= line.from && selection.to <= line.to;

                        // Only replace with widget if cursor is NOT on the line
                        if (!cursorOverlaps) {
                            builder.add(line.from, line.to, Decoration.replace({
                                widget: new DividerWidget(line.from, line.to),
                            }));
                        }
                    }

                    // Move to next line
                    pos = line.to + 1;
                }
            }

            return builder.finish();
        }
    },
    {
        decorations: (v) => v.decorations,
    }
);