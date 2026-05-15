import type { FileMetadata } from "../../types";
import type { OutlineItem } from "../../utils/outline";

const MARKDOWN_EXPORT_EXTENSIONS = new Set(["md", "markdown"]);

export const EXPORT_PAGE_HEIGHT_PX = 1122;
export const EXPORT_PAGE_MARGIN_TOP_PX = 28;
export const EXPORT_PAGE_MARGIN_BOTTOM_PX = 36;
export const EXPORT_PAGE_CONTENT_HEIGHT_PX = EXPORT_PAGE_HEIGHT_PX - EXPORT_PAGE_MARGIN_TOP_PX - EXPORT_PAGE_MARGIN_BOTTOM_PX;

export const EXPORT_TYPOGRAPHY = {
    bodyFontSizePx: 16,
    titleFontSizePx: 30,
} as const;

export interface PdfOutlineEntry {
    title: string;
    level: number;
    lineNumber: number;
    page: number;
    offsetWithinPagePx: number;
}

function getExtension(filename: string): string {
    const match = /\.([^.]+)$/.exec(filename);
    return match?.[1]?.toLowerCase() ?? "";
}

export function canExportNoteToPdf(file: FileMetadata): boolean {
    return !file.is_dir && MARKDOWN_EXPORT_EXTENSIONS.has(getExtension(file.filename));
}

export function buildPdfFileName(filename: string): string {
    if (/\.pdf$/i.test(filename)) {
        return filename;
    }

    const baseName = filename.replace(/\.[^.]+$/, "");
    return `${baseName}.pdf`;
}

export function buildPdfOutlineEntries(
    outlineItems: OutlineItem[],
    headingOffsets: Map<number, number>,
): PdfOutlineEntry[] {
    return outlineItems.map((item) => {
        const topOffset = Math.max(0, headingOffsets.get(item.lineNumber) ?? 0);
        const page = Math.floor(topOffset / EXPORT_PAGE_CONTENT_HEIGHT_PX) + 1;
        const offsetWithinPagePx = topOffset % EXPORT_PAGE_CONTENT_HEIGHT_PX;

        return {
            title: item.title,
            level: item.level,
            lineNumber: item.lineNumber,
            page,
            offsetWithinPagePx,
        };
    });
}
