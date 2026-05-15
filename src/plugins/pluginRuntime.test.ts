import { createElement, type ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { trackStores } from "../test/storeIsolation";
import { useEditorModeStore, useGraphStore, useNavigationHistoryStore, useUiStore, useVaultStore } from "../stores";
import { CommandAPI } from "./api/CommandAPI";
import { I18nAPI } from "./api/I18nAPI";
import { UIAPI } from "./api/UIAPI";
import { VaultAPI } from "./api/VaultAPI";
import { WorkspaceAPI } from "./api/WorkspaceAPI";
import { EventBus } from "./EventBus";
import { Plugin, PLUGIN_CLEANUP } from "./Plugin";
import { PluginRegistry } from "./PluginRegistry";
import { TessellumApp, TessellumAppContext, useTessellumApp } from "./TessellumApp";
import type { Command, PluginManifest } from "./types";
import { invokeMock } from "../test/tauriMocks";

function createManifest(id = "plugin.alpha"): PluginManifest {
    return {
        id,
        name: id,
        description: `${id} description`,
        version: "1.0.0",
        source: "builtin",
    };
}

function createFile(path: string) {
    return {
        path,
        filename: path.split("/").at(-1) ?? path,
        is_dir: false,
        size: 1,
        last_modified: 1,
    };
}

class TrackingPlugin extends Plugin {
    loadCalls = 0;
    unloadCalls = 0;

    onload(): void {
        this.loadCalls += 1;
    }

    override onunload(): void {
        this.unloadCalls += 1;
    }
}

class FailingPlugin extends Plugin {
    onload(): void {
        throw new Error("plugin load failed");
    }
}

describe("plugin runtime", () => {
    beforeEach(() => {
        trackStores(
            useVaultStore,
            useGraphStore,
            useEditorModeStore,
            useUiStore,
            useNavigationHistoryStore,
        );
        localStorage.clear();
        vi.restoreAllMocks();
        (TessellumApp as unknown as { _instance: TessellumApp | null })._instance = null;
    });

    test("EventBus isolates listener failures and removes tracked listeners", () => {
        const bus = new EventBus();
        const good = vi.fn();
        const bad = vi.fn(() => {
            throw new Error("boom");
        });
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

        const goodRef = bus.on("vault:file-change", good);
        const badRef = bus.on("vault:file-change", bad);

        bus.emit("vault:file-change", "note.md");
        expect(good).toHaveBeenCalledWith("note.md");
        expect(bad).toHaveBeenCalledWith("note.md");
        expect(errorSpy).toHaveBeenCalledTimes(1);

        bus.removeAll([goodRef, badRef]);
        bus.emit("vault:file-change", "after.md");
        expect(good).toHaveBeenCalledTimes(1);
        expect(bad).toHaveBeenCalledTimes(1);
    });

    test("CommandAPI replaces duplicate commands and dispatches editor insert and callback branches", () => {
        const api = new CommandAPI();
        const callback = vi.fn();
        const editorCallback = vi.fn();
        const dispatch = vi.fn();
        const view = {
            state: {
                selection: { main: { from: 3 } },
            },
            dispatch,
        };

        api.register("plugin.alpha", { id: "a", name: "A", callback });
        api.register("plugin.alpha", { id: "a", name: "A2", callback });
        api.register("plugin.beta", { id: "b", name: "B", insertText: "hello", cursorOffset: 2 });
        api.register("plugin.gamma", { id: "c", name: "C", editorCallback });

        expect(api.getAll().map((command) => command.name)).toEqual(["A2", "B", "C"]);

        api.executeCommand(api.getAll()[1], view as never);
        expect(dispatch).toHaveBeenCalledWith({
            changes: { from: 3, insert: "hello" },
            selection: { anchor: 5 },
        });

        api.executeCommand(api.getAll()[2], view as never);
        expect(editorCallback).toHaveBeenCalledWith(view);

        api.executeCommand(api.getAll()[0], view as never);
        expect(callback).toHaveBeenCalledTimes(1);

        api.unregister("plugin.alpha");
        expect(api.getAll().map((command) => command.id)).toEqual(["b", "c"]);
    });

    test("UIAPI resolves text lazily, sorts sidebar and region actions, and unregisters per plugin", () => {
        const api = new UIAPI();

        api.registerSidebarAction("plugin.alpha", {
            id: "late",
            label: () => "Later",
            onClick: vi.fn(),
            order: 10,
        });
        api.registerSidebarAction("plugin.beta", {
            id: "early",
            label: "Earlier",
            onClick: vi.fn(),
            order: 1,
        });
        api.registerUIAction("plugin.alpha", {
            id: "status",
            label: () => "Status",
            tooltip: () => "tip",
            onClick: vi.fn(),
            region: "statusbar-left",
            order: 2,
        });
        api.registerUIAction("plugin.beta", {
            id: "title",
            label: "Title",
            onClick: vi.fn(),
            region: "titlebar-left",
            order: 0,
        });
        api.registerPaletteCommand("plugin.alpha", {
            id: "palette",
            name: () => "Palette",
            keywords: () => ["one", "two"],
            onTrigger: vi.fn(),
        });
        api.registerSettingsTab("plugin.alpha", {
            id: "settings",
            name: () => "Settings",
            component: null,
        });

        expect(api.getSidebarActions().map((item) => item.label)).toEqual(["Earlier", "Later"]);
        expect(api.getUIActions("statusbar-left")).toEqual([
            expect.objectContaining({ id: "status", label: "Status", tooltip: "tip" }),
        ]);
        expect(api.getPaletteCommands()).toEqual([
            expect.objectContaining({ id: "palette", name: "Palette", keywords: ["one", "two"] }),
        ]);
        expect(api.getSettingsTabs()).toEqual([
            expect.objectContaining({ id: "settings", name: "Settings" }),
        ]);

        api.unregisterSidebarActions("plugin.alpha");
        api.unregisterUIActions("plugin.alpha");
        api.unregisterPaletteCommands("plugin.alpha");
        api.unregisterSettingsTab("plugin.alpha");

        expect(api.getSidebarActions().map((item) => item.id)).toEqual(["early"]);
        expect(api.getUIActions("statusbar-left")).toEqual([]);
        expect(api.getPaletteCommands()).toEqual([]);
        expect(api.getSettingsTabs()).toEqual([]);
    });

    test("I18nAPI delegates to the backing service and namespaces plugin ids", async () => {
        const service = {
            getLocale: vi.fn(() => "en"),
            setLocale: vi.fn(async () => undefined),
            t: vi.fn(() => "translated"),
            registerPluginTranslations: vi.fn(),
            unregisterPluginTranslations: vi.fn(),
        };
        const api = new I18nAPI(service as never);

        expect(api.getLocale()).toBe("en");
        expect(api.t("common.ok")).toBe("translated");

        await api.setLocale("es");
        api.registerTranslations("plugin.alpha", { en: { greeting: "hello" } });
        api.unregisterTranslations("plugin.alpha");

        expect(service.setLocale).toHaveBeenCalledWith("es");
        expect(service.registerPluginTranslations).toHaveBeenCalledWith("plugin.alpha", { en: { greeting: "hello" } });
        expect(service.unregisterPluginTranslations).toHaveBeenCalledWith("plugin.alpha");
        expect(api.getPluginNamespace("plugin.alpha")).toContain("plugin.alpha");
    });

    test("Plugin cleanup unregisters every contribution type and event ref", () => {
        const app = TessellumApp.create();
        const plugin = new TrackingPlugin();
        plugin.app = app;
        plugin.manifest = createManifest();

        const command: Command = { id: "cmd", name: "Command", callback: vi.fn() };
        plugin.registerCommand(command);
        plugin.registerTranslations({ en: { title: "Title" } });
        plugin.registerEvent(app.events.on("event", vi.fn()));
        app.ui.registerCalloutType("plugin.alpha", { type: "tip", title: "Tip", icon: "info" } as never);
        app.ui.registerSidebarAction("plugin.alpha", { id: "side", label: "Side", onClick: vi.fn() } as never);
        app.ui.registerPaletteCommand("plugin.alpha", { id: "palette", name: "Palette", onTrigger: vi.fn() } as never);
        app.ui.registerUIAction("plugin.alpha", {
            id: "action",
            label: "Action",
            onClick: vi.fn(),
            region: "titlebar-left",
        } as never);
        app.ui.registerSettingsTab("plugin.alpha", { id: "settings", name: "Settings", component: null } as never);
        plugin.registerEditorExtension([]);

        plugin[PLUGIN_CLEANUP]();

        expect(plugin.unloadCalls).toBe(1);
        expect(app.commands.getAll()).toEqual([]);
        expect(app.ui.getCalloutTypes()).toEqual([]);
        expect(app.ui.getSidebarActions()).toEqual([]);
        expect(app.ui.getPaletteCommands()).toEqual([]);
        expect(app.ui.getUIActions("titlebar-left")).toEqual([]);
        expect(app.ui.getSettingsTabs()).toEqual([]);
    });

    test("PluginRegistry disables failed plugins, supports re-enable, and reports state", () => {
        const app = TessellumApp.create();
        const registry = new PluginRegistry(app);
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

        registry.register(createManifest("plugin.good"), TrackingPlugin);
        registry.register(createManifest("plugin.bad"), FailingPlugin);
        registry.initializeDisabled(["plugin.unknown", "plugin.good"]);

        registry.loadAll();

        expect(registry.isDisabled("plugin.good")).toBe(true);
        expect(registry.isDisabled("plugin.bad")).toBe(true);
        expect(errorSpy).toHaveBeenCalled();
        expect(logSpy).toHaveBeenCalledWith("[PluginRegistry] Loaded 0 plugins");

        registry.enable("plugin.good");
        expect(registry.isDisabled("plugin.good")).toBe(false);
        expect((registry.getPlugin("plugin.good") as TrackingPlugin).loadCalls).toBe(1);

        registry.disable("plugin.good");
        expect(registry.isDisabled("plugin.good")).toBe(true);
        expect((registry.getPlugin("plugin.good") as TrackingPlugin).unloadCalls).toBeGreaterThanOrEqual(1);

        expect(registry.setEnabled("plugin.good", true)).toEqual({ ok: true });
        expect(registry.setEnabled("plugin.bad", true)).toEqual({ ok: false, error: "Plugin failed to enable" });
        expect(registry.list()).toEqual([
            { manifest: createManifest("plugin.good"), enabled: true },
            { manifest: createManifest("plugin.bad"), enabled: false },
        ]);
    });

    test("TessellumApp reuses the singleton instance and exposes context access", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

        expect(() => TessellumApp.instance).toThrow("TessellumApp not initialized");

        const first = TessellumApp.create();
        const second = TessellumApp.create();

        expect(first).toBe(second);
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(first.plugins).toBeInstanceOf(PluginRegistry);

        const wrapper = ({ children }: { children: ReactNode }) =>
            createElement(TessellumAppContext.Provider, { value: first }, children);

        const { result } = renderHook(() => useTessellumApp(), { wrapper });
        expect(result.current).toBe(first);
    });

    test("VaultAPI and WorkspaceAPI exercise success, fallback, and event branches", async () => {
        const app = TessellumApp.create();
        const vaultApi = new VaultAPI(app);
        const workspaceApi = new WorkspaceAPI(app);
        const noteA = createFile("vault/a.md");
        const noteB = createFile("vault/b.md");
        const modeListener = vi.fn();
        const activeListener = vi.fn();
        const linkClick = vi.fn();

        act(() => {
            useVaultStore.getState().setVaultPath("vault");
            useVaultStore.getState().setFiles([noteA, noteB]);
            useVaultStore.getState().setActiveNote(noteA);
        });

        workspaceApi.onLinkClick = linkClick;
        workspaceApi.onEditorModeChange(modeListener);
        workspaceApi.onActiveNoteChange(activeListener);

        expect(vaultApi.getVaultPath()).toBe("vault");
        invokeMock.mockResolvedValueOnce([noteA, noteB]);
        expect(await vaultApi.listFiles()).toEqual([noteA, noteB]);

        invokeMock.mockResolvedValueOnce("body");
        await expect(vaultApi.readFile("a.md")).resolves.toBe("body");
        await vaultApi.writeFile("a.md", "body");
        await vaultApi.getFileTags("a.md");

        expect(invokeMock.mock.calls.slice(-3)).toEqual([
            ["read_file", { vaultPath: "vault", path: "a.md" }],
            ["write_file", { vaultPath: "vault", path: "a.md", content: "body" }],
            ["get_file_tags", { path: "a.md" }],
        ]);

        act(() => {
            workspaceApi.setEditorMode("source");
            app.events.emit("workspace:active-note-change", noteB);
        });
        expect(modeListener).toHaveBeenCalledWith("source");
        expect(activeListener).toHaveBeenCalledWith(noteB);

        workspaceApi.setExpandedFolders({ folder: true });
        expect(useUiStore.getState().expandedFolders).toEqual({ folder: true });

        workspaceApi.openNote("vault/b.md");
        expect(useVaultStore.getState().activeNote?.path).toBe("vault/b.md");
        expect(useGraphStore.getState().viewMode).toBe("editor");
        expect(linkClick).toHaveBeenCalledWith("vault/b.md");

        workspaceApi.openNote("vault/missing.md");
        expect(linkClick).toHaveBeenLastCalledWith("vault/missing.md");

        workspaceApi.openNoteByMetadata(createFile("vault/c.md"));
        expect(useVaultStore.getState().files.some((file) => file.path === "vault/c.md")).toBe(true);

        act(() => {
            useNavigationHistoryStore.getState().record({ viewMode: "editor", notePath: "vault/a.md" });
            useNavigationHistoryStore.getState().record({ viewMode: "editor", notePath: "vault/b.md" });
        });
        expect(workspaceApi.canGoBack()).toBe(true);
        workspaceApi.goBack();
        useNavigationHistoryStore.getState().completeReplay();
        expect(useVaultStore.getState().activeNote?.path).toBe("vault/a.md");

        expect(workspaceApi.getVaultPath()).toBe("vault");
        expect(workspaceApi.getActiveNote()?.path).toBe("vault/a.md");
        expect(workspaceApi.getEditorMode()).toBe("source");

        act(() => {
            useVaultStore.getState().setVaultPath(null);
        });
        await expect(vaultApi.readFile("a.md")).rejects.toThrow("No vault path set");
        await expect(vaultApi.writeFile("a.md", "body")).rejects.toThrow("No vault path set");
        await expect(vaultApi.listFiles()).resolves.toEqual([]);
    });
});
