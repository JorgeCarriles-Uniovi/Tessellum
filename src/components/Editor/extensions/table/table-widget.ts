import { EditorView, WidgetType } from "@codemirror/view";
import { parseInlineMarkdown, splitRow } from "./table-parser";

abstract class BaseTableRowWidget extends WidgetType {
    constructor(
        readonly rowText: string,
        readonly alignments: Array<"left" | "center" | "right">,
        readonly columnCount: number,
        readonly from: number,
        readonly isHeader: boolean,
        readonly isSeparator: boolean,
        readonly isLast: boolean
    ) {
        super();
    }

    eq(other: BaseTableRowWidget): boolean {
        return (
            this.rowText === other.rowText &&
            this.from === other.from &&
            this.columnCount === other.columnCount &&
            this.alignments.join("|") === other.alignments.join("|") &&
            this.isHeader === other.isHeader &&
            this.isSeparator === other.isSeparator &&
            this.isLast === other.isLast
        );
    }

    toDOM(view: EditorView): HTMLElement {
        const wrapper = document.createElement("div");
        wrapper.className = "cm-table-widget";

        if (this.isHeader) {
            wrapper.classList.add("cm-table-widget-first");
        }
        if (this.isLast) {
            wrapper.classList.add("cm-table-widget-last");
        }
        if (this.isSeparator) {
            wrapper.classList.add("cm-table-widget-separator");
        }

        const table = document.createElement("table");
        table.className = "cm-table";
        table.style.tableLayout = "fixed";
        table.style.width = "100%";
        table.style.margin = "0";
        table.style.lineHeight = "normal";

        if (this.isSeparator) {
            // Keep the markdown separator source line rendered as a zero-height placeholder.
            // The visible divider is provided by header/data cell borders in adjacent rows.
            wrapper.setAttribute("aria-hidden", "true");
            return wrapper;
        }

        const colGroup = document.createElement("colgroup");
        for (let i = 0; i < this.columnCount; i++) {
            const col = document.createElement("col");
            col.style.width = `${100 / this.columnCount}%`;
            colGroup.appendChild(col);
        }
        table.appendChild(colGroup);

        const cells = splitRow(this.rowText);

        if (this.isHeader) {
            const thead = document.createElement("thead");
            const tr = document.createElement("tr");
            for (let i = 0; i < this.columnCount; i++) {
                const th = document.createElement("th");
                const content = cells[i] || "";
                th.appendChild(parseInlineMarkdown(content));
                th.style.textAlign = this.alignments[i] || "left";
                tr.appendChild(th);
            }
            thead.appendChild(tr);
            table.appendChild(thead);
        } else {
            const tbody = document.createElement("tbody");
            const tr = document.createElement("tr");
            for (let i = 0; i < this.columnCount; i++) {
                const td = document.createElement("td");
                const content = cells[i] || "";
                td.appendChild(parseInlineMarkdown(content));
                td.style.textAlign = this.alignments[i] || "left";
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
            table.appendChild(tbody);
        }

        wrapper.appendChild(table);

        // Single click moves caret into the source line so the plugin can switch to markdown editing.
        wrapper.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            view.dispatch({
                selection: { anchor: this.from },
            });
            view.focus();
        });

        return wrapper;
    }

    ignoreEvent(): boolean {
        return true;
    }
}

export class TableHeaderWidget extends BaseTableRowWidget {
    constructor(rowText: string, alignments: Array<"left" | "center" | "right">, columnCount: number, from: number) {
        super(rowText, alignments, columnCount, from, true, false, false);
    }
}

export class TableSeparatorWidget extends BaseTableRowWidget {
    constructor(rowText: string, alignments: Array<"left" | "center" | "right">, columnCount: number, from: number) {
        super(rowText, alignments, columnCount, from, false, true, false);
    }
}

export class TableDataWidget extends BaseTableRowWidget {
    constructor(
        rowText: string,
        alignments: Array<"left" | "center" | "right">,
        columnCount: number,
        from: number,
        isLast: boolean,
        private dataRowIndex: number = 0
    ) {
        super(rowText, alignments, columnCount, from, false, false, isLast);
    }

    override toDOM(view: EditorView): HTMLElement {
        const dom = super.toDOM(view);
        const table = dom.querySelector("table");
        // nth-child(even) corresponds to 1-based index 2, 4, 6...
        // which means 0-based dataRowIndex % 2 !== 0 (1, 3, 5...)
        if (table && this.dataRowIndex % 2 !== 0) {
            table.classList.add("cm-table-even-row");
        }
        return dom;
    }
}
