import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useEditorContentStore } from "../../stores/editorContentStore";
import { useEditorStore } from "../../stores/editorStore";
import { useUiStore } from "../../stores/uiStore";
import { useVaultStore } from "../../stores/vaultStore";
import { trackStores } from "../../test/storeIsolation";
import { dirnameMock, invokeMock } from "../../test/tauriMocks";
import { TessellumApp } from "../../plugins/TessellumApp";
import { useCreateFolder } from "./hooks/useCreateFolder";
import { useEditorActions, useFileSynchronization } from "./hooks/useEditorActions";
import { useEditorFontZoom } from "./hooks/useEditorFontZoom";
import { useNoteRenaming } from "./hooks/useNoteRenaming";
import { useWikiLinkNavigation } from "./hooks/useWikiLinkNavigation";

const editorHookMocks = vi.hoisted(() => ({
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    createNoteInDir: vi.fn(),
    clearWikiLinkCacheEffectOf: vi.fn(() => "clear-wikilink-cache"),
}));

vi.mock("sonner", () => ({
    toast: {
        success: editorHookMocks.toastSuccess,
        error: editorHookMocks.toastError,
    },
}));

vi.mock("../../utils/noteUtils", async () => {
    const actual = await vi.importActual<typeof import("../../utils/noteUtils")>("../../utils/noteUtils");
    return {
        ...actual,
        createNoteInDir: editorHookMocks.createNoteInDir,
    };
});

vi.mock("./extensions/wikilink/wikiLink-plugin", () => ({
    clearWikiLinkCacheEffect: {
        of: editorHookMocks.clearWikiLinkCacheEffectOf,
    },
}));

function createFile(path: string) {
    return {
        path,
        filename: path.split("/").at(-1) ?? path,
        is_dir: false,
        size: 1,
        last_modified: 1,
    };
}

function resetAppSingleton() {
    (TessellumApp as unknown as { _instance: TessellumApp | null })._instance = null;
}

describe("editor runtime hooks", () => {
    beforeEach(() => {
        trackStores(useVaultStore, useUiStore, useEditorContentStore, useEditorStore);
        vi.useFakeTimers();
        vi.restoreAllMocks();
        editorHookMocks.toastSuccess.mockReset();
        editorHookMocks.toastError.mockReset();
        editorHookMocks.createNoteInDir.mockReset();
        editorHookMocks.clearWikiLinkCacheEffectOf.mockReset();
        editorHookMocks.clearWikiLinkCacheEffectOf.mockReturnValue("clear-wikilink-cache");
        resetAppSingleton();
        invokeMock.mockReset();
        invokeMock.mockResolvedValue(undefined);
        dirnameMock.mockImplementation(async (path: string) => path.split("/").slice(0, -1).join("/"));
        useVaultStore.setState({
            vaultPath: "vault",
            files: [createFile("vault/Note.md"), createFile("vault/image.png")],
            fileTree: [],
            activeNote: createFile("vault/Note.md"),
            openTabPaths: ["vault/Note.md"],
        });
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
        useEditorContentStore.setState({
            activeNoteContent: "",
            isDirty: false,
            editorFontSizePx: 16,
        });
    });

    test("zooms the editor font with modifier-wheel and resets it with the keyboard shortcut", () => {
        const editorRoot = document.createElement("div");
        const child = document.createElement("span");
        editorRoot.appendChild(child);
        document.body.appendChild(editorRoot);
        Object.defineProperty(navigator, "platform", {
            configurable: true,
            value: "Win32",
        });
        const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
        const cancelRafSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
        const editorRef = {
            current: {
                view: {
                    dom: editorRoot,
                },
            },
        } as never;

        const { unmount } = renderHook(() => useEditorFontZoom(editorRef));

        const wheelEvent = new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            ctrlKey: true,
            deltaY: -100,
        });
        Object.defineProperty(wheelEvent, "target", {
            configurable: true,
            value: child,
        });
        act(() => {
            window.dispatchEvent(wheelEvent);
        });
        expect(useEditorContentStore.getState().editorFontSizePx).toBe(17);

        act(() => {
            editorRoot.focus();
        });
        Object.defineProperty(document, "activeElement", {
            configurable: true,
            value: child,
        });

        window.dispatchEvent(new KeyboardEvent("keydown", {
            key: "0",
            ctrlKey: true,
        }));
        expect(useEditorContentStore.getState().editorFontSizePx).toBe(16);

        window.dispatchEvent(new KeyboardEvent("keydown", {
            key: "0",
            ctrlKey: false,
        }));
        expect(useEditorContentStore.getState().editorFontSizePx).toBe(16);

        unmount();
        expect(rafSpy).toHaveBeenCalled();
        expect(cancelRafSpy).toHaveBeenCalledWith(1);
    });

    test("creates folders, expands the parent, and reports backend errors", async () => {
        invokeMock.mockResolvedValueOnce("vault/projects/New Folder");
        const { result } = renderHook(() => useCreateFolder());

        await act(async () => {
            await result.current("New Folder", "vault/projects");
        });

        expect(invokeMock).toHaveBeenCalledWith("create_folder", {
            vaultPath: "vault/projects",
            folderName: "New Folder",
        });
        expect(useVaultStore.getState().files.some((file) => file.path === "vault/projects/New Folder")).toBe(true);
        expect(useUiStore.getState().expandedFolders["vault/projects"]).toBe(true);
        expect(editorHookMocks.toastSuccess).toHaveBeenCalledWith("Folder created");

        invokeMock.mockRejectedValueOnce(new Error("Folder exists"));
        await act(async () => {
            await result.current("Duplicate", "vault/projects");
        });
        expect(editorHookMocks.toastError).toHaveBeenCalledWith("Folder exists");
    });

    test("tracks note renaming input, ignores unchanged values, and reverts on rename errors", async () => {
        const { result } = renderHook(() => useNoteRenaming());

        expect(result.current.titleInput).toBe("Note");

        await act(async () => {
            await result.current.handleRename();
        });
        expect(invokeMock).not.toHaveBeenCalled();

        invokeMock.mockResolvedValueOnce("vault/Renamed.md");
        await act(async () => {
            result.current.setTitleInput("Renamed");
        });
        await act(async () => {
            await result.current.handleRename();
        });

        expect(invokeMock).toHaveBeenCalledWith("rename_file", {
            vaultPath: "vault",
            oldPath: "vault/Note.md",
            newName: "Renamed",
        });
        expect(useVaultStore.getState().activeNote?.path).toBe("vault/Renamed.md");
        expect(editorHookMocks.toastSuccess).toHaveBeenCalledWith("Renamed successfully");

        invokeMock.mockRejectedValueOnce(new Error("Rename failed"));
        await act(async () => {
            result.current.setTitleInput("Broken");
        });
        await act(async () => {
            await result.current.handleRename();
        });

        expect(editorHookMocks.toastError).toHaveBeenCalledWith("Rename failed");
        expect(result.current.titleInput).toBe("Renamed");
    });

    test("resolves wikilinks by path, media filename, or note creation and guards invalid targets", async () => {
        const app = TessellumApp.create();
        const dispatch = vi.fn();
        app.editor.setView({ dispatch } as never);
        editorHookMocks.createNoteInDir.mockResolvedValue(createFile("vault/New Note.md"));

        const { result } = renderHook(() => useWikiLinkNavigation());

        await act(async () => {
            await result.current("vault/Note.md");
        });
        expect(useVaultStore.getState().activeNote?.path).toBe("vault/Note.md");

        await act(async () => {
            await result.current("image.png");
        });
        expect(useVaultStore.getState().activeNote?.path).toBe("vault/image.png");

        await act(async () => {
            await result.current("New Note");
        });
        expect(dirnameMock).toHaveBeenCalledWith("vault/image.png");
        expect(editorHookMocks.createNoteInDir).toHaveBeenCalledWith("vault", "New Note");
        expect(useVaultStore.getState().activeNote?.path).toBe("vault/New Note.md");
        expect(dispatch).toHaveBeenCalledWith({
            effects: "clear-wikilink-cache",
        });

        await act(async () => {
            await result.current("..bad");
        });
        expect(editorHookMocks.toastError).toHaveBeenCalledWith("Invalid WikiLink: '..' sequence is not allowed");
    });

    test("loads note content, debounces writes, and bypasses file reads for media notes", async () => {
        invokeMock.mockResolvedValueOnce("Body");
        const note = createFile("vault/Note.md");
        const { result, rerender, unmount } = renderHook(
            ({ activeNote }) => useFileSynchronization(activeNote),
            { initialProps: { activeNote: note } },
        );

        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });
        expect(result.current.content).toBe("Body");
        expect(useEditorContentStore.getState()).toMatchObject({
            activeNoteContent: "Body",
            isDirty: false,
        });

        invokeMock.mockResolvedValueOnce(undefined);
        act(() => {
            result.current.handleContentChange("Updated");
        });
        expect(useEditorContentStore.getState().isDirty).toBe(true);

        await act(async () => {
            vi.advanceTimersByTime(1000);
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(invokeMock).toHaveBeenLastCalledWith("write_file", {
            path: "vault/Note.md",
            vaultPath: "vault",
            content: "Updated",
        });
        expect(useEditorContentStore.getState().isDirty).toBe(false);

        rerender({ activeNote: createFile("vault/image.png") });
        await act(async () => {
            await Promise.resolve();
        });
        expect(result.current.content).toBe("");

        unmount();
    }, 15000);

    test("exposes the composed editor actions hook", () => {
        const { result } = renderHook(() => useEditorActions());

        expect(typeof result.current.createFolder).toBe("function");
        expect(result.current.noteRenaming).toMatchObject({
            titleInput: "Note",
        });
        expect(typeof result.current.noteRenaming.handleRename).toBe("function");
    });
});
