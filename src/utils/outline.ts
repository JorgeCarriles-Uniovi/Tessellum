export type OutlineItemKind = "markdown";

export interface OutlineItem {
    title: string;
    level: number;
    kind: OutlineItemKind;
    lineNumber: number;
}

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
interface FenceInfo {
    marker: "`" | "~";
    length: number;
}

function normalizeContent(content: string): string {
    return content.replace(/\r\n?/g, "\n");
}

function getFenceInfo(line: string): FenceInfo | null {
    const trimmed = line.trimStart();
    const match = trimmed.match(/^(`{3,}|~{3,})/);
    if (!match) {
        return null;
    }

    return {
        marker: match[1][0] as FenceInfo["marker"],
        length: match[1].length,
    };
}

function forEachOutlineLine(lines: string[], visit: (line: string, index: number) => void): void {
    let activeFence: FenceInfo | null = null;

    for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        const fence = getFenceInfo(line);
        if (fence && !activeFence) {
            activeFence = fence;
            continue;
        }

        if (fence && activeFence && fence.marker === activeFence.marker && fence.length >= activeFence.length) {
            activeFence = null;
            continue;
        }

        if (activeFence) {
            continue;
        }

        visit(line, index);
    }
}

function parseMarkdownHeadings(lines: string[]): OutlineItem[] {
    const items: OutlineItem[] = [];

    forEachOutlineLine(lines, (line, index) => {
        const match = line.match(HEADING_RE);
        if (!match) {
            return;
        }

        const [, hashes, rawTitle] = match;
        const title = rawTitle.trim();
        if (!title) {
            return;
        }

        items.push({
            title,
            level: hashes.length,
            kind: "markdown",
            lineNumber: index + 1,
        });
    });

    return items;
}

export function parseOutline(content: string): OutlineItem[] {
    const normalized = normalizeContent(content);
    const lines = normalized.split("\n");
    return parseMarkdownHeadings(lines);
}
