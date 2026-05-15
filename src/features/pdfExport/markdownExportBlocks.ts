import { CALLOUT_CONTINUATION_RE, CALLOUT_HEADER_RE } from "../../components/Editor/extensions/callout/callout-parser";
import { getCalloutType } from "../../constants/callout-types";

export interface MarkdownExportBlockBase {
    startLine: number;
}

export interface MarkdownChunkBlock extends MarkdownExportBlockBase {
    kind: "markdown";
    content: string;
}

export interface CalloutExportBlock extends MarkdownExportBlockBase {
    kind: "callout";
    calloutType: string;
    title: string;
    content: string;
    contentLines: string[];
    contentStartLine: number;
    isTerminal: boolean;
}

export type MarkdownExportBlock = MarkdownChunkBlock | CalloutExportBlock;

function createMarkdownBlock(lines: string[], startLine: number): MarkdownChunkBlock | null {
    if (lines.length === 0) {
        return null;
    }

    const content = lines.join("\n");
    if (!content.trim()) {
        return null;
    }

    return {
        kind: "markdown",
        content,
        startLine,
    };
}

export function parseMarkdownExportBlocks(markdown: string): MarkdownExportBlock[] {
    const lines = markdown.replace(/\r\n/g, "\n").split("\n");
    const blocks: MarkdownExportBlock[] = [];
    const markdownLines: string[] = [];
    let markdownStartLine = 1;

    const flushMarkdownBlock = () => {
        const block = createMarkdownBlock(markdownLines, markdownStartLine);
        if (block) {
            blocks.push(block);
        }
        markdownLines.length = 0;
    };

    let index = 0;
    while (index < lines.length) {
        const headerMatch = lines[index].match(CALLOUT_HEADER_RE);
        if (!headerMatch) {
            if (markdownLines.length === 0) {
                markdownStartLine = index + 1;
            }
            markdownLines.push(lines[index]);
            index += 1;
            continue;
        }

        flushMarkdownBlock();

        const [, rawType, , rawTitle] = headerMatch;
        const calloutType = rawType.toLowerCase();
        const title = rawTitle?.trim() || getCalloutType(calloutType)?.label || calloutType;
        const contentLines: string[] = [];
        const contentStartLine = index + 2;

        index += 1;
        while (index < lines.length) {
            const continuationMatch = lines[index].match(CALLOUT_CONTINUATION_RE);
            if (!continuationMatch) {
                break;
            }

            contentLines.push(continuationMatch[1]);
            index += 1;
        }

        blocks.push({
            kind: "callout",
            startLine: index - contentLines.length,
            calloutType,
            title,
            content: contentLines.join("\n"),
            contentLines,
            contentStartLine,
            isTerminal: calloutType === "terminal",
        });
    }

    flushMarkdownBlock();
    return blocks;
}
