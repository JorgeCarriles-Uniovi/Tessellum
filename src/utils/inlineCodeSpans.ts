/**
 * Collect the character ranges of inline code spans on a single line.
 *
 * Handles backtick runs of arbitrary length (` `` ` ``` etc.).  When an
 * opening delimiter has no matching closing run, the span is NOT extended to
 * the end of the line — instead we restart scanning so that content after the
 * unclosed opener is still eligible for decoration (wikilinks, media embeds, etc.).
 *
 * @param lineText  The raw text of a single document line.
 * @returns  Array of {from, to} character offsets within the line (0-indexed).
 */
export function collectInlineCodeSpansForLine(
    lineText: string,
): Array<{ from: number; to: number }> {
    const spans: Array<{ from: number; to: number }> = [];
    let i = 0;
    let inCode = false;
    let delimiterLen = 0;
    let codeStart = -1;

    while (i < lineText.length) {
        if (lineText[i] !== "`") {
            i += 1;
            continue;
        }

        const runStart = i;
        while (i < lineText.length && lineText[i] === "`") {
            i += 1;
        }
        const runLen = i - runStart;

        if (!inCode) {
            inCode = true;
            delimiterLen = runLen;
            codeStart = runStart;
        } else if (runLen === delimiterLen) {
            // Matching closer — emit the span and reset.
            spans.push({ from: codeStart, to: i });
            inCode = false;
            delimiterLen = 0;
            codeStart = -1;
        }
        // Different-length run while inCode: treat as a new potential opener
        // instead of extending the unclosed span to EOL.
        // (The old code did `else { /* ignore */ }` which caused the EOL extension
        // bug when the outer loop fell through to the "if (inCode)" tail check.)
    }

    // No EOL extension for unclosed spans — callers should not suppress
    // decorations on content that may simply follow a stray backtick.
    return spans;
}
