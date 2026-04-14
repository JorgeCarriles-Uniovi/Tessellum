import { invoke } from "@tauri-apps/api/core";
import { useMemo } from "react";
import { toast } from "sonner";
import { useAppTranslation } from "../../i18n/react.tsx";
import { createClipboardFileCopier } from "./clipboardFileCopy.ts";

export function useClipboardFileCopy() {
    const { t } = useAppTranslation("core");

    return useMemo(() => createClipboardFileCopier({
        nativeWritePaths: (paths: string[]) => invoke("write_file_paths_to_clipboard", { paths }),
        notifySuccess: (message) => toast.success(message),
        notifyError: (message) => toast.error(message),
        messages: {
            copied: t("clipboardCopy.success"),
            failed: t("clipboardCopy.errors.failed"),
        },
    }), [t]);
}
