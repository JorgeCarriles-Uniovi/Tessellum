import { EditorView } from "@codemirror/view";
import { getCalloutType } from "../../../../constants/callout-types";

// Matches: > [!type] Optional title   or  > [!type]+/-  Optional title
export const CALLOUT_HEADER_RE = /^>\s*\[!(\w+)\]([+-])?\s*(.*)?$/;
// Matches continuation lines: > content  or just >
export const CALLOUT_CONTINUATION_RE = /^>\s?(.*)$/;

export interface CalloutBlock {
    type: string;              // e.g. "note", "warning"
    title: string;             // Custom title or type label
    foldChar: string;          // "+", "-", or "" (default open)
    headerFrom: number;        // doc position: start of header line
    headerTo: number;          // doc position: end of header line
    contentFrom: number;       // doc position: start of first content line (-1 if none)
    contentTo: number;         // doc position: end of last content line (-1 if none)
    contentLines: string[];    // Content text (with > prefix stripped)
    headerLineNumber: number;
    hasContent: boolean;       // Whether there are continuation lines
}

export function parseCalloutBlocks(view: EditorView): CalloutBlock[] {
    const { state } = view;
    const blocks: CalloutBlock[] = [];

    for (const { from, to } of view.visibleRanges) {
        let pos = from;

        while (pos <= to) {
            const line = state.doc.lineAt(pos);
            const headerMatch = line.text.match(CALLOUT_HEADER_RE);

            if (headerMatch) {
                const [, type, foldChar, rawTitle] = headerMatch;
                const calloutType = getCalloutType(type);
                const title = rawTitle?.trim() || calloutType?.label || type;
                const contentLines: string[] = [];
                let contentFrom = -1;
                let contentTo = -1;

                // Scan continuation lines.
                // Track open fenced blocks (``` or ~~~) so their interior lines
                // are not mistaken for the end of the callout even when they
                // don't start with '>'.
                let nextPos = line.to + 1;
                let fenceMarker: string | null = null;
                while (nextPos <= state.doc.length) {
                    const nextLine = state.doc.lineAt(nextPos);
                    const contMatch = nextLine.text.match(CALLOUT_CONTINUATION_RE);
                    if (contMatch) {
                        const stripped = contMatch[1];
                        if (contentFrom === -1) contentFrom = nextLine.from;
                        contentLines.push(stripped);
                        contentTo = nextLine.to;
                        nextPos = nextLine.to + 1;
                        // Detect fence open/close for ``` or ~~~
                        const fenceMatch = stripped.match(/^(`{3,}|~{3,})/);
                        if (fenceMatch) {
                            const marker = fenceMatch[1][0].repeat(3);
                            if (fenceMarker === null) {
                                fenceMarker = marker;
                            } else if (fenceMarker === marker) {
                                fenceMarker = null;
                            }
                        }
                    } else if (fenceMarker !== null) {
                        // Inside a fenced block — continuation lines don't need '>'
                        const stripped = nextLine.text;
                        if (contentFrom === -1) contentFrom = nextLine.from;
                        contentLines.push(stripped);
                        contentTo = nextLine.to;
                        nextPos = nextLine.to + 1;
                        const fenceMatch = stripped.match(/^(`{3,}|~{3,})/);
                        if (fenceMatch && fenceMatch[1][0].repeat(3) === fenceMarker) {
                            fenceMarker = null;
                        }
                    } else {
                        break;
                    }
                }

                blocks.push({
                    type: type.toLowerCase(),
                    title,
                    foldChar: foldChar || "",
                    headerFrom: line.from,
                    headerTo: line.to,
                    contentFrom,
                    contentTo,
                    contentLines,
                    headerLineNumber: line.number,
                    hasContent: contentLines.length > 0,
                });

                pos = contentTo !== -1 ? contentTo + 1 : line.to + 1;
            } else {
                pos = line.to + 1;
            }
        }
    }

    return blocks;
}
