import { beforeEach, describe, expect, test, vi } from "vitest";
import { trackStores } from "../../test/storeIsolation";
import { invokeMock, openDialogMock } from "../../test/tauriMocks";
import { useGraphStore } from "../../stores/graphStore";
import { useNavigationHistoryStore } from "../../stores/navigationHistoryStore";
import { useUiStore } from "../../stores/uiStore";
import { useVaultStore } from "../../stores/vaultStore";
import { TessellumApp } from "../TessellumApp";
import { CoreUIActionsPlugin } from "./CoreUIActionsPlugin";
import { coreUIActionKeywords, coreUIActionsTranslations } from "./coreUIActionsTranslations";
import { DailyNotesPlugin } from "./DailyNotesPlugin";

const builtinInteractionMocks = vi.hoisted(() => ({
    toastError: vi.fn(),
    createNoteInDir: vi.fn(),
}));

vi.mock("sonner", () => ({
    toast: {
        error: builtinInteractionMocks.toastError,
        success: vi.fn(),
    },
}));

vi.mock("../../utils/noteUtils", async () => {
    const actual = await vi.importActual<typeof import("../../utils/noteUtils")>("../../utils/noteUtils");
    return {
        ...actual,
        createNoteInDir: builtinInteractionMocks.createNoteInDir,
    };
});

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

function createPlugin<T extends { manifest: { id: string } }>(PluginClass: new () => T) {
    const app = TessellumApp.create();
    const plugin = new PluginClass() as T & { app: TessellumApp; manifest: { id: string } };
    plugin.app = app;
    plugin.manifest = (PluginClass as unknown as { manifest: { id: string } }).manifest;
    return { app, plugin };
}

describe("builtin plugin interactions", () => {
    beforeEach(() => {
        trackStores(useVaultStore, useGraphStore, useUiStore, useNavigationHistoryStore);
        resetAppSingleton();
        vi.clearAllMocks();
        builtinInteractionMocks.toastError.mockReset();
        builtinInteractionMocks.createNoteInDir.mockReset();
        invokeMock.mockReset();
        invokeMock.mockResolvedValue(undefined);
        openDialogMock.mockReset();
        openDialogMock.mockResolvedValue(null);
        useVaultStore.setState({
            vaultPath: "vault",
            files: [createFile("vault/Current.md")],
            fileTree: [],
            activeNote: createFile("vault/Current.md"),
            openTabPaths: ["vault/Current.md"],
        });
        useGraphStore.setState({
            viewMode: "editor",
            isLocalGraphOpen: false,
            selectedGraphNode: null,
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
        useNavigationHistoryStore.getState().reset();
    });

    test("defines bilingual core UI translations and command keywords", () => {
        expect(coreUIActionsTranslations.en.commands.openVault).toBe("Open / Switch Vault");
        expect(coreUIActionsTranslations.es.actions.trash).toBe("Papelera");
        expect(coreUIActionKeywords.en.newNote).toEqual(["note", "create"]);
        expect(coreUIActionKeywords.es.graphView).toEqual(["grafo", "red"]);
    });

    test("registers core UI actions, palette commands, and settings tabs", () => {
        const { app, plugin } = createPlugin(CoreUIActionsPlugin);

        plugin.onload();

        expect(app.ui.getUIActions("titlebar-left").map((action) => action.id)).toEqual([
            "nav-back",
            "nav-forward",
            "open-palette",
        ]);
        expect(app.ui.getUIActions("sidebar-header").map((action) => action.id)).toEqual([
            "sidebar-open-vault",
            "sidebar-new-folder",
            "sidebar-new-note",
        ]);
        expect(app.ui.getPaletteCommands().map((command) => command.id)).toEqual([
            "open-vault",
            "new-note",
            "new-folder",
            "graph-view",
            "new-note-template",
            "paste-files",
            "settings",
        ]);
        expect(app.ui.getSettingsTabs().map((tab) => tab.id)).toEqual([
            "General",
            "Editor",
            "Appearance",
            "Shortcuts",
            "Accessibility",
            "Plugins",
        ]);
    });

    test("handles open-vault, new-note, and event-driven UI actions through the registered command objects", async () => {
        const { app, plugin } = createPlugin(CoreUIActionsPlugin);
        const emitSpy = vi.spyOn(app.events, "emit");
        builtinInteractionMocks.createNoteInDir.mockResolvedValue(createFile("vault/folder/Untitled.md"));

        plugin.onload();

        openDialogMock.mockResolvedValueOnce("vault-2");
        const openVault = app.ui.getPaletteCommands().find((command) => command.id === "open-vault");
        await openVault?.onTrigger();

        expect(useVaultStore.getState().vaultPath).toBe("vault-2");
        expect(useVaultStore.getState().activeNote).toBeNull();
        expect(useGraphStore.getState().viewMode).toBe("editor");
        expect(emitSpy).toHaveBeenCalledWith("vault:opened", "vault-2");

        useVaultStore.getState().setVaultPath(null);
        const newNote = app.ui.getPaletteCommands().find((command) => command.id === "new-note");
        await newNote?.onTrigger();
        expect(builtinInteractionMocks.toastError).toHaveBeenCalledWith("Open a vault first");

        useVaultStore.getState().setVaultPath("vault");
        useVaultStore.getState().setActiveNote(createFile("vault/folder/Current.md"));
        await newNote?.onTrigger();
        expect(builtinInteractionMocks.createNoteInDir).toHaveBeenCalledWith("vault/folder", "Untitled");
        expect(useVaultStore.getState().activeNote?.path).toBe("vault/folder/Untitled.md");

        app.ui.getPaletteCommands().find((command) => command.id === "new-folder")?.onTrigger();
        app.ui.getPaletteCommands().find((command) => command.id === "new-note-template")?.onTrigger();
        app.ui.getPaletteCommands().find((command) => command.id === "paste-files")?.onTrigger();
        app.ui.getPaletteCommands().find((command) => command.id === "settings")?.onTrigger();
        app.ui.getPaletteCommands().find((command) => command.id === "graph-view")?.onTrigger();

        expect(emitSpy).toHaveBeenCalledWith("ui:open-new-folder");
        expect(emitSpy).toHaveBeenCalledWith("ui:open-template-picker");
        expect(emitSpy).toHaveBeenCalledWith("ui:paste-files");
        expect(emitSpy).toHaveBeenCalledWith("ui:open-settings");
        expect(useGraphStore.getState().viewMode).toBe("graph");
    });

    test("reports open-vault and new-note failures through translated error messages", async () => {
        const { app, plugin } = createPlugin(CoreUIActionsPlugin);

        plugin.onload();

        openDialogMock.mockRejectedValueOnce(new Error("dialog failed"));
        const openVault = app.ui.getPaletteCommands().find((command) => command.id === "open-vault");
        await openVault?.onTrigger();
        expect(builtinInteractionMocks.toastError).toHaveBeenCalledWith("Failed to open vault");

        builtinInteractionMocks.createNoteInDir.mockRejectedValueOnce(new Error("create failed"));
        const newNote = app.ui.getPaletteCommands().find((command) => command.id === "new-note");
        await newNote?.onTrigger();
        expect(builtinInteractionMocks.toastError).toHaveBeenCalledWith("Failed to create note");
    });

    test("opens daily notes only when a vault is available and reports backend failures", async () => {
        const { app, plugin } = createPlugin(DailyNotesPlugin);

        plugin.onload();

        useVaultStore.getState().setVaultPath(null);
        const paletteCommand = app.ui.getPaletteCommands().find((command) => command.id === "daily-note-today");
        await paletteCommand?.onTrigger();
        expect(invokeMock).not.toHaveBeenCalled();

        useVaultStore.getState().setVaultPath("vault");
        invokeMock.mockResolvedValueOnce(createFile("vault/Daily.md"));
        await paletteCommand?.onTrigger();
        expect(invokeMock).toHaveBeenCalledWith("get_or_create_daily_note", { vaultPath: "vault" });
        expect(useVaultStore.getState().activeNote?.path).toBe("vault/Daily.md");

        invokeMock.mockRejectedValueOnce(new Error("daily failed"));
        const sidebarAction = app.ui.getUIActions("sidebar-header").find((action) => action.id === "sidebar-create-daily-note");
        await sidebarAction?.onClick();
        expect(builtinInteractionMocks.toastError).toHaveBeenCalledWith("Failed to open today's daily note. Please try again.");
    });
});
