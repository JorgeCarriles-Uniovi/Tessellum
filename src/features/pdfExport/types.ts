import type { FileMetadata } from "../../types";

export interface PdfExportOutlineItem {
    title: string;
    level: number;
    lineNumber: number;
    page: number;
    offsetWithinPagePx: number;
}

export interface PdfExportRequest {
    destinationPath: string;
    documentTitle: string;
    html: string;
    outline: PdfExportOutlineItem[];
}

export interface MarkdownPdfRenderResult {
    html: string;
    documentTitle: string;
    outline: PdfExportOutlineItem[];
}

export interface MarkdownPdfRenderInput {
    file: FileMetadata;
    content: string;
}
