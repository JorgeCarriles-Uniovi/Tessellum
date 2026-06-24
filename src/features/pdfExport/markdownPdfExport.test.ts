import { beforeEach, describe, expect, test, vi } from "vitest";
import type { FileMetadata } from "../../types";
import { createMarkdownPdfExportService } from "./markdownPdfExport";

function createFile(filename: string): FileMetadata {
    return {
        path: `vault/${filename}`,
        filename,
        is_dir: false,
        size: 1,
        last_modified: 1,
    };
}

describe("markdownPdfExport", () => {
    const readFile = vi.fn<() => Promise<string>>();
    const saveDialog = vi.fn<() => Promise<string | null>>();
    const renderDocument = vi.fn<() => Promise<{
        html: string;
        documentTitle: string;
        outline: Array<{ title: string; level: number; lineNumber: number; page: number; offsetWithinPagePx: number }>;
    }>>();
    const exportPdf = vi.fn<() => Promise<void>>();
    const notifyPending = vi.fn<() => string | number>();
    const notifySuccess = vi.fn<(toastId: string | number) => void>();
    const notifyError = vi.fn<(toastId: string | number, error: unknown) => void>();

    beforeEach(() => {
        readFile.mockReset();
        saveDialog.mockReset();
        renderDocument.mockReset();
        exportPdf.mockReset();
        notifyPending.mockReset();
        notifyPending.mockReturnValue("toast-1");
        notifySuccess.mockReset();
        notifyError.mockReset();
    });

    test("opens the save dialog with the default pdf filename", async () => {
        saveDialog.mockResolvedValueOnce(null);
        const service = createMarkdownPdfExportService({
            readFile,
            saveDialog,
            renderDocument,
            exportPdf,
            notifyPending,
            notifySuccess,
            notifyError,
        });

        await service.exportNote(createFile("Project Plan.md"));

        expect(saveDialog).toHaveBeenCalledWith({
            defaultPath: "Project Plan.pdf",
            filters: [{ name: "PDF", extensions: ["pdf"] }],
        });
        expect(readFile).not.toHaveBeenCalled();
        expect(exportPdf).not.toHaveBeenCalled();
        expect(notifyPending).not.toHaveBeenCalled();
    });

    test("exports the rendered HTML and outline when the user confirms a destination", async () => {
        saveDialog.mockResolvedValueOnce("C:/exports/Project Plan.pdf");
        readFile.mockResolvedValueOnce("# Project Plan\n\n## Details");
        renderDocument.mockResolvedValueOnce({
            html: "<html>rendered</html>",
            documentTitle: "Project Plan",
            outline: [
                { title: "Project Plan", level: 1, lineNumber: 1, page: 1, offsetWithinPagePx: 0 },
                { title: "Details", level: 2, lineNumber: 3, page: 1, offsetWithinPagePx: 24 },
            ],
        });

        const service = createMarkdownPdfExportService({
            readFile,
            saveDialog,
            renderDocument,
            exportPdf,
            notifyPending,
            notifySuccess,
            notifyError,
        });

        await service.exportNote(createFile("Project Plan.md"));

        expect(readFile).toHaveBeenCalledWith("vault/Project Plan.md");
        expect(renderDocument).toHaveBeenCalledWith({
            content: "# Project Plan\n\n## Details",
            file: createFile("Project Plan.md"),
        });
        expect(exportPdf).toHaveBeenCalledWith({
            destinationPath: "C:/exports/Project Plan.pdf",
            documentTitle: "Project Plan",
            html: "<html>rendered</html>",
            outline: [
                { title: "Project Plan", level: 1, lineNumber: 1, page: 1, offsetWithinPagePx: 0 },
                { title: "Details", level: 2, lineNumber: 3, page: 1, offsetWithinPagePx: 24 },
            ],
        });
        expect(notifyPending).toHaveBeenCalled();
        expect(notifySuccess).toHaveBeenCalledWith("toast-1");
        expect(notifyError).not.toHaveBeenCalled();
    });

    test("surfaces export failures without reporting success", async () => {
        saveDialog.mockResolvedValueOnce("C:/exports/Project Plan.pdf");
        readFile.mockResolvedValueOnce("# Project Plan");
        renderDocument.mockResolvedValueOnce({
            html: "<html>rendered</html>",
            documentTitle: "Project Plan",
            outline: [],
        });
        const exportError = new Error("print failed");
        exportPdf.mockRejectedValueOnce(exportError);

        const service = createMarkdownPdfExportService({
            readFile,
            saveDialog,
            renderDocument,
            exportPdf,
            notifyPending,
            notifySuccess,
            notifyError,
        });

        await service.exportNote(createFile("Project Plan.md"));

        expect(notifyError).toHaveBeenCalledWith("toast-1", exportError);
        expect(notifySuccess).not.toHaveBeenCalled();
    });
});
