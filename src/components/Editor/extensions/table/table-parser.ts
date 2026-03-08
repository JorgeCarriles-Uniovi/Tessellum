export interface TableBlock {
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

const SEPARATOR_CELL_RE = /^\s*:?-{3,}:?\s*$/;

function isSeparatorRow(text: string): boolean {
    const stripped = text.trim();
    if (!stripped.startsWith("|") || !stripped.endsWith("|")) return false;
    const cells = splitRow(stripped);
    return cells.length > 0 && cells.every((c) => SEPARATOR_CELL_RE.test(c));
}

/** Split a pipe-delimited row into cell contents (excluding outer pipes). */
export function splitRow(text: string): string[] {
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
export function parseTables(
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

/**
 * Parses basic inline formatting (bold, italic, strikethrough, inline code, links)
 * and returns a DocumentFragment containing the generated DOM nodes.
 */
export function parseInlineMarkdown(text: string): DocumentFragment {
    const fragment = document.createDocumentFragment();

    // Regex to match inline markdown tokens (handles code, bold, italic, strikethrough, links)
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
