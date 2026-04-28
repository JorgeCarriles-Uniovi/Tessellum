import { beforeEach, describe, expect, test } from "vitest";
import { useEditorModeStore } from "./editorModeStore";
import { useGraphStore } from "./graphStore";
import { useSelectionStore } from "./selectionStore";
import { useUiStore } from "./uiStore";
import { trackStores } from "../test/storeIsolation";

describe("basic stores", () => {
    beforeEach(() => {
        trackStores(
            useEditorModeStore,
            useGraphStore,
            useSelectionStore,
            useUiStore,
        );
    });

    test("updates editor mode through its public action", () => {
        expect(useEditorModeStore.getState().editorMode).toBe("live-preview");

        useEditorModeStore.getState().setEditorMode("reading");

        expect(useEditorModeStore.getState().editorMode).toBe("reading");
    });

    test("clears graph node selection when changing view mode or toggling the local graph", () => {
        useGraphStore.getState().setSelectedGraphNode("notes/a.md");
        expect(useGraphStore.getState().selectedGraphNode).toBe("notes/a.md");

        useGraphStore.getState().setViewMode("graph");
        expect(useGraphStore.getState()).toMatchObject({
            viewMode: "graph",
            selectedGraphNode: null,
        });

        useGraphStore.getState().setSelectedGraphNode("notes/b.md");
        useGraphStore.getState().toggleLocalGraph();

        expect(useGraphStore.getState()).toMatchObject({
            isLocalGraphOpen: true,
            selectedGraphNode: null,
        });
    });

    test("supports single, toggle, range, and fallback selection flows", () => {
        useSelectionStore.getState().selectOnly("notes/a.md");
        expect(useSelectionStore.getState()).toMatchObject({
            selectedFilePaths: ["notes/a.md"],
            lastSelectedPath: "notes/a.md",
        });

        useSelectionStore.getState().toggleSelection("notes/b.md");
        expect(useSelectionStore.getState().selectedFilePaths).toEqual([
            "notes/a.md",
            "notes/b.md",
        ]);

        useSelectionStore.getState().toggleSelection("notes/a.md");
        expect(useSelectionStore.getState().selectedFilePaths).toEqual(["notes/b.md"]);

        useSelectionStore.getState().selectOnly("notes/a.md");
        useSelectionStore.getState().rangeSelect(
            ["notes/a.md", "notes/b.md", "notes/c.md"],
            "notes/c.md",
        );
        expect(useSelectionStore.getState().selectedFilePaths).toEqual([
            "notes/a.md",
            "notes/b.md",
            "notes/c.md",
        ]);

        useSelectionStore.getState().rangeSelect(["notes/x.md"], "notes/z.md");
        expect(useSelectionStore.getState()).toMatchObject({
            selectedFilePaths: ["notes/z.md"],
            lastSelectedPath: "notes/z.md",
        });

        useSelectionStore.getState().clearSelection();
        expect(useSelectionStore.getState()).toMatchObject({
            selectedFilePaths: [],
            lastSelectedPath: null,
        });
    });

    test("toggles folder and search ui state through explicit and implicit actions", () => {
        useUiStore.getState().toggleSidebar();
        useUiStore.getState().toggleRightSidebar();
        useUiStore.getState().toggleFolder("Inbox");
        useUiStore.getState().toggleFolder("Inbox", false);
        useUiStore.getState().openSearch();
        useUiStore.getState().toggleSearch();
        useUiStore.getState().closeSearch();
        useUiStore.getState().setExpandedFolders({ Archive: true });

        expect(useUiStore.getState()).toMatchObject({
            expandedFolders: { Archive: true },
            isSidebarOpen: false,
            isRightSidebarOpen: false,
            isSearchOpen: false,
        });
    });
});
