import { invoke } from "@tauri-apps/api/core";
import { useMemo } from "react";
import { toast } from "sonner";
import { useAppTranslation } from "../../i18n/react.tsx";
import { createClipboardFileImporter } from "./clipboardImport.ts";
import type { ClipboardImportRequest, ClipboardImportResult } from "./types.ts";

interface UseClipboardFilePasteOptions {
    vaultPath: string | null;
    refreshVault: () => void | Promise<void>;
}

export function useClipboardFilePaste({ vaultPath, refreshVault }: UseClipboardFilePasteOptions) {
    const { t } = useAppTranslation("core");

    return useMemo(() => createClipboardFileImporter({
        getVaultPath: () => vaultPath,
        importFromClipboard: (request: ClipboardImportRequest) => invoke<ClipboardImportResult>("import_clipboard_files", {
            vaultPath: request.vaultPath,
            destinationDir: request.destinationDir,
        }),
        refreshVault: async () => {
            await refreshVault();
        },
        notifySuccess: (message) => toast.success(message),
        notifyError: (message) => toast.error(message),
        messages: {
            openVaultFirst: t("clipboardPaste.errors.openVaultFirst"),
            clipboardMissingFiles: t("clipboardPaste.errors.noFiles"),
            pasteFailed: t("clipboardPaste.errors.failed"),
            importedFiles: (count, destinationDir) => t("clipboardPaste.success", { count, destinationDir }),
        },
    }), [refreshVault, t, vaultPath]);
}
