import {
    Decoration,
    DecorationSet,
    EditorView,
    ViewPlugin,
    ViewUpdate,
    WidgetType,
} from "@codemirror/view";
import { Extension, RangeSetBuilder } from "@codemirror/state";

// ─── Widget ───────────────────────────────────────────────────────────────────

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

        div.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            view.dispatch({
                selection: { anchor: this.start, head: this.end },
            });
            view.focus();
        });

        return div;
    }
}

// ─── CM6 ViewPlugin ───────────────────────────────────────────────────────────

const dividerViewPlugin = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
            this.decorations = this.buildDecorations(view);
        }

        update(update: ViewUpdate) {
            if (update.docChanged || update.viewportChanged || update.selectionSet) {
                this.decorations = this.buildDecorations(update.view);
            }
        }

        buildDecorations(view: EditorView) {
            const builder = new RangeSetBuilder<Decoration>();
            const { state } = view;
            const selection = state.selection.main;

            for (const { from, to } of view.visibleRanges) {
                let pos = from;
                while (pos <= to) {
                    const line = state.doc.lineAt(pos);
                    if (line.text === "---") {
                        const cursorOverlaps =
                            selection.from >= line.from && selection.to <= line.to;
                        if (!cursorOverlaps) {
                            builder.add(
                                line.from,
                                line.to,
                                Decoration.replace({
                                    widget: new DividerWidget(line.from, line.to),
                                })
                            );
                        }
                    }
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

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Creates a CM6 extension that renders `---` as a horizontal divider widget.
 * Hides the raw syntax when the cursor is not on the line.
 */
export function createDividerPlugin(): Extension {
    return dividerViewPlugin;
}