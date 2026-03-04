import {
    Decoration,
    DecorationSet,
    EditorView,
    ViewPlugin,
    ViewUpdate,
    WidgetType,
} from "@codemirror/view";
import { Extension, RangeSetBuilder } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { Prec } from "@codemirror/state";

// ─── Parsed Table Block ───────────────────────────────────────────────────────

interface TableBlock {
    /** Absolute doc offset where the table starts (first char of header row). */
    from: number;
    /** Absolute doc offset where the table ends (last char of last row). */
    to: number;
    /** Raw header row text (without trailing newline). */
    headerRow: string;
    /** Raw separator row text. */
    separatorRow: string;
    /** Raw data row texts. */
    dataRows: string[];
    /** Number of columns detected from the separator. */
    columnCount: number;
    /** Per-column alignment derived from separator (left | center | right). */
    alignments: ("left" | "center" | "right")[];
}

// ─── Table Parser ─────────────────────────────────────────────────────────────

/**
 * GFM separator pattern. Each column cell matches optional colons around dashes.
 * E.g. `| :---: | --- | ---: |`
 */
const SEPARATOR_CELL_RE = /^\s*:?-{3,}:?\s*$/;

function isSeparatorRow(text: string): boolean {
    const stripped = text.trim();
    if (!stripped.startsWith("|") || !stripped.endsWith("|")) return false;
    const cells = splitRow(stripped);
    return cells.length > 0 && cells.every((c) => SEPARATOR_CELL_RE.test(c));
}

/** Split a pipe-delimited row into cell contents (excluding outer pipes). */
function splitRow(text: string): string[] {
    const stripped = text.trim();
    // Remove leading and trailing pipes
    const inner = stripped.startsWith("|")
        ? stripped.slice(1)
        : stripped;
    const trimmed = inner.endsWith("|")
        ? inner.slice(0, -1)
        : inner;
    return trimmed.split("|").map((c) => c.trim());
}

function isTableRow(text: string): boolean {
    const stripped = text.trim();
    return stripped.startsWith("|") && stripped.endsWith("|") && stripped.length > 1;
}

function parseAlignment(cell: string): "left" | "center" | "right" {
    const c = cell.trim();
    const leftColon = c.startsWith(":");
    const rightColon = c.endsWith(":");
    if (leftColon && rightColon) return "center";
    if (rightColon) return "right";
    return "left";
}

/**
 * Scan a document range for GFM table blocks.
 * A valid table is: header row → separator row → 0+ data rows.
 */
function parseTables(
    doc: { lineAt(pos: number): { from: number; to: number; text: string; number: number }; lines: number; line(n: number): { from: number; to: number; text: string; number: number } },
    from: number,
    to: number
): TableBlock[] {
    const tables: TableBlock[] = [];
    let lineNum = doc.lineAt(from).number;
    const lastLineNum = doc.lineAt(to).number;

    while (lineNum <= lastLineNum) {
        const headerLine = doc.line(lineNum);

        // Need at least 2 more lines for separator + optional data
        if (!isTableRow(headerLine.text) || lineNum >= doc.lines) {
            lineNum++;
            continue;
        }

        const sepLine = doc.line(lineNum + 1);
        if (!isSeparatorRow(sepLine.text)) {
            lineNum++;
            continue;
        }

        // Verify column counts match
        const headerCells = splitRow(headerLine.text);
        const sepCells = splitRow(sepLine.text);
        if (headerCells.length !== sepCells.length) {
            lineNum++;
            continue;
        }

        // Collect data rows
        const dataRows: string[] = [];
        let endLine = sepLine;
        let nextLineNum = lineNum + 2;
        while (nextLineNum <= doc.lines) {
            const dataLine = doc.line(nextLineNum);
            if (!isTableRow(dataLine.text)) break;
            const dataCells = splitRow(dataLine.text);
            if (dataCells.length !== headerCells.length) break;
            dataRows.push(dataLine.text);
            endLine = dataLine;
            nextLineNum++;
        }

        tables.push({
            from: headerLine.from,
            to: endLine.to,
            headerRow: headerLine.text,
            separatorRow: sepLine.text,
            dataRows,
            columnCount: headerCells.length,
            alignments: sepCells.map(parseAlignment),
        });

        lineNum = nextLineNum;
    }

    return tables;
}

// ─── Inline Markdown Parser ───────────────────────────────────────────────────

/**
 * Parses basic inline formatting (bold, italic, strikethrough, inline code, links)
 * and returns a DocumentFragment containing the generated DOM nodes.
 */
function parseInlineMarkdown(text: string): DocumentFragment {
    const fragment = document.createDocumentFragment();

    // Regex to match inline markdown tokens (handles code, bold, italic, strikethrough, links)
    // 1. `code`
    // 2. **bold** or __bold__
    // 3. *italic* or _italic_
    // 4. ~~strikethrough~~
    // 5. [link](url)
    const tokenRe = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\([^)]+\))/g;

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = tokenRe.exec(text)) !== null) {
        // Append text before the match
        if (match.index > lastIndex) {
            fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
        }

        const token = match[0];

        if (token.startsWith("`") && token.endsWith("`")) {
            // Inline code
            const el = document.createElement("code");
            el.textContent = token.slice(1, -1);
            fragment.appendChild(el);
        } else if ((token.startsWith("**") && token.endsWith("**")) || (token.startsWith("__") && token.endsWith("__"))) {
            // Bold
            const el = document.createElement("strong");
            // Recursively parse inner content (e.g. bold italic)
            el.appendChild(parseInlineMarkdown(token.slice(2, -2)));
            fragment.appendChild(el);
        } else if (token.startsWith("~~") && token.endsWith("~~")) {
            // Strikethrough
            const el = document.createElement("del");
            el.appendChild(parseInlineMarkdown(token.slice(2, -2)));
            fragment.appendChild(el);
        } else if ((token.startsWith("*") && token.endsWith("*")) || (token.startsWith("_") && token.endsWith("_"))) {
            // Italic
            const el = document.createElement("em");
            el.appendChild(parseInlineMarkdown(token.slice(1, -1)));
            fragment.appendChild(el);
        } else if (token.startsWith("[")) {
            // Link
            const endBracket = token.indexOf("]");
            const startParen = token.indexOf("(", endBracket);
            if (endBracket !== -1 && startParen !== -1 && token.endsWith(")")) {
                const linkText = token.slice(1, endBracket);
                const url = token.slice(startParen + 1, -1);
                const el = document.createElement("a");
                el.href = url;
                el.target = "_blank";
                el.rel = "noopener noreferrer";
                el.appendChild(parseInlineMarkdown(linkText));
                fragment.appendChild(el);
            } else {
                // Not a valid link syntax, treat as text
                fragment.appendChild(document.createTextNode(token));
            }
        }

        lastIndex = tokenRe.lastIndex;
    }

    // Append any remaining text after the last match
    if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
    }

    return fragment;
}

// ─── Table Widget ─────────────────────────────────────────────────────────────

class TableWidget extends WidgetType {
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

// ─── ViewPlugin ───────────────────────────────────────────────────────────────

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
                const tables = parseTables(state.doc, from, to);

                for (const table of tables) {
                    // Check if cursor is inside the table block
                    const cursorInside =
                        selection.from >= table.from &&
                        selection.from <= table.to;

                    if (!cursorInside) {
                        const rawText = state.doc.sliceString(table.from, table.to);
                        const tableWidget = new TableWidget(table, rawText);

                        // 1. We cannot use `block: true` in a ViewPlugin.
                        // Instead, we replace the entire first line with our widget, which acts as the anchor.
                        const firstLine = state.doc.lineAt(table.from);
                        builder.add(
                            firstLine.from,
                            firstLine.to,
                            Decoration.replace({
                                widget: tableWidget,
                            })
                        );

                        // 2. Hide all the *other* raw text lines of the table
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

// ─── Table Keymap (Tab / Shift-Tab / Enter) ───────────────────────────────────

/**
 * Find the table block that contains `pos`, or null.
 */
function findTableAt(
    view: EditorView,
    pos: number
): TableBlock | null {
    // Parse the full document for tables (scoped to a generous range around pos)
    const line = view.state.doc.lineAt(pos);
    // Look ±50 lines to find the table
    const startLine = Math.max(1, line.number - 50);
    const endLine = Math.min(view.state.doc.lines, line.number + 50);
    const from = view.state.doc.line(startLine).from;
    const to = view.state.doc.line(endLine).to;

    const tables = parseTables(view.state.doc, from, to);
    return tables.find((t) => pos >= t.from && pos <= t.to) ?? null;
}

/**
 * Auto-format a table: pad each column to uniform width and align pipes.
 * Returns the formatted text and new cursor position mapped from the old one.
 */
function formatTable(
    table: TableBlock,
    doc: string,
    cursorPos: number
): { text: string; newCursorPos: number } {
    const allRows = [table.headerRow, table.separatorRow, ...table.dataRows];
    const parsed = allRows.map(splitRow);

    // Compute max width per column
    const colWidths: number[] = new Array(table.columnCount).fill(0);
    // Only measure header + data rows for width (not separator)
    [parsed[0], ...parsed.slice(2)].forEach((row) => {
        row.forEach((cell, i) => {
            colWidths[i] = Math.max(colWidths[i], cell.length, 3);
        });
    });

    // Track cursor position: find which row and column the cursor is in
    let cursorRow = -1;
    let cursorCol = -1;
    let cursorOffsetInCell = 0;
    if (cursorPos >= table.from && cursorPos <= table.to) {
        const cursorLine = doc.slice(0, cursorPos).split("\n").length;
        const tableStartLine = doc.slice(0, table.from).split("\n").length;
        cursorRow = cursorLine - tableStartLine;

        // Find column
        const rowLines = allRows;
        if (cursorRow >= 0 && cursorRow < rowLines.length) {
            const rowText = rowLines[cursorRow];
            const rowStart =
                table.from +
                allRows.slice(0, cursorRow).reduce((s, r) => s + r.length + 1, 0);
            const posInRow = cursorPos - rowStart;
            // Walk through pipes to find which cell we're in
            let col = -1;
            let charIdx = 0;
            for (let i = 0; i < rowText.length; i++) {
                if (rowText[i] === "|") {
                    col++;
                    charIdx = i + 1;
                }
                if (i === posInRow) {
                    cursorCol = Math.max(0, col);
                    cursorOffsetInCell = posInRow - charIdx;
                    break;
                }
            }
            if (cursorCol === -1 && col >= 0) {
                cursorCol = col;
                cursorOffsetInCell = posInRow - charIdx;
            }
        }
    }

    // Build formatted rows
    const formattedRows = parsed.map((row, rowIdx) => {
        const cells = row.map((cell, colIdx) => {
            if (rowIdx === 1) {
                // Separator row
                const align = table.alignments[colIdx];
                const dashes = "-".repeat(colWidths[colIdx]);
                if (align === "center") return `:${dashes}:`;
                if (align === "right") return `${dashes}:`;
                return dashes;
            }
            // Pad cell to column width
            return cell.padEnd(colWidths[colIdx]);
        });
        return `| ${cells.join(" | ")} |`;
    });

    const text = formattedRows.join("\n");

    // Compute new cursor position
    let newCursorPos = cursorPos;
    if (cursorRow >= 0 && cursorCol >= 0 && cursorRow < formattedRows.length) {
        const rowsBefore = formattedRows.slice(0, cursorRow);
        const offset = rowsBefore.reduce((s, r) => s + r.length + 1, 0);
        const row = formattedRows[cursorRow];
        // Find the start of the target cell
        let pipeCount = 0;
        let cellStart = 0;
        for (let i = 0; i < row.length; i++) {
            if (row[i] === "|") {
                if (pipeCount === cursorCol + 1) {
                    break;
                }
                pipeCount++;
                cellStart = i + 2; // after "| "
            }
        }
        // Clamp offset within cell
        const maxOffset = colWidths[cursorCol] ?? 0;
        const clamped = Math.min(Math.max(0, cursorOffsetInCell), maxOffset);
        newCursorPos = table.from + offset + cellStart + clamped;
    }

    return { text, newCursorPos };
}

/**
 * Move cursor to the next cell (Tab) or previous cell (Shift-Tab).
 */
function navigateCell(
    view: EditorView,
    direction: "next" | "prev"
): boolean {
    const pos = view.state.selection.main.from;
    const table = findTableAt(view, pos);
    if (!table) return false;

    const allRows = [table.headerRow, table.separatorRow, ...table.dataRows];

    // Determine current row and column
    const cursorLine = view.state.doc.lineAt(pos);
    const tableStartLine = view.state.doc.lineAt(table.from);
    const rowIndex = cursorLine.number - tableStartLine.number;

    if (rowIndex < 0 || rowIndex >= allRows.length) return false;

    const rowText = allRows[rowIndex];
    const posInRow = pos - cursorLine.from;

    // Find current column
    let currentCol = -1;
    for (let i = 0; i <= posInRow && i < rowText.length; i++) {
        if (rowText[i] === "|") currentCol++;
    }
    currentCol = Math.max(0, currentCol);

    // Skip separator row (row index 1)
    let targetRow = rowIndex;
    let targetCol = currentCol;

    if (direction === "next") {
        targetCol++;
        if (targetCol >= table.columnCount) {
            targetCol = 0;
            targetRow++;
            // Skip separator
            if (targetRow === 1) targetRow = 2;
            // If past last row, insert a new row
            if (targetRow >= allRows.length) {
                const newRowCells = new Array(table.columnCount)
                    .fill("")
                    .map(() => "   ");
                const newRow = `| ${newRowCells.join(" | ")} |`;
                view.dispatch({
                    changes: {
                        from: table.to,
                        to: table.to,
                        insert: "\n" + newRow,
                    },
                });
                // Now re-find the table and position in the new row
                const newTable = findTableAt(view, table.from);
                if (newTable) {
                    const lastLine = view.state.doc.lineAt(newTable.to);
                    // Position cursor in first cell of new row
                    const firstPipe = lastLine.text.indexOf("|");
                    const cellStart = lastLine.from + firstPipe + 2;
                    view.dispatch({
                        selection: { anchor: Math.min(cellStart, lastLine.to) },
                    });
                }
                return true;
            }
        }
    } else {
        targetCol--;
        if (targetCol < 0) {
            targetCol = table.columnCount - 1;
            targetRow--;
            // Skip separator
            if (targetRow === 1) targetRow = 0;
            if (targetRow < 0) return true; // Already at first cell
        }
    }

    // Format the table first
    const docText = view.state.doc.toString();
    const { text: formatted, newCursorPos: _ } = formatTable(
        table,
        docText,
        pos
    );

    // Apply formatting
    view.dispatch({
        changes: {
            from: table.from,
            to: table.to,
            insert: formatted,
        },
    });

    // Navigate to target cell
    const updatedTable = findTableAt(view, table.from);
    if (!updatedTable) return true;

    const updatedRows = [
        updatedTable.headerRow,
        updatedTable.separatorRow,
        ...updatedTable.dataRows,
    ];
    if (targetRow >= updatedRows.length) return true;

    const targetRowText = updatedRows[targetRow];
    // Find the nth pipe to locate the target cell
    let pipeCount = 0;
    let cellStart = 0;
    for (let i = 0; i < targetRowText.length; i++) {
        if (targetRowText[i] === "|") {
            pipeCount++;
            if (pipeCount === targetCol + 1) {
                cellStart = i + 2; // after "| "
                break;
            }
        }
    }

    // Compute absolute position
    const rowsBefore = updatedRows.slice(0, targetRow);
    const offset = rowsBefore.reduce((s, r) => s + r.length + 1, 0);
    const newPos = updatedTable.from + offset + cellStart;

    view.dispatch({
        selection: {
            anchor: Math.min(newPos, view.state.doc.length),
        },
    });

    return true;
}

/**
 * Handle Enter key inside a table: insert a new row.
 */
function handleEnterInTable(view: EditorView): boolean {
    const pos = view.state.selection.main.from;
    const table = findTableAt(view, pos);
    if (!table) return false;

    // Find which line the cursor is on
    const cursorLine = view.state.doc.lineAt(pos);

    // Build a new empty row
    const newRowCells = new Array(table.columnCount)
        .fill("")
        .map(() => "   ");
    const newRow = `| ${newRowCells.join(" | ")} |`;

    // Insert after the current line
    view.dispatch({
        changes: {
            from: cursorLine.to,
            to: cursorLine.to,
            insert: "\n" + newRow,
        },
        selection: {
            // Position cursor in the first cell of the new row
            anchor: cursorLine.to + 3, // after "\n| "
        },
    });

    return true;
}

const tableKeymap = Prec.high(
    keymap.of([
        {
            key: "Tab",
            run: (view) => navigateCell(view, "next"),
        },
        {
            key: "Shift-Tab",
            run: (view) => navigateCell(view, "prev"),
        },
        {
            key: "Enter",
            run: (view) => handleEnterInTable(view),
        },
    ])
);

// ─── Exported Helpers for Other Plugins ───────────────────────────────────────

/**
 * Returns a Set of document positions (line.from) that belong to table blocks.
 * Other plugins can use this to avoid applying conflicting decorations.
 */
export function getTableLinePositions(view: EditorView): Set<number> {
    const positions = new Set<number>();
    const { state } = view;

    for (const { from, to } of view.visibleRanges) {
        const tables = parseTables(state.doc, from, to);
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

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Creates a CM6 extension that:
 * 1. Renders GFM markdown tables as styled HTML `<table>` widgets when the
 *    cursor is outside the table block (live preview).
 * 2. Shows raw pipe syntax when the cursor is inside the table.
 * 3. Provides Tab/Shift-Tab cell navigation and Enter for new rows.
 * 4. Auto-formats pipe alignment on navigation.
 */
export function createTablePlugin(): Extension {
    return [tableViewPlugin, tableKeymap];
}
