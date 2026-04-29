import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useGraphStore } from "../../stores/graphStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { useUiStore } from "../../stores/uiStore";
import { useVaultStore } from "../../stores/vaultStore";
import { trackStores } from "../../test/storeIsolation";
import type { FileMetadata, TreeNode } from "../../types";
import { FileNode } from "./FileNode";
import { FileTree } from "./FileTree";

const fileTreeComponentMocks = vi.hoisted(() => {
    const onDragStartIntent = vi.fn();

    return {
        onDragStartIntent,
        useFileTreeDrag: vi.fn(() => ({
            dragOver: { path: null, position: null },
            onDragStartIntent,
        })),
    };
});

vi.mock("./hooks/useFileTreeDrag", () => ({
    useFileTreeDrag: fileTreeComponentMocks.useFileTreeDrag,
}));

const scrollIntoViewMock = vi.fn();

function createFile(path: string, filename = path.split("/").at(-1) ?? path, isDir = false): FileMetadata {
    return {
        path,
        filename,
        is_dir: isDir,
        size: 1,
        last_modified: 1,
    };
}

function createNode(path: string, options?: Partial<TreeNode>): TreeNode {
    const isDir = options?.is_dir ?? false;
    const name = options?.name ?? path.split("/").at(-1) ?? path;

    return {
        id: path,
        name,
        is_dir: isDir,
        children: options?.children ?? [],
        file: options?.file ?? createFile(path, name, isDir),
    };
}

describe("file tree components", () => {
    beforeEach(() => {
        trackStores(useVaultStore, useUiStore, useSelectionStore, useGraphStore);
        fileTreeComponentMocks.onDragStartIntent.mockReset();
        fileTreeComponentMocks.useFileTreeDrag.mockReset();
        fileTreeComponentMocks.useFileTreeDrag.mockReturnValue({
            dragOver: { path: null, position: null },
            onDragStartIntent: fileTreeComponentMocks.onDragStartIntent,
        });
        Object.defineProperty(Element.prototype, "scrollIntoView", {
            configurable: true,
            value: scrollIntoViewMock,
        });
        Object.defineProperty(navigator, "platform", {
            configurable: true,
            value: "Win32",
        });
        useVaultStore.setState({
            vaultPath: "vault",
            files: [],
            fileTree: [],
            activeNote: null,
            openTabPaths: [],
        });
        useUiStore.setState({
            expandedFolders: {},
            isSidebarOpen: true,
            isRightSidebarOpen: true,
            isSearchOpen: false,
        });
        useSelectionStore.setState({
            selectedFilePaths: [],
            lastSelectedPath: null,
        });
        useGraphStore.setState({
            viewMode: "graph",
            isLocalGraphOpen: false,
            selectedGraphNode: null,
        });
    });

    test("opens files on click and toggles selection with the modifier key", () => {
        const node = createNode("vault/Note.md", { name: "Note.md" });
        const onContextMenu = vi.fn();

        render(
            <FileNode
                node={node}
                level={0}
                onContextMenu={onContextMenu}
                onDragStartIntent={fileTreeComponentMocks.onDragStartIntent}
                dragOverPath={null}
                dragOverPosition={null}
            />,
        );

        fireEvent.click(screen.getByRole("treeitem"));
        expect(useVaultStore.getState().activeNote?.path).toBe("vault/Note.md");
        expect(useSelectionStore.getState().selectedFilePaths).toEqual(["vault/Note.md"]);
        expect(useGraphStore.getState().viewMode).toBe("editor");

        useVaultStore.setState({ activeNote: null });
        fireEvent.click(screen.getByRole("treeitem"), { ctrlKey: true });
        expect(useSelectionStore.getState().selectedFilePaths).toEqual([]);
        expect(useVaultStore.getState().activeNote).toBeNull();
    });

    test("selects the item on context menu and supports directory keyboard expansion", () => {
        const emptyFolder = createNode("vault/Folder", { name: "Folder", is_dir: true, file: createFile("vault/Folder", "Folder", true) });
        const onContextMenu = vi.fn();

        render(
            <FileNode
                node={emptyFolder}
                level={0}
                onContextMenu={onContextMenu}
                onDragStartIntent={fileTreeComponentMocks.onDragStartIntent}
                dragOverPath={null}
                dragOverPosition={null}
            />,
        );

        const treeItem = screen.getByRole("treeitem");
        fireEvent.contextMenu(treeItem);
        expect(useSelectionStore.getState().selectedFilePaths).toEqual(["vault/Folder"]);
        expect(onContextMenu).toHaveBeenCalledWith(expect.any(Object), emptyFolder.file);

        fireEvent.keyDown(treeItem, { key: "ArrowRight" });
        expect(useUiStore.getState().expandedFolders["vault/Folder"]).toBe(true);

        fireEvent.keyDown(treeItem, { key: "ArrowLeft" });
        expect(useUiStore.getState().expandedFolders["vault/Folder"]).toBe(false);

        useUiStore.setState({
            expandedFolders: { "vault/Folder": true },
            isSidebarOpen: true,
            isRightSidebarOpen: true,
            isSearchOpen: false,
        });
        expect(screen.getByText("fileTree.empty")).toBeInTheDocument();

        fireEvent.keyDown(treeItem, { key: "Escape" });
        expect(useSelectionStore.getState().selectedFilePaths).toEqual([]);
    });

    test("range-selects visible nodes through the FileTree host", () => {
        const nodes = [
            createNode("vault/First.md", { name: "First.md" }),
            createNode("vault/Second.md", { name: "Second.md" }),
        ];

        render(<FileTree data={nodes} onContextMenu={vi.fn()} />);

        useSelectionStore.getState().selectOnly("vault/First.md");
        fireEvent.click(screen.getByText("Second"), { shiftKey: true });

        expect(useSelectionStore.getState().selectedFilePaths).toEqual([
            "vault/First.md",
            "vault/Second.md",
        ]);
    });

    test("forwards drag intent handling from FileTree to the rendered nodes", () => {
        const nodes = [createNode("vault/Drag.md", { name: "Drag.md" })];
        fileTreeComponentMocks.useFileTreeDrag.mockReturnValue({
            dragOver: { path: "vault/Drag.md", position: "inside" },
            onDragStartIntent: fileTreeComponentMocks.onDragStartIntent,
        });

        render(<FileTree data={nodes} onContextMenu={vi.fn()} />);

        const treeItem = screen.getByRole("treeitem");
        fireEvent.mouseDown(treeItem, { button: 0 });
        expect(fileTreeComponentMocks.onDragStartIntent).toHaveBeenCalledWith(
            expect.any(Object),
            expect.objectContaining({ id: "vault/Drag.md" }),
            false,
        );
        expect(screen.getByRole("tree")).toBeInTheDocument();
    });
});
