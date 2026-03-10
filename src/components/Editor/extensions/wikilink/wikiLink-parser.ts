import { EditorView } from "@codemirror/view";

export interface WikiLinkMatch {
    from: number;
    to: number;
    target: string;      // The link target (before |)
    alias?: string;      // Display text (after |)
    aliasOffset?: number; // Offset of the alias text from start of full text [[...]]
    fullText: string;    // Complete [[...]] text
}


export interface FileIndex {
    [filename: string]: string; // filename -> full path
}

/**
 * Parse wikilink syntax and extract target and optional alias
 * Supports:
 * - [[Note]] -> { target: "Note", alias: undefined }
 * - [[Note|Display]] -> { target: "Note", alias: "Display" }
 * - [[folder/Note]] -> { target: "folder/Note", alias: undefined }
 * - \[[Not a link]] -> ignored (escaped)
 */
export interface ParsedWikiLink {
    target: string;
    alias?: string;
    aliasOffset?: number; // Offset of the alias text from the start of the full string [[...]]
}

/**
 * Parse wikilink syntax and extract target and optional alias
 */
export function parseWikiLink(text: string): ParsedWikiLink | null {
    // Remove [[ and ]]
    const inner = text.slice(2, -2);

    // Check for pipe separator
    const pipeIndex = inner.indexOf('|');

    if (pipeIndex !== -1) {
        const aliasPart = inner.slice(pipeIndex + 1);
        const trimmedAlias = aliasPart.trim();
        const aliasOffsetInPart = aliasPart.indexOf(trimmedAlias);

        return {
            target: inner.slice(0, pipeIndex).trim(),
            alias: trimmedAlias,
            // Offset: 2 (for [[) + pipeIndex + 1 (for |) + offset within the alias part
            aliasOffset: 2 + pipeIndex + 1 + aliasOffsetInPart
        };
    }

    return {
        target: inner.trim()
    };
}


/**
 * Find all wikilinks in the document
 */
export function findWikiLinks(view: EditorView): WikiLinkMatch[] {
    const matches: WikiLinkMatch[] = [];
    const doc = view.state.doc;

    // Regex that matches [[...]] but not \[[...]]
    const regex = /(?<!\\)\[\[((?:\\\]|\](?!\])|[^\]])+)\]\]/g;

    for (let i = 1; i <= doc.lines; i++) {
        const line = doc.line(i);
        const lineText = line.text;

        let match: RegExpExecArray | null;
        regex.lastIndex = 0; // Reset regex

        while ((match = regex.exec(lineText)) !== null) {
            const from = line.from + match.index;
            const to = from + match[0].length;
            const parsed = parseWikiLink(match[0]);

            if (parsed) {
                matches.push({
                    from,
                    to,
                    target: parsed.target,
                    alias: parsed.alias,
                    aliasOffset: parsed.aliasOffset,
                    fullText: match[0],
                });
            }

        }
    }

    return matches;
}

