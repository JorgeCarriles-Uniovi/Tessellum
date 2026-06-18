import type { ClipboardImportRequest, ClipboardImportResult, ClipboardPasteTarget } from "./types.ts";

interface ClipboardFileImporterDependencies {
    getVaultPath: () => string | null;
    importFromClipboard: (request: ClipboardImportRequest) => Promise<ClipboardImportResult>;
    refreshVault: () => Promise<void>;
    notifySuccess: (message: string) => void;
    notifyError: (message: string) => void;
    messages?: Partial<ClipboardImporterMessages>;
}

interface ClipboardImporterMessages {
    openVaultFirst: string;
    clipboardMissingFiles: string;
    pasteFailed: string;
    importedFiles: (count: number, destinationDir: string) => string;
}

const DEFAULT_MESSAGES: ClipboardImporterMessages = {
    openVaultFirst: "Open a vault first",
    clipboardMissingFiles: "Clipboard does not contain files",
    pasteFailed: "Failed to paste files",
    importedFiles: (count, destinationDir) => {
        const noun = count === 1 ? "item" : "items";
        return `Imported ${count} ${noun} into ${destinationDir}`;
    },
};

function isBlockedShortcutTarget(target: ClipboardPasteTarget | null | undefined): boolean {
    if (!target) {
        return false;
    }

    const tagName = target.tagName?.toUpperCase();
    const isTextInput = tagName === "INPUT" || tagName === "TEXTAREA" || target.isContentEditable;
    const isEditorTarget = Boolean(target.closest?.(".cm-editor"));

    return isTextInput || isEditorTarget;
}

export function createClipboardFileImporter({
                                                getVaultPath,
                                                importFromClipboard,
                                                refreshVault,
                                                notifySuccess,
                                                notifyError,
                                                messages,
                                            }: ClipboardFileImporterDependencies) {
    const resolvedMessages: ClipboardImporterMessages = {
        ...DEFAULT_MESSAGES,
        ...messages,
    };

    const pasteInto = async (destinationDir?: string): Promise<boolean> => {
        const vaultPath = getVaultPath();
        if (!vaultPath) {
            notifyError(resolvedMessages.openVaultFirst);
            return false;
        }

        const resolvedDestination = destinationDir ?? vaultPath;

        let result;
        try {
            result = await importFromClipboard({
                vaultPath,
                destinationDir: resolvedDestination,
            });
        } catch (error) {
            console.error(error);
            notifyError(resolvedMessages.pasteFailed);
            return false;
        }

        if (result.importedPaths.length === 0) {
            notifyError(resolvedMessages.clipboardMissingFiles);
            return false;
        }

        // Report the import outcome before attempting vault refresh so that a
        // refresh failure doesn't mask a successful import.
        const skipped = result.skippedCount ?? 0;
        const summary = skipped > 0
            ? `${resolvedMessages.importedFiles(result.importedPaths.length, resolvedDestination)} (${skipped} skipped)`
            : resolvedMessages.importedFiles(result.importedPaths.length, resolvedDestination);
        notifySuccess(summary);

        try {
            await refreshVault();
        } catch (refreshError) {
            console.error("Vault refresh failed after import:", refreshError);
        }

        return true;
    };

    const handleShortcutPaste = async (target: ClipboardPasteTarget | null | undefined, destinationDir?: string) => {
        if (isBlockedShortcutTarget(target)) {
            return false;
        }

        return pasteInto(destinationDir);
    };

    return {
        pasteInto,
        handleShortcutPaste,
        shouldHandleShortcutPaste: (target: ClipboardPasteTarget | null | undefined) => !isBlockedShortcutTarget(target),
    };
}
