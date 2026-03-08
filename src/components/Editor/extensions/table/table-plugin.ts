import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { Extension, RangeSetBuilder } from "@codemirror/state";
import { parseTables } from "./table-parser";
import { TableWidget } from "./table-widget";
import { tableKeymap } from "./table-navigation";

const tableViewPlugin = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
            this.decorations = this.buildDecorations(view);
        }

        update(update: ViewUpdate) {
            if (
                update.docChanged ||
                update.viewportChanged ||
                update.selectionSet
            ) {
                this.decorations = this.buildDecorations(update.view);
            }
        }

        buildDecorations(view: EditorView): DecorationSet {
            const builder = new RangeSetBuilder<Decoration>();
            const { state } = view;
            const selection = state.selection.main;

            for (const { from, to } of view.visibleRanges) {
                const tables = parseTables(state.doc as any, from, to);

                for (const table of tables) {
                    // Check if cursor is inside the table block
                    const cursorInside =
                        selection.from >= table.from &&
                        selection.from <= table.to;

                    if (!cursorInside) {
                        const rawText = state.doc.sliceString(table.from, table.to);
                        const tableWidget = new TableWidget(table, rawText);

                        const firstLine = state.doc.lineAt(table.from);
                        builder.add(
                            firstLine.from,
                            firstLine.to,
                            Decoration.replace({
                                widget: tableWidget,
                            })
                        );

                        // Hide all the *other* raw text lines of the table
                        let pos = firstLine.to + 1;
                        while (pos <= table.to) {
                            const line = state.doc.lineAt(pos);
                            builder.add(
                                line.from,
                                line.from,
                                Decoration.line({
                                    class: "cm-table-hidden-line"
                                })
                            );
                            pos = line.to + 1;
                        }
                    }
                }
            }

            return builder.finish();
        }
    },
    {
        decorations: (v) => v.decorations,
    }
);

/**
 * Returns a Set of document positions (line.from) that belong to table blocks.
 * Other plugins can use this to avoid applying conflicting decorations.
 */
export function getTableLinePositions(view: EditorView): Set<number> {
    const positions = new Set<number>();
    const { state } = view;

    for (const { from, to } of view.visibleRanges) {
        const tables = parseTables(state.doc as any, from, to);
        for (const table of tables) {
            let pos = table.from;
            while (pos <= table.to) {
                const line = state.doc.lineAt(pos);
                positions.add(line.from);
                pos = line.to + 1;
            }
        }
    }

    return positions;
}

export function createTablePlugin(): Extension {
    return [tableViewPlugin, tableKeymap];
}
