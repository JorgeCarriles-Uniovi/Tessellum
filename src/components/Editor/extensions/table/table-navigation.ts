import { EditorView } from "@codemirror/view";
import { keymap } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import { TableBlock, parseTables, splitRow } from "./table-parser";

/**
 * Find the table block that contains `pos`, or null.
 */
export function findTableAt(
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
export function formatTable(
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
export function navigateCell(
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
export function handleEnterInTable(view: EditorView): boolean {
    const pos = view.state.selection.main.from;
    const table = findTableAt(view, pos);
    if (!table) return false;

    // Find which line the cursor is on
    const cursorLine = view.state.doc.lineAt(pos);

    // Check if the current row is empty
    const cells = splitRow(cursorLine.text);
    const isEmpty = cells.length > 0 && cells.every((c) => c.trim() === "");
    const tableStartLine = view.state.doc.lineAt(table.from).number;
    const isDataRow = cursorLine.number > tableStartLine + 1;

    // If we press Enter on an empty data row, jump out of the table
    // by clearing the current row and moving the cursor there.
    if (isDataRow && isEmpty) {
        view.dispatch({
            changes: {
                from: cursorLine.from,
                to: cursorLine.to,
                insert: "",
            },
            selection: {
                anchor: cursorLine.from,
            },
        });
        return true;
    }

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

export const tableKeymap = Prec.high(
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
