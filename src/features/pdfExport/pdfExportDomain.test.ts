import { describe, expect, test } from "vitest";
import type { FileMetadata } from "../../types";
import {
    EXPORT_PAGE_CONTENT_HEIGHT_PX,
    EXPORT_TYPOGRAPHY,
    buildPdfFileName,
    buildPdfOutlineEntries,
    canExportNoteToPdf,
} from "./pdfExportDomain";

function createFile(filename: string, isDir = false): FileMetadata {
    return {
        path: `vault/${filename}`,
        filename,
        is_dir: isDir,
        size: 1,
        last_modified: 1,
    };
}

describe("pdfExportDomain", () => {
    test("only enables PDF export for markdown notes", () => {
        expect(canExportNoteToPdf(createFile("note.md"))).toBe(true);
        expect(canExportNoteToPdf(createFile("note.markdown"))).toBe(true);
        expect(canExportNoteToPdf(createFile("document.pdf"))).toBe(false);
        expect(canExportNoteToPdf(createFile("folder", true))).toBe(false);
    });

    test("builds the default PDF file name from the note basename", () => {
        expect(buildPdfFileName("note.md")).toBe("note.pdf");
        expect(buildPdfFileName("Research.markdown")).toBe("Research.pdf");
        expect(buildPdfFileName("Already.pdf")).toBe("Already.pdf");
    });

    test("maps heading positions into one-based PDF bookmark pages", () => {
        const bookmarks = buildPdfOutlineEntries(
            [
                { title: "Intro", level: 1, lineNumber: 1, kind: "markdown" },
                { title: "Details", level: 2, lineNumber: 8, kind: "markdown" },
                { title: "Appendix", level: 1, lineNumber: 30, kind: "markdown" },
            ],
            new Map([
                [1, 120],
                [8, EXPORT_PAGE_CONTENT_HEIGHT_PX + 20],
                [30, EXPORT_PAGE_CONTENT_HEIGHT_PX * 2 + 50],
            ])
        );

        expect(bookmarks).toEqual([
            { title: "Intro", level: 1, lineNumber: 1, page: 1, offsetWithinPagePx: 120 },
            { title: "Details", level: 2, lineNumber: 8, page: 2, offsetWithinPagePx: 20 },
            { title: "Appendix", level: 1, lineNumber: 30, page: 3, offsetWithinPagePx: 50 },
        ]);
    });

    test("keeps export typography fixed and independent from editor zoom", () => {
        expect(EXPORT_TYPOGRAPHY.bodyFontSizePx).toBe(16);
        expect(EXPORT_TYPOGRAPHY.titleFontSizePx).toBeGreaterThan(EXPORT_TYPOGRAPHY.bodyFontSizePx);
    });
});
