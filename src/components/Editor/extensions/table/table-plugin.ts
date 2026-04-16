import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { Extension, RangeSetBuilder } from "@codemirror/state";
import { markdownPreviewForceHideFacet } from "../markdown-preview-plugin";
import { parseTables } from "./table-parser";
import { TableHeaderWidget, TableSeparatorWidget, TableDataWidget } from "./table-widget";
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
            const forceHide = state.facet(markdownPreviewForceHideFacet);
            const tables = parseTables(state.doc as any, 0, state.doc.length);

            for (const table of tables) {
                const cursorInside =
                    selection.from >= table.from &&
                    selection.from <= table.to;

                if (cursorInside && !forceHide) {
                    continue;
                }

                let pos = table.from;
                let lineIndex = 0;

                let dataRowIndex = 0;
                while (pos <= table.to) {
                    const line = state.doc.lineAt(pos);
                    const rawText = line.text;

                    let widget;
                    if (lineIndex === 0) {
                        widget = new TableHeaderWidget(rawText, table.alignments, table.columnCount, line.from);
                    } else if (lineIndex === 1) {
                        widget = new TableSeparatorWidget(rawText, table.alignments, table.columnCount, line.from);
                    } else {
                        const isLast = (line.to >= table.to);
                        widget = new TableDataWidget(rawText, table.alignments, table.columnCount, line.from, isLast, dataRowIndex);
                        dataRowIndex++;
                    }

                    builder.add(
                        line.from,
                        line.to,
                        Decoration.replace({ widget })
                    );

                    pos = line.to + 1;
                    lineIndex++;
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

    const tables = parseTables(state.doc as any, 0, state.doc.length);
    for (const table of tables) {
        let pos = table.from;
        while (pos <= table.to) {
            const line = state.doc.lineAt(pos);
            positions.add(line.from);
            pos = line.to + 1;
        }
    }

    return positions;
}

export function createTablePlugin(): Extension {
    return [tableViewPlugin, tableKeymap];
}
