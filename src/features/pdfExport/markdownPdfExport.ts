import type { FileMetadata } from "../../types";
import { buildPdfFileName } from "./pdfExportDomain";
import type { MarkdownPdfRenderInput, MarkdownPdfRenderResult, PdfExportRequest } from "./types";

export type PdfExportToastId = string | number;

interface MarkdownPdfExportServiceDeps {
    readFile: (path: string) => Promise<string>;
    saveDialog: (options: {
        defaultPath: string;
        filters: Array<{ name: string; extensions: string[] }>;
    }) => Promise<string | null>;
    renderDocument: (input: MarkdownPdfRenderInput) => Promise<MarkdownPdfRenderResult>;
    exportPdf: (request: PdfExportRequest) => Promise<void>;
    notifyPending: () => PdfExportToastId;
    notifySuccess: (toastId: PdfExportToastId) => void;
    notifyError: (toastId: PdfExportToastId, error: unknown) => void;
}

export function createMarkdownPdfExportService({
    readFile,
    saveDialog,
    renderDocument,
    exportPdf,
    notifyPending,
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

        const toastId = notifyPending();

        try {
            const content = await readFile(file.path);
            const rendered = await renderDocument({ file, content });

            await exportPdf({
                destinationPath,
                documentTitle: rendered.documentTitle,
                html: rendered.html,
                outline: rendered.outline,
            });

            notifySuccess(toastId);
        } catch (error) {
            console.error(error);
            notifyError(toastId, error);
        }
    }

    return { exportNote };
}
