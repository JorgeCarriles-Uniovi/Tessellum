import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("sonner", () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock("../../i18n/react.tsx", () => ({
    useAppTranslation: () => ({
        t: (key: string, values?: Record<string, unknown>) => {
            if (key === "clipboardPaste.success") {
                return `Imported ${values?.count} into ${values?.destinationDir}`;
            }

            const messages: Record<string, string> = {
                "clipboardCopy.success": "Copied",
                "clipboardCopy.errors.failed": "Copy failed",
                "clipboardPaste.errors.openVaultFirst": "Open vault first",
                "clipboardPaste.errors.noFiles": "No files",
                "clipboardPaste.errors.failed": "Paste failed",
            };

            return messages[key] ?? key;
        },
    }),
}));

import { toast } from "sonner";
import { invokeMock } from "../../test/tauriMocks";
import { resolveClipboardSelection } from "./clipboardSelection";
import { buildAutoRenamedPath } from "./clipboardImportNaming";
import { shouldHandleClipboardFileCopyShortcut } from "./clipboardCopyShortcut";
import { createClipboardFileCopier } from "./clipboardFileCopy";
import { createClipboardFileImporter } from "./clipboardImport";
import { useClipboardFileCopy } from "./useClipboardFileCopy";
import { useClipboardFilePaste } from "./useClipboardFilePaste";

describe("clipboard domain logic", () => {
    beforeEach(() => {
        vi.mocked(toast.success).mockClear();
        vi.mocked(toast.error).mockClear();
    });

    test("resolves clipboard selection uniquely and removes descendants of selected folders", () => {
        const files = [
            { path: "Inbox", filename: "Inbox", is_dir: true, size: 0, last_modified: 1 },
            { path: "Inbox/Note.md", filename: "Note.md", is_dir: false, size: 1, last_modified: 1 },
            { path: "Other.md", filename: "Other.md", is_dir: false, size: 1, last_modified: 1 },
        ];

        expect(resolveClipboardSelection(files, ["Inbox", "Inbox/Note.md", "Other.md", "Other.md", "missing"])).toEqual([
            "Inbox",
            "Other.md",
        ]);
    });

    test("builds auto-renamed paths only when conflicts exist", () => {
        expect(buildAutoRenamedPath("Inbox", "Note.md", () => false)).toBe("Inbox/Note.md");

        const conflicts = new Set([
            "Inbox/Note.md",
            "Inbox/Note (1).md",
        ]);

        expect(buildAutoRenamedPath("Inbox", "Note.md", (candidate) => conflicts.has(candidate))).toBe(
            "Inbox/Note (2).md",
        );
        expect(buildAutoRenamedPath("Inbox/", "Archive", (candidate) => candidate === "Inbox/Archive")).toBe(
            "Inbox/Archive (1)",
        );
    });

    test("handles clipboard copy shortcuts only from file-tree surfaces", () => {
        expect(shouldHandleClipboardFileCopyShortcut(null)).toBe(false);
        expect(shouldHandleClipboardFileCopyShortcut({
            closest: (selector: string) => (selector === "[role=\"tree\"]" ? {} : null),
        })).toBe(true);
        expect(shouldHandleClipboardFileCopyShortcut({
            closest: () => null,
        })).toBe(false);
    });

    test("copies file paths through the injected native boundary", async () => {
        const nativeWritePaths = vi.fn().mockResolvedValue(undefined);
        const notifySuccess = vi.fn();
        const notifyError = vi.fn();
        const copier = createClipboardFileCopier({
            nativeWritePaths,
            notifySuccess,
            notifyError,
            messages: {
                copied: "Done",
            },
        });

        await expect(copier.copyPaths(["a.md", "b.md"])).resolves.toBe(true);
        expect(nativeWritePaths).toHaveBeenCalledWith(["a.md", "b.md"]);
        expect(notifySuccess).toHaveBeenCalledWith("Done");
        expect(notifyError).not.toHaveBeenCalled();
    });

    test("reports clipboard copy failures without throwing", async () => {
        const notifySuccess = vi.fn();
        const notifyError = vi.fn();
        const copier = createClipboardFileCopier({
            nativeWritePaths: vi.fn().mockRejectedValue(new Error("blocked")),
            notifySuccess,
            notifyError,
        });
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

        await expect(copier.copyPaths(["a.md"])).resolves.toBe(false);
        expect(notifySuccess).not.toHaveBeenCalled();
        expect(notifyError).toHaveBeenCalledWith("Failed to copy");

        consoleError.mockRestore();
    });

    test("imports clipboard files across success, empty, blocked, missing-vault, and failure branches", async () => {
        const notifySuccess = vi.fn();
        const notifyError = vi.fn();
        const refreshVault = vi.fn().mockResolvedValue(undefined);
        const importFromClipboard = vi.fn()
            .mockResolvedValueOnce({ importedPaths: ["Inbox/New.md"], skippedCount: 0 })
            .mockResolvedValueOnce({ importedPaths: [], skippedCount: 0 })
            .mockRejectedValueOnce(new Error("paste failed"));
        const importer = createClipboardFileImporter({
            getVaultPath: () => "Vault",
            importFromClipboard,
            refreshVault,
            notifySuccess,
            notifyError,
        });
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

        await expect(importer.pasteInto("Inbox")).resolves.toBe(true);
        expect(refreshVault).toHaveBeenCalledTimes(1);
        expect(notifySuccess).toHaveBeenCalledWith("Imported 1 item into Inbox");

        await expect(importer.pasteInto("Inbox")).resolves.toBe(false);
        expect(notifyError).toHaveBeenCalledWith("Clipboard does not contain files");

        await expect(importer.handleShortcutPaste({
            tagName: "INPUT",
            isContentEditable: false,
            closest: () => null,
        }, "Inbox")).resolves.toBe(false);

        await expect(importer.pasteInto("Inbox")).resolves.toBe(false);
        expect(notifyError).toHaveBeenCalledWith("Failed to paste files");
        expect(consoleError).toHaveBeenCalledTimes(1);

        const missingVaultImporter = createClipboardFileImporter({
            getVaultPath: () => null,
            importFromClipboard,
            refreshVault,
            notifySuccess,
            notifyError,
            messages: {
                openVaultFirst: "Open vault first",
            },
        });
        await expect(missingVaultImporter.pasteInto("Inbox")).resolves.toBe(false);
        expect(notifyError).toHaveBeenCalledWith("Open vault first");

        consoleError.mockRestore();
    });

    test("wraps the clipboard copy hook around invoke and translated toast messages", async () => {
        invokeMock.mockResolvedValueOnce(undefined);
        const { result } = renderHook(() => useClipboardFileCopy());

        await act(async () => {
            await result.current.copyPaths(["Inbox/Note.md"]);
        });

        expect(invokeMock).toHaveBeenCalledWith("write_file_paths_to_clipboard", {
            paths: ["Inbox/Note.md"],
        });
        expect(toast.success).toHaveBeenCalledWith("Copied");
    });

    test("wraps the clipboard paste hook around invoke, refresh, and translated notifications", async () => {
        const refreshVault = vi.fn().mockResolvedValue(undefined);
        invokeMock.mockResolvedValueOnce({
            importedPaths: ["Inbox/Imported.md"],
            skippedCount: 0,
        });
        const { result } = renderHook(() => useClipboardFilePaste({
            vaultPath: "Vault",
            refreshVault,
        }));

        await act(async () => {
            await result.current.handleShortcutPaste({
                tagName: "DIV",
                isContentEditable: false,
                closest: () => null,
            }, "Inbox");
        });

        expect(invokeMock).toHaveBeenCalledWith("import_clipboard_files", {
            vaultPath: "Vault",
            destinationDir: "Inbox",
        });
        expect(refreshVault).toHaveBeenCalledTimes(1);
        expect(toast.success).toHaveBeenCalledWith("Imported 1 into Inbox");
    });
});
