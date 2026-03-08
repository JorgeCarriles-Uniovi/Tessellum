import { EditorView, WidgetType } from "@codemirror/view";
import { TableBlock, splitRow, parseInlineMarkdown } from "./table-parser";

export class TableWidget extends WidgetType {
    constructor(
        readonly block: TableBlock,
        readonly rawText: string,
    ) {
        super();
    }

    eq(other: TableWidget): boolean {
        return (
            this.block.from === other.block.from &&
            this.block.to === other.block.to &&
            this.rawText === other.rawText
        );
    }

    toDOM(view: EditorView): HTMLElement {
        const wrapper = document.createElement("div");
        wrapper.className = "cm-table-widget";

        const table = document.createElement("table");

        // Header
        const thead = document.createElement("thead");
        const headerTr = document.createElement("tr");
        const headerCells = splitRow(this.block.headerRow);
        headerCells.forEach((cell, i) => {
            const th = document.createElement("th");
            th.appendChild(parseInlineMarkdown(cell));
            th.style.textAlign = this.block.alignments[i] || "left";
            headerTr.appendChild(th);
        });
        thead.appendChild(headerTr);
        table.appendChild(thead);

        // Body
        if (this.block.dataRows.length > 0) {
            const tbody = document.createElement("tbody");
            this.block.dataRows.forEach((row) => {
                const tr = document.createElement("tr");
                const cells = splitRow(row);
                cells.forEach((cell, i) => {
                    const td = document.createElement("td");
                    td.appendChild(parseInlineMarkdown(cell));
                    td.style.textAlign = this.block.alignments[i] || "left";
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
        }

        wrapper.appendChild(table);

        // Click to focus into raw source
        wrapper.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            view.dispatch({
                selection: { anchor: this.block.from },
            });
            view.focus();
        });

        return wrapper;
    }

    ignoreEvent(): boolean {
        return true;
    }
}
