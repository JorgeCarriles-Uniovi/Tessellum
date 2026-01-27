import {
    Decoration,
    DecorationSet,
    EditorView,
    ViewPlugin,
    ViewUpdate,
    WidgetType,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

// 1. The Visual Widget (Same as before)
class DividerWidget extends WidgetType {
    toDOM() {
        const div = document.createElement("div");
        div.className = "cm-divider-widget";
        return div;
    }
}

// 2. The Decoration Definition
// We create this once to reuse it
const dividerDecoration = Decoration.replace({
    widget: new DividerWidget(),
});

// 3. The Optimized Plugin
export const dividerPlugin = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
            this.decorations = this.buildDecorations(view);
        }

        update(update: ViewUpdate) {
            // Only rebuild if the document changed OR the user scrolled (viewport changed)
            if (update.docChanged || update.viewportChanged) {
                this.decorations = this.buildDecorations(update.view);
            }
        }

        buildDecorations(view: EditorView) {
            const builder = new RangeSetBuilder<Decoration>();
            const { state } = view;

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
                        builder.add(line.from, line.to, dividerDecoration);
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