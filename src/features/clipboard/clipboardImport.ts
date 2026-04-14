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

        try {
            const result = await importFromClipboard({
                vaultPath,
                destinationDir: resolvedDestination,
            });

            if (result.importedPaths.length === 0) {
                notifyError(resolvedMessages.clipboardMissingFiles);
                return false;
            }

            await refreshVault();
            notifySuccess(resolvedMessages.importedFiles(result.importedPaths.length, resolvedDestination));
            return true;
        } catch (error) {
            console.error(error);
            notifyError(resolvedMessages.pasteFailed);
            return false;
        }
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
