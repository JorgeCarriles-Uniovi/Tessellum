import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useEditorStore } from "../../../stores/editorStore";
import { useSelectionStore } from "../../../stores/selectionStore";
import { useUiStore } from "../../../stores/uiStore";
import { useVaultStore } from "../../../stores/vaultStore";
import { trackStores } from "../../../test/storeIsolation";
import { invokeMock } from "../../../test/tauriMocks";
import { useCreateNote } from "./useCreateNote";
import { useCreateNoteFromTemplate } from "./useCreateNoteFromTemplate";
import { useDeleteFile } from "./useDeleteFile";
import { useRenameFile } from "./useRenameFile";
import { useSidebarActions } from "./useSidebarActions";

const sidebarHookMocks = vi.hoisted(() => ({
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    createNoteInDir: vi.fn(),
    createNoteFromTemplateInDir: vi.fn(),
}));

vi.mock("sonner", () => ({
    toast: {
        success: sidebarHookMocks.toastSuccess,
        error: sidebarHookMocks.toastError,
    },
}));

vi.mock("../../../utils/noteUtils", async () => {
    const actual = await vi.importActual<typeof import("../../../utils/noteUtils")>("../../../utils/noteUtils");
    return {
        ...actual,
        createNoteInDir: sidebarHookMocks.createNoteInDir,
        createNoteFromTemplateInDir: sidebarHookMocks.createNoteFromTemplateInDir,
    };
});

function createFile(path: string, isDir = false) {
    return {
        path,
        filename: path.split("/").at(-1) ?? path,
        is_dir: isDir,
        size: 1,
        last_modified: 1,
    };
}

function createNode(path: string, children: Array<ReturnType<typeof createNode>> = []) {
    return {
        id: path,
        name: path.split("/").at(-1) ?? path,
        is_dir: true,
        children,
        file: createFile(path, true),
    };
}

describe("sidebar hooks", () => {
    beforeEach(() => {
        trackStores(useVaultStore, useUiStore, useSelectionStore, useEditorStore);
        vi.restoreAllMocks();
        sidebarHookMocks.toastSuccess.mockReset();
        sidebarHookMocks.toastError.mockReset();
        sidebarHookMocks.createNoteInDir.mockReset();
        sidebarHookMocks.createNoteFromTemplateInDir.mockReset();
        invokeMock.mockReset();
        invokeMock.mockResolvedValue(undefined);
        useUiStore.setState({
            expandedFolders: {},
            isSidebarOpen: true,
            isRightSidebarOpen: true,
            isSearchOpen: false,
            setExpandedFolders: useUiStore.getState().setExpandedFolders,
            toggleSidebar: useUiStore.getState().toggleSidebar,
            toggleRightSidebar: useUiStore.getState().toggleRightSidebar,
            toggleFolder: useUiStore.getState().toggleFolder,
            openSearch: useUiStore.getState().openSearch,
            closeSearch: useUiStore.getState().closeSearch,
            toggleSearch: useUiStore.getState().toggleSearch,
        });
        useSelectionStore.setState({
            selectedFilePaths: [],
            lastSelectedPath: null,
            setSelectedFilePaths: useSelectionStore.getState().setSelectedFilePaths,
            selectOnly: useSelectionStore.getState().selectOnly,
            toggleSelection: useSelectionStore.getState().toggleSelection,
            rangeSelect: useSelectionStore.getState().rangeSelect,
            clearSelection: useSelectionStore.getState().clearSelection,
        });
        useVaultStore.setState({
            vaultPath: "vault",
            files: [createFile("vault/a.md"), createFile("vault/b.md"), createFile("vault/folder", true), createFile("vault/folder/c.md")],
            fileTree: [
                createNode("vault/folder", [
                    {
                        id: "vault/folder/c.md",
                        name: "c.md",
                        is_dir: false,
                        children: [],
                        file: createFile("vault/folder/c.md"),
                    },
                ]),
            ],
            activeNote: createFile("vault/b.md"),
            openTabPaths: ["vault/a.md", "vault/b.md", "vault/folder/c.md"],
        });
    });

    test("creates notes in the selected directory and reports missing targets", async () => {
        const { result } = renderHook(() => useCreateNote());

        act(() => {
            useVaultStore.getState().setVaultPath(null);
        });
        await act(async () => {
            await result.current(undefined, "Untitled");
        });
        expect(sidebarHookMocks.toastError).toHaveBeenCalledWith("No folder selected");

        sidebarHookMocks.createNoteInDir.mockResolvedValueOnce(createFile("vault/folder/New.md"));
        act(() => {
            useVaultStore.getState().setVaultPath("vault");
        });
        await act(async () => {
            await result.current("vault/folder", "New");
        });

        expect(sidebarHookMocks.createNoteInDir).toHaveBeenCalledWith("vault/folder", "New");
        expect(useUiStore.getState().expandedFolders["vault/folder"]).toBe(true);
        expect(useVaultStore.getState().activeNote?.path).toBe("vault/folder/New.md");
        expect(sidebarHookMocks.toastSuccess).toHaveBeenCalledWith("New note created");
    });

    test("creates notes from templates with title validation and parent expansion", async () => {
        const { result } = renderHook(() => useCreateNoteFromTemplate());

        await act(async () => {
            await result.current("template.md", "   ", "vault/folder");
        });
        expect(sidebarHookMocks.toastError).toHaveBeenCalledWith("Title cannot be empty");

        sidebarHookMocks.createNoteFromTemplateInDir.mockResolvedValueOnce(createFile("vault/folder/From Template.md"));
        await act(async () => {
            await result.current("template.md", "From Template", "vault/folder");
        });

        expect(sidebarHookMocks.createNoteFromTemplateInDir).toHaveBeenCalledWith(
            "vault",
            "vault/folder",
            "template.md",
            "From Template",
        );
        expect(useVaultStore.getState().activeNote?.path).toBe("vault/folder/From Template.md");
        expect(useUiStore.getState().expandedFolders["vault/folder"]).toBe(true);
        expect(sidebarHookMocks.toastSuccess).toHaveBeenCalledWith("New note created from template");
    });

    test("renames files through the editor facade and reports backend failures", async () => {
        const { result } = renderHook(() => useRenameFile());
        const target = createFile("vault/b.md");

        await act(async () => {
            await result.current(target, "b.md");
        });
        expect(invokeMock).not.toHaveBeenCalled();

        invokeMock.mockResolvedValueOnce("vault/renamed.md");
        await act(async () => {
            await result.current(target, "renamed");
        });

        expect(invokeMock).toHaveBeenCalledWith("rename_file", {
            vaultPath: "vault",
            oldPath: "vault/b.md",
            newName: "renamed",
        });
        expect(useVaultStore.getState().files.some((file) => file.path === "vault/renamed.md")).toBe(true);
        expect(useVaultStore.getState().activeNote?.path).toBe("vault/renamed.md");
        expect(sidebarHookMocks.toastSuccess).toHaveBeenCalledWith("Renamed successfully");

        invokeMock.mockRejectedValueOnce("Rename failed");
        await act(async () => {
            await result.current(createFile("vault/a.md"), "broken");
        });
        expect(sidebarHookMocks.toastError).toHaveBeenCalledWith("Rename failed");
    });

    test("requests, cancels, and confirms delete operations with selection-aware targeting", async () => {
        useSelectionStore.getState().setSelectedFilePaths(["vault/folder", "vault/folder/c.md"]);
        const { result } = renderHook(() => useDeleteFile());

        act(() => {
            result.current.requestDelete(createFile("vault/folder", true));
        });
        expect(result.current.isDeleteModalOpen).toBe(true);
        expect(result.current.deleteTargets.map((target) => target.path)).toEqual(["vault/folder"]);

        act(() => {
            result.current.cancelDelete();
        });
        expect(result.current.isDeleteModalOpen).toBe(false);

        act(() => {
            result.current.requestDelete(createFile("vault/b.md"));
        });

        invokeMock.mockResolvedValueOnce({
            deleted_paths: ["vault/b.md"],
            failed: [],
        });
        await act(async () => {
            await result.current.confirmDelete();
        });

        expect(invokeMock).toHaveBeenCalledWith("trash_items", {
            itemPaths: ["vault/b.md"],
            vaultPath: "vault",
        });
        expect(useVaultStore.getState().files.some((file) => file.path === "vault/b.md")).toBe(false);
        expect(useVaultStore.getState().activeNote?.path).toBe("vault/a.md");
        expect(useSelectionStore.getState().selectedFilePaths).toEqual([]);
        expect(sidebarHookMocks.toastSuccess).toHaveBeenCalledWith("Moved to trash");
    });

    test("surfaces delete failures and empty delete results", async () => {
        const { result } = renderHook(() => useDeleteFile());
        act(() => {
            result.current.requestDelete(createFile("vault/a.md"));
        });

        invokeMock.mockResolvedValueOnce({
            deleted_paths: [],
            failed: [{ item_path: "vault/a.md", message: "Permission denied" }],
        });
        await act(async () => {
            await result.current.confirmDelete();
        });
        expect(sidebarHookMocks.toastError).toHaveBeenCalledWith("Permission denied: a.md");

        act(() => {
            result.current.requestDelete(createFile("vault/a.md"));
        });
        invokeMock.mockResolvedValueOnce({
            deleted_paths: [],
            failed: [],
        });
        await act(async () => {
            await result.current.confirmDelete();
        });
        expect(sidebarHookMocks.toastError).toHaveBeenCalledWith("No items were moved to trash");
    });

    test("exposes the composed sidebar actions hook", () => {
        const { result } = renderHook(() => useSidebarActions());

        expect(typeof result.current.createNote).toBe("function");
        expect(typeof result.current.createNoteFromTemplate).toBe("function");
        expect(typeof result.current.renameFile).toBe("function");
        expect(result.current.deleteFile).toMatchObject({
            isDeleteModalOpen: false,
        });
    });
});
