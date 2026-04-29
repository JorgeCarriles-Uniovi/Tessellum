import type { FileMetadata } from "../../types";
import type { PaletteCommand } from "../../plugins/api/UIAPI";

export interface NoteCardMetadata {
    contentPreview: string;
    tags: string[];
}

// Frontmatter extraction stays line-based so malformed fences degrade safely.
export function extractFrontmatter(rawContent: string): { frontmatter: string; body: string } {
    const normalized = rawContent.replace(/\r\n/g, "\n");
    if (!normalized.startsWith("---\n")) {
        return { frontmatter: "", body: normalized };
    }

    const endIndex = normalized.indexOf("\n---\n", 4);
    if (endIndex === -1) {
        return { frontmatter: "", body: normalized };
    }

    return {
        frontmatter: normalized.slice(4, endIndex),
        body: normalized.slice(endIndex + 5),
    };
}

export function parseFrontmatterTags(frontmatter: string): string[] {
    if (!frontmatter.trim()) {
        return [];
    }

    const inlineTagsMatch = frontmatter.match(/^\s*tags\s*:\s*\[(.*?)\]\s*$/m);
    if (inlineTagsMatch) {
        const inner = inlineTagsMatch[1].trim();
        if (!inner) {
            return [];
        }

        return inner
            .split(",")
            .map((value) => value.trim().replace(/^['"]|['"]$/g, ""))
            .filter(Boolean);
    }

    const blockMatch = frontmatter.match(/^\s*tags\s*:\s*\n((?:\s*-\s*.+\n?)*)/m);
    if (!blockMatch) {
        const lineMatch = frontmatter.match(/^\s*tags\s*:\s*([^\n]+)\s*$/m);
        if (!lineMatch || lineMatch[1].startsWith("[")) {
            return [];
        }

        const inlineValue = lineMatch[1].trim().replace(/^['"]|['"]$/g, "");
        return inlineValue ? [inlineValue] : [];
    }

    return blockMatch[1]
        .split("\n")
        .map((line) => line.match(/^\s*-\s*(.+)\s*$/)?.[1] ?? "")
        .map((value) => value.trim().replace(/^['"]|['"]$/g, ""))
        .filter(Boolean);
}

export function stripMarkdownSyntax(rawText: string): string {
    return rawText
        .replace(/`{1,3}[^`]*`{1,3}/g, " ")
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
        .replace(/(^|\s)(#{1,6}\s*)/g, "$1")
        .replace(/^[-*_]{3,}\s*$/gm, " ")
        .replace(/^\s*>\s?/gm, "")
        .replace(/^\s*[-*]\s+/gm, "")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .replace(/~~([^~]+)~~/g, "$1")
        .replace(/[*_~`>#-]/g, " ");
}

export function buildContentPreview(rawContent: string, emptyPreviewText: string): NoteCardMetadata {
    const { frontmatter, body } = extractFrontmatter(rawContent);
    const tags = parseFrontmatterTags(frontmatter);
    const plainText = stripMarkdownSyntax(body);
    const collapsed = plainText
        .replace(/\r\n/g, "\n")
        .replace(/\t/g, " ")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join(" ");

    if (!collapsed) {
        return { contentPreview: emptyPreviewText, tags };
    }

    return {
        contentPreview: collapsed.slice(0, 180),
        tags,
    };
}

export function buildShortPath(path: string, minSegments = 2, maxSegments = 3): string {
    const segments = path
        .split(/[\\/]+/)
        .map((segment) => segment.trim())
        .filter(Boolean);

    if (segments.length <= maxSegments) {
        return segments.join(" / ");
    }

    const takeCount = Math.max(minSegments, maxSegments);
    return segments.slice(-takeCount).join(" / ");
}

export function normalizeTimestampSeconds(value: number): number {
    if (value > 1_000_000_000_000) {
        return Math.floor(value / 1000);
    }
    return value;
}

export function formatRelativeTime(unixSeconds: number, locale: string): string {
    const now = Date.now();
    const seconds = normalizeTimestampSeconds(unixSeconds);
    const diffMs = now - seconds * 1000;
    const minutes = Math.floor(diffMs / 60000);

    if (minutes < 1) {
        return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(0, "minute");
    }
    if (minutes < 60) {
        return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-minutes, "minute");
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-hours, "hour");
    }

    const days = Math.floor(hours / 24);
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-days, "day");
}

export function createTableMarkdown(rows: number, cols: number) {
    const headerCells = Array.from({ length: cols }, (_, index) => `Header ${index + 1}`);
    const separatorCells = Array.from({ length: cols }, () => "---");
    const emptyRow = Array.from({ length: cols }, () => "   ");

    const lines = [
        `| ${headerCells.join(" | ")} |`,
        `| ${separatorCells.join(" | ")} |`,
        ...Array.from({ length: rows }, () => `| ${emptyRow.join(" | ")} |`),
    ];

    const insertText = `${lines.join("\n")}\n`;
    const selectionOffset = lines[0].length + 1 + lines[1].length + 1 + 2;

    return { insertText, selectionOffset };
}

export function getPrimaryAction(
    vaultPath: string | null | undefined,
    newNote?: PaletteCommand,
    openVault?: PaletteCommand,
) {
    return vaultPath ? newNote : openVault;
}

export function buildTabsFromPaths(openTabPaths: string[], files: FileMetadata[]) {
    const fileByPath = new Map(files.map((file) => [file.path, file]));

    return openTabPaths.map((path) => {
        const file = fileByPath.get(path);
        return {
            id: path,
            title: file?.filename ?? path.split(/[\\/]/).pop() ?? path,
            path,
        };
    });
}
