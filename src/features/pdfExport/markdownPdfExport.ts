import type { FileMetadata } from "../../types";
import { buildPdfFileName } from "./pdfExportDomain";
import type { MarkdownPdfRenderInput, MarkdownPdfRenderResult, PdfExportRequest } from "./types";

interface MarkdownPdfExportServiceDeps {
    readFile: (path: string) => Promise<string>;
    saveDialog: (options: {
        defaultPath: string;
        filters: Array<{ name: string; extensions: string[] }>;
    }) => Promise<string | null>;
    renderDocument: (input: MarkdownPdfRenderInput) => Promise<MarkdownPdfRenderResult>;
    exportPdf: (request: PdfExportRequest) => Promise<void>;
    notifySuccess: (message: string) => void;
    notifyError: (message: string) => void;
}

export function createMarkdownPdfExportService({
    readFile,
    saveDialog,
    renderDocument,
    exportPdf,
    notifySuccess,
    notifyError,
}: MarkdownPdfExportServiceDeps) {
    async function exportNote(file: FileMetadata): Promise<void> {
        const destinationPath = await saveDialog({
            defaultPath: buildPdfFileName(file.filename),
            filters: [{ name: "PDF", extensions: ["pdf"] }],
        });

        if (!destinationPath) {
            return;
        }

        try {
            const content = await readFile(file.path);
            const rendered = await renderDocument({ file, content });

            await exportPdf({
                destinationPath,
                documentTitle: rendered.documentTitle,
                html: rendered.html,
                outline: rendered.outline,
            });

            notifySuccess("PDF exported");
        } catch (error) {
            console.error(error);
            notifyError("Failed to export PDF");
        }
    }

    return { exportNote };
}
