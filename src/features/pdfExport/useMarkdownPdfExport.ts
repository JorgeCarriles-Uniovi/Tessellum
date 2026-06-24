import { useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { useAppTranslation } from "../../i18n/react";
import { useTessellumApp } from "../../plugins/TessellumApp";
import { useVaultStore } from "../../stores/vaultStore";
import { getErrorMessage } from "../../utils/errorMessage";
import type { FileMetadata } from "../../types";
import { createMarkdownPdfExportService } from "./markdownPdfExport";
import { renderMarkdownPdfDocument } from "./markdownPdfRenderer";
import type { PdfExportRequest } from "./types";

export function useMarkdownPdfExport() {
    const app = useTessellumApp();
    const { t } = useAppTranslation("core");
    const vaultPath = useVaultStore((state) => state.vaultPath);
    const isExportingRef = useRef(false);

    const service = useMemo(
        () =>
            createMarkdownPdfExportService({
                readFile: (path) => app.vault.readFile(path),
                saveDialog: (options) => save(options),
                renderDocument: (input) => renderMarkdownPdfDocument({ ...input, vaultPath }),
                exportPdf: (request: PdfExportRequest) => invoke("export_markdown_pdf", { request }),
                notifyPending: () => toast.loading(t("pdfExport.pending")),
                notifySuccess: (toastId) => toast.success(t("pdfExport.success"), { id: toastId }),
                notifyError: (toastId, error) =>
                    toast.error(getErrorMessage(error, t("pdfExport.error")), { id: toastId }),
            }),
        [app, t, vaultPath]
    );

    return useMemo(
        () => ({
            // Guard against re-entrant exports while a headless render is in flight.
            exportNote: async (file: FileMetadata) => {
                if (isExportingRef.current) {
                    return;
                }

                isExportingRef.current = true;
                try {
                    await service.exportNote(file);
                } finally {
                    isExportingRef.current = false;
                }
            },
        }),
        [service]
    );
}
