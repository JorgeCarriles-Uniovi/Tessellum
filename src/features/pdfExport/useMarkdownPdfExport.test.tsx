import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { invokeMock, resetTauriMocks, saveDialogMock } from "../../test/tauriMocks";
import { useMarkdownPdfExport } from "./useMarkdownPdfExport";

const pdfExportHookMocks = vi.hoisted(() => ({
    readFile: vi.fn<() => Promise<string>>(),
    renderDocument: vi.fn<() => Promise<{
        html: string;
        documentTitle: string;
        outline: Array<{ title: string; level: number; lineNumber: number; page: number; offsetWithinPagePx: number }>;
    }>>(),
    toastSuccess: vi.fn<(message: string) => void>(),
    toastError: vi.fn<(message: string) => void>(),
}));

vi.mock("../../plugins/TessellumApp", async () => {
    const actual = await vi.importActual<typeof import("../../plugins/TessellumApp")>("../../plugins/TessellumApp");
    return {
        ...actual,
        useTessellumApp: () => ({
            vault: {
                readFile: pdfExportHookMocks.readFile,
            },
        }),
    };
});

vi.mock("./markdownPdfRenderer", () => ({
    renderMarkdownPdfDocument: (input: unknown) => pdfExportHookMocks.renderDocument(input),
}));

vi.mock("sonner", () => ({
    toast: {
        success: pdfExportHookMocks.toastSuccess,
        error: pdfExportHookMocks.toastError,
    },
}));

describe("useMarkdownPdfExport", () => {
    beforeEach(() => {
        resetTauriMocks();
        pdfExportHookMocks.readFile.mockReset();
        pdfExportHookMocks.renderDocument.mockReset();
        pdfExportHookMocks.toastSuccess.mockReset();
        pdfExportHookMocks.toastError.mockReset();
    });

    test("connects the dialog, renderer, vault read, and backend export command", async () => {
        saveDialogMock.mockResolvedValueOnce("C:/exports/Plan.pdf");
        pdfExportHookMocks.readFile.mockResolvedValueOnce("# Plan");
        pdfExportHookMocks.renderDocument.mockResolvedValueOnce({
            html: "<html>Plan</html>",
            documentTitle: "Plan",
            outline: [{ title: "Plan", level: 1, lineNumber: 1, page: 1, offsetWithinPagePx: 0 }],
        });

        const { result } = renderHook(() => useMarkdownPdfExport());

        await act(async () => {
            await result.current.exportNote({
                path: "vault/Plan.md",
                filename: "Plan.md",
                is_dir: false,
                size: 1,
                last_modified: 1,
            });
        });

        expect(saveDialogMock).toHaveBeenCalled();
        expect(pdfExportHookMocks.readFile).toHaveBeenCalledWith("vault/Plan.md");
        expect(invokeMock).toHaveBeenCalledWith("export_markdown_pdf", {
            request: {
                destinationPath: "C:/exports/Plan.pdf",
                documentTitle: "Plan",
                html: "<html>Plan</html>",
                outline: [{ title: "Plan", level: 1, lineNumber: 1, page: 1, offsetWithinPagePx: 0 }],
            },
        });
        expect(pdfExportHookMocks.toastSuccess).toHaveBeenCalled();
        expect(pdfExportHookMocks.toastError).not.toHaveBeenCalled();
    });
});
