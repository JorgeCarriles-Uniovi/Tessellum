import { useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { useAppTranslation } from "../../i18n/react";
import { useTessellumApp } from "../../plugins/TessellumApp";
import { useVaultStore } from "../../stores/vaultStore";
import { createMarkdownPdfExportService } from "./markdownPdfExport";
import { renderMarkdownPdfDocument } from "./markdownPdfRenderer";
import type { PdfExportRequest } from "./types";

export function useMarkdownPdfExport() {
    const app = useTessellumApp();
    const { t } = useAppTranslation("core");
    const vaultPath = useVaultStore((state) => state.vaultPath);

    return useMemo(
        () =>
            createMarkdownPdfExportService({
                readFile: (path) => app.vault.readFile(path),
                saveDialog: (options) => save(options),
                renderDocument: (input) => renderMarkdownPdfDocument({ ...input, vaultPath }),
                exportPdf: (request: PdfExportRequest) => invoke("export_markdown_pdf", { request }),
                notifySuccess: (message) => toast.success(t("pdfExport.success", { defaultValue: message })),
                notifyError: (message) => toast.error(t("pdfExport.error", { defaultValue: message })),
            }),
        [app, t, vaultPath]
    );
}
