import { beforeEach, describe, expect, test, vi } from "vitest";
import { TessellumApp } from "../TessellumApp";
import { HtmlPreviewPlugin } from "./HtmlPreviewPlugin";
import { isHtmlPreviewEnabled, setHtmlPreviewEnabled } from "./htmlPreviewState";

function resetAppSingleton() {
    (TessellumApp as unknown as { _instance: TessellumApp | null })._instance = null;
}

function createPlugin() {
    const app = TessellumApp.create();
    const plugin = new HtmlPreviewPlugin();
    plugin.app = app;
    plugin.manifest = HtmlPreviewPlugin.manifest;
    return { app, plugin };
}

describe("HtmlPreviewPlugin", () => {
    beforeEach(() => {
        resetAppSingleton();
        setHtmlPreviewEnabled(false);
        vi.clearAllMocks();
    });

    test("registers a file viewer that claims html files only", () => {
        const { app, plugin } = createPlugin();

        plugin.onload();

        const viewer = app.ui.getFileViewer("vault/Report.html");
        expect(viewer).toBeDefined();
        expect(viewer!.id).toBe("html-file");
        expect(app.ui.getFileViewer("vault/note.md")).toBeUndefined();
    });

    test("registers the fenced html block editor extension", () => {
        const { plugin } = createPlugin();
        const registerExtension = vi.spyOn(plugin, "registerEditorExtension");

        plugin.onload();

        expect(registerExtension).toHaveBeenCalledTimes(1);
    });

    test("flips the shared enabled flag and announces the change on load and unload", () => {
        const { app, plugin } = createPlugin();
        const changed = vi.fn();
        app.events.on("html-preview:changed", changed);

        plugin.onload();
        expect(isHtmlPreviewEnabled()).toBe(true);
        expect(changed).toHaveBeenCalledTimes(1);

        plugin.onunload();
        expect(isHtmlPreviewEnabled()).toBe(false);
        expect(changed).toHaveBeenCalledTimes(2);
    });
});
