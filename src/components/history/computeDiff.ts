import { diffLines, diffWordsWithSpace } from "diff";

export type DiffRowType = "add" | "remove" | "context";

export interface DiffWord {
    text: string;
    /** true when this segment is the part that actually changed (added/removed) */
    changed: boolean;
}

export interface DiffRow {
    type: DiffRowType;
    /** full line text, without the trailing newline */
    text: string;
    /** present for modified lines so changed words can be highlighted */
    words?: DiffWord[];
}

/** Cap diff input size to keep diffing fast on very large notes. */
const MAX_INPUT_CHARS = 20000;

/** Split a diff chunk into individual lines, dropping the trailing empty
 * element produced by a chunk that ends in a newline. */
function splitLines(value: string): string[] {
    const lines = value.split("\n");
    if (lines.length > 1 && lines[lines.length - 1] === "") {
        lines.pop();
    }
    return lines;
}

/** Build word spans for one side of a modified line pair. For the "remove"
 * side we keep common + removed segments; for the "add" side, common + added. */
function buildWords(oldLine: string, newLine: string, side: "remove" | "add"): DiffWord[] {
    const parts = diffWordsWithSpace(oldLine, newLine);
    const words: DiffWord[] = [];
    for (const part of parts) {
        if (side === "remove" && part.added) continue;
        if (side === "add" && part.removed) continue;
        if (!part.value) continue;
        words.push({ text: part.value, changed: side === "remove" ? part.removed : part.added });
    }
    return words;
}

/**
 * Compute a GitHub-style unified diff between two texts.
 * `oldText` is the older snapshot, `newText` is the current note, so segments
 * present only in the current note are additions and those only in the snapshot
 * are removals.
 */
export function computeDiff(oldText: string, newText: string): { rows: DiffRow[]; truncated: boolean } {
    const truncated = oldText.length > MAX_INPUT_CHARS || newText.length > MAX_INPUT_CHARS;
    const oldCapped = truncated ? oldText.slice(0, MAX_INPUT_CHARS) : oldText;
    const newCapped = truncated ? newText.slice(0, MAX_INPUT_CHARS) : newText;

    const parts = diffLines(oldCapped, newCapped);
    const rows: DiffRow[] = [];

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!part.added && !part.removed) {
            for (const line of splitLines(part.value)) {
                rows.push({ type: "context", text: line });
            }
            continue;
        }

        if (part.removed) {
            const next = parts[i + 1];
            // A removed block immediately followed by an added block is a
            // modification: pair lines up and highlight the changed words.
            if (next?.added) {
                const removedLines = splitLines(part.value);
                const addedLines = splitLines(next.value);
                const paired = Math.min(removedLines.length, addedLines.length);
                for (let j = 0; j < paired; j++) {
                    rows.push({
                        type: "remove",
                        text: removedLines[j],
                        words: buildWords(removedLines[j], addedLines[j], "remove"),
                    });
                    rows.push({
                        type: "add",
                        text: addedLines[j],
                        words: buildWords(removedLines[j], addedLines[j], "add"),
                    });
                }
                for (let j = paired; j < removedLines.length; j++) {
                    rows.push({ type: "remove", text: removedLines[j] });
                }
                for (let j = paired; j < addedLines.length; j++) {
                    rows.push({ type: "add", text: addedLines[j] });
                }
                i++; // consumed the paired added block
                continue;
            }

            for (const line of splitLines(part.value)) {
                rows.push({ type: "remove", text: line });
            }
            continue;
        }

        // added-only block
        for (const line of splitLines(part.value)) {
            rows.push({ type: "add", text: line });
        }
    }

    return { rows, truncated };
}
