import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useEditorStore } from "../../../stores/editorStore";
import { useSelectionStore } from "../../../stores/selectionStore";
import { useUiStore } from "../../../stores/uiStore";
import { useVaultStore } from "../../../stores/vaultStore";
import { trackStores } from "../../../test/storeIsolation";
import { invokeMock } from "../../../test/tauriMocks";
import { useContextMenu } from "./useContextMenu";
import { useFileRename } from "./useFileRename";
import { useFileSync } from "./useFileSync";
import { useFileTreeActions } from "./useFileTreeActions";
import { useFileTreeDrag } from "./useFileTreeDrag";
import { useFolderCreation } from "./useFolderCreation";

const fileTreeMocks = vi.hoisted(() => ({
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    toastInfo: vi.fn(),
    createFolder: vi.fn(),
    createNote: vi.fn(),
    createNoteFromTemplate: vi.fn(),
    requestDelete: vi.fn(),
    cancelDelete: vi.fn(),
    confirmDelete: vi.fn(),
    renameInContext: vi.fn(),
    clipboardCopyPaths: vi.fn(),
    clipboardPasteInto: vi.fn(),
    resolveClipboardSelection: vi.fn(() => []),
    appEmit: vi.fn(),
}));

vi.mock("sonner", () => ({
    toast: {
        success: fileTreeMocks.toastSuccess,
        error: fileTreeMocks.toastError,
        info: fileTreeMocks.toastInfo,
    },
}));

vi.mock("../../Editor/hooks", () => ({
    useCreateFolder: () => fileTreeMocks.createFolder,
}));

vi.mock("../../Sidebar/hooks/useSidebarActions", () => ({
    useSidebarActions: () => ({
        createNote: fileTreeMocks.createNote,
        createNoteFromTemplate: fileTreeMocks.createNoteFromTemplate,
        deleteFile: {
            requestDelete: fileTreeMocks.requestDelete,
            cancelDelete: fileTreeMocks.cancelDelete,
            confirmDelete: fileTreeMocks.confirmDelete,
            isDeleteModalOpen: false,
            deleteTargets: [],
        },
        renameFile: fileTreeMocks.renameInContext,
    }),
}));

vi.mock("../../../features/clipboard/useClipboardFileCopy", () => ({
    useClipboardFileCopy: () => ({
        copyPaths: fileTreeMocks.clipboardCopyPaths,
    }),
}));

vi.mock("../../../features/clipboard/useClipboardFilePaste", () => ({
    useClipboardFilePaste: () => ({
        pasteInto: fileTreeMocks.clipboardPasteInto,
    }),
}));

vi.mock("../../../features/clipboard/clipboardSelection", () => ({
    resolveClipboardSelection: (...args: unknown[]) => fileTreeMocks.resolveClipboardSelection(...args),
}));

vi.mock("../../../plugins/TessellumApp", async () => {
    const actual = await vi.importActual<typeof import("../../../plugins/TessellumApp")>("../../../plugins/TessellumApp");
    return {
        ...actual,
        useTessellumApp: () => ({
            events: {
                emit: fileTreeMocks.appEmit,
            },
        }),
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

function createNode(path: string, isDir = true, children: Array<ReturnType<typeof createNode>> = []) {
    return {
        id: path,
        name: path.split("/").at(-1) ?? path,
        is_dir: isDir,
        children,
        file: createFile(path, isDir),
    };
}

describe("file tree logic", () => {
    beforeEach(() => {
        trackStores(useVaultStore, useUiStore, useSelectionStore, useEditorStore);
        vi.restoreAllMocks();
        fileTreeMocks.toastSuccess.mockReset();
        fileTreeMocks.toastError.mockReset();
        fileTreeMocks.toastInfo.mockReset();
        fileTreeMocks.createFolder.mockReset();
        fileTreeMocks.createNote.mockReset();
        fileTreeMocks.createNoteFromTemplate.mockReset();
        fileTreeMocks.requestDelete.mockReset();
        fileTreeMocks.cancelDelete.mockReset();
        fileTreeMocks.confirmDelete.mockReset();
        fileTreeMocks.renameInContext.mockReset();
        fileTreeMocks.clipboardCopyPaths.mockReset();
        fileTreeMocks.clipboardPasteInto.mockReset();
        fileTreeMocks.resolveClipboardSelection.mockReset();
        fileTreeMocks.resolveClipboardSelection.mockReturnValue([]);
        fileTreeMocks.appEmit.mockReset();
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
            files: [
                createFile("vault/a.md"),
                createFile("vault/folder", true),
                createFile("vault/folder/b.md"),
            ],
            fileTree: [createNode("vault/folder", true, [createNode("vault/folder/b.md", false, [])])],
            activeNote: createFile("vault/folder/b.md"),
            openTabPaths: ["vault/a.md", "vault/folder/b.md"],
        });
    });

    test("opens and closes the context menu with the clicked file target", () => {
        const { result } = renderHook(() => useContextMenu());
        const event = {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            clientX: 12,
            clientY: 34,
        } as never;
        const target = createFile("vault/a.md");

        act(() => {
            result.current.handleContextMenu(event, target);
        });
        expect(result.current.menuState).toEqual({
            x: 12,
            y: 34,
            target,
        });

        act(() => {
            result.current.closeMenu();
        });
        expect(result.current.menuState).toBeNull();
    });

    test("syncs selection, expands parent folders, and scrolls the active note into view", () => {
        const scrollIntoView = vi.fn();
        const activeElement = document.createElement("div");
        activeElement.dataset.path = "vault/folder/b.md";
        activeElement.scrollIntoView = scrollIntoView;
        document.body.appendChild(activeElement);
        vi.spyOn(document, "querySelector").mockReturnValue(activeElement);
        vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
            callback(0);
            return 1;
        });

        renderHook(() => useFileSync());

        expect(useSelectionStore.getState().selectedFilePaths).toEqual(["vault/folder/b.md"]);
        expect(useUiStore.getState().expandedFolders).toEqual({
            vault: true,
            "vault/folder": true,
        });
        expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "nearest" });
    });

    test("handles folder-creation modal state and confirms using the resolved parent path", async () => {
        const { result } = renderHook(() => useFolderCreation());

        act(() => {
            result.current.openForRoot();
        });
        expect(result.current.isOpen).toBe(true);

        act(() => {
            result.current.openForTarget(createFile("vault/folder/b.md"));
        });
        await act(async () => {
            await result.current.confirm("New Folder");
        });
        expect(fileTreeMocks.createFolder).toHaveBeenCalledWith("New Folder", "vault/folder");
        expect(result.current.isOpen).toBe(false);
    });

    test("renames file-tree targets and resets local modal state on success and close", async () => {
        const { result } = renderHook(() => useFileRename());
        const target = createFile("vault/folder/b.md");

        act(() => {
            result.current.open(target);
        });
        expect(result.current.isOpen).toBe(true);
        expect(result.current.getInitialValue()).toBe("b");

        invokeMock.mockResolvedValueOnce("vault/folder/renamed.md");
        await act(async () => {
            await result.current.confirm("renamed");
        });

        expect(useVaultStore.getState().files.some((file) => file.path === "vault/folder/renamed.md")).toBe(true);
        expect(fileTreeMocks.toastSuccess).toHaveBeenCalledWith("Renamed successfully");

        act(() => {
            result.current.close();
        });
        expect(result.current.target).toBeNull();
        expect(result.current.isOpen).toBe(false);
    });

    test("orchestrates file-tree context actions for create, rename, copy, and paste branches", async () => {
        const onOpenFolderModal = vi.fn();
        const onOpenRenameModal = vi.fn();
        fileTreeMocks.resolveClipboardSelection.mockReturnValue(["vault/folder/b.md"]);

        const { result } = renderHook(() => useFileTreeActions(onOpenFolderModal, onOpenRenameModal));
        const contextEvent = {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            clientX: 10,
            clientY: 20,
        } as never;
        const folderTarget = createFile("vault/folder", true);

        act(() => {
            result.current.handleContextMenu(contextEvent, folderTarget);
        });
        await act(async () => {
            await result.current.createNoteInContext();
            await result.current.createNoteFromTemplateInContext("template.md", "Title");
            await result.current.copyInContext();
            await result.current.pasteFilesInContext();
        });
        act(() => {
            result.current.handleContextMenu(contextEvent, folderTarget);
        });
        act(() => {
            result.current.createFolderInContext();
            result.current.renameInContext();
        });

        expect(fileTreeMocks.createNote).toHaveBeenCalledWith("vault/folder");
        expect(fileTreeMocks.createNoteFromTemplate).toHaveBeenCalledWith("template.md", "Title", "vault/folder");
        expect(fileTreeMocks.clipboardCopyPaths).toHaveBeenCalledWith(["vault/folder/b.md"]);
        expect(fileTreeMocks.clipboardPasteInto).toHaveBeenCalledWith("vault/folder");
        expect(onOpenFolderModal).toHaveBeenCalledWith(folderTarget);
        expect(onOpenRenameModal).toHaveBeenCalledWith(folderTarget);

        const fileTarget = createFile("vault/a.md");
        act(() => {
            result.current.handleContextMenu(contextEvent, fileTarget);
        });
        fileTreeMocks.resolveClipboardSelection.mockReturnValue([]);
        await act(async () => {
            await result.current.copyInContext();
            await result.current.pasteFilesInContext();
        });
        expect(fileTreeMocks.clipboardCopyPaths).toHaveBeenLastCalledWith(["vault/a.md"]);
        expect(fileTreeMocks.clipboardPasteInto).toHaveBeenCalledTimes(1);
    });

    test("prevents invalid drag moves and submits valid move requests", async () => {
        const folderNode = createNode("vault/folder", true, []);
        const { result } = renderHook(() => useFileTreeDrag([folderNode]));
        const treeItem = document.createElement("div");
        treeItem.dataset.path = "vault/folder";
        treeItem.setAttribute("role", "treeitem");
        treeItem.getBoundingClientRect = () => ({
            top: 0,
            height: 100,
        } as DOMRect);
        Object.defineProperty(document, "elementFromPoint", {
            configurable: true,
            value: vi.fn(() => treeItem),
        });

        act(() => {
            result.current.onDragStartIntent({
                button: 0,
                shiftKey: false,
                metaKey: false,
                ctrlKey: false,
                altKey: false,
                clientX: 0,
                clientY: 0,
            } as never, folderNode, false);
        });

        act(() => {
            window.dispatchEvent(new MouseEvent("mousemove", { clientX: 10, clientY: 50 }));
        });
        await act(async () => {
            window.dispatchEvent(new MouseEvent("mouseup", { clientX: 10, clientY: 50 }));
        });
        expect(fileTreeMocks.toastError).toHaveBeenCalledWith("Cannot move a folder into itself.");

        const fileNode = createNode("vault/a.md", false, []);
        const folderTarget = document.createElement("div");
        folderTarget.dataset.path = "vault/folder";
        folderTarget.setAttribute("role", "treeitem");
        folderTarget.getBoundingClientRect = () => ({
            top: 0,
            height: 100,
        } as DOMRect);
        Object.defineProperty(document, "elementFromPoint", {
            configurable: true,
            value: vi.fn(() => folderTarget),
        });
        act(() => {
            result.current.onDragStartIntent({
                button: 0,
                shiftKey: false,
                metaKey: false,
                ctrlKey: false,
                altKey: false,
                clientX: 0,
                clientY: 0,
            } as never, fileNode, false);
        });
        act(() => {
            window.dispatchEvent(new MouseEvent("mousemove", { clientX: 10, clientY: 50 }));
        });
        await act(async () => {
            window.dispatchEvent(new MouseEvent("mouseup", { clientX: 10, clientY: 50 }));
        });

        expect(invokeMock).toHaveBeenCalledWith("move_items", {
            vaultPath: "vault",
            itemPaths: ["vault/a.md"],
            destDir: "vault/folder",
        });
        expect(fileTreeMocks.toastSuccess).toHaveBeenCalledWith("Moved successfully");
    });

    test("maps the file-tree composition hook to the expected folder, rename, and context fields", async () => {
        vi.resetModules();
        vi.doMock("./useFolderCreation.ts", () => ({
            useFolderCreation: () => ({
                isOpen: true,
                openForRoot: vi.fn(),
                openForTarget: vi.fn(),
                confirm: vi.fn(),
                close: vi.fn(),
            }),
        }));
        vi.doMock("./useFileRename.ts", () => ({
            useFileRename: () => ({
                isOpen: true,
                target: createFile("vault/a.md"),
                open: vi.fn(),
                close: vi.fn(),
                confirm: vi.fn(),
                getInitialValue: vi.fn(() => "a"),
            }),
        }));
        vi.doMock("./useFileTreeActions.ts", () => ({
            useFileTreeActions: () => ({
                menuState: { x: 1, y: 2, target: createFile("vault/a.md") },
                handleContextMenu: vi.fn(),
                closeMenu: vi.fn(),
                createNote: vi.fn(),
                createNoteFromTemplate: vi.fn(),
                requestDelete: vi.fn(),
                cancelDelete: vi.fn(),
                confirmDelete: vi.fn(),
                isDeleteModalOpen: true,
                deleteTargets: [createFile("vault/a.md")],
                createNoteInContext: vi.fn(),
                createNoteFromTemplateInContext: vi.fn(),
                createFolderInContext: vi.fn(),
                renameInContext: vi.fn(),
                copyInContext: vi.fn(),
                pasteFilesInContext: vi.fn(),
            }),
        }));

        const { useFileTree } = await import("./useFileTree");
        const { result } = renderHook(() => useFileTree());

        expect(result.current).toMatchObject({
            isFolderModalOpen: true,
            isRenameModalOpen: true,
            isDeleteModalOpen: true,
            menuState: { x: 1, y: 2, target: createFile("vault/a.md") },
            deleteTargets: [createFile("vault/a.md")],
        });
    });
});
