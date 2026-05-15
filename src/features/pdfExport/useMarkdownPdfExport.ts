import { useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { useAppTranslation } from "../../i18n/react";
import { useTessellumApp } from "../../plugins/TessellumApp";
import { createMarkdownPdfExportService } from "./markdownPdfExport";
import { renderMarkdownPdfDocument } from "./markdownPdfRenderer";
import type { PdfExportRequest } from "./types";

export function useMarkdownPdfExport() {
    const app = useTessellumApp();
    const { t } = useAppTranslation("core");

    return useMemo(
        () =>
            createMarkdownPdfExportService({
                readFile: (path) => app.vault.readFile(path),
                saveDialog: (options) => save(options),
                renderDocument: renderMarkdownPdfDocument,
                exportPdf: (request: PdfExportRequest) => invoke("export_markdown_pdf", { request }),
                notifySuccess: (message) => toast.success(t("pdfExport.success", { defaultValue: message })),
                notifyError: (message) => toast.error(t("pdfExport.error", { defaultValue: message })),
            }),
        [app, t]
    );
}
