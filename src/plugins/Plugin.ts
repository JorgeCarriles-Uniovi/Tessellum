import type { Extension } from "@codemirror/state";
import type { TessellumApp } from "./TessellumApp";
import type { PluginManifest, EventRef, Command } from "./types";

export const PLUGIN_CLEANUP = Symbol("plugin-cleanup");

/**
 * Base class for all plugins.
 *
 * Lifecycle:
 * 1. PluginRegistry instantiates the plugin
 * 2. Registry sets `plugin.app` and `plugin.manifest` before calling `onload()`
 * 3. Plugin calls convenience methods in `onload()`
 * 4. Plugin calls `plugin[PLUGIN_CLEANUP]()` when the app is unloaded
 */
export abstract class Plugin {
    app!: TessellumApp;
    manifest!: PluginManifest;

    // --- Internal tracking ---
    private _eventRefs: EventRef[] = [];

    // --- Lifecycle ---

    // Called when the plugin is activated
    abstract onload(): void;

    // Called when te plugin is deactivated
    onunload(): void {}

    // --- Convenience methods ---

    // Register Editor extensions
    registerEditorExtension(ext: Extension | Extension[]): void {
        const exts = Array.isArray(ext) ? ext : [ext];
        this.app.editor.registerExtensions(this.manifest.id, exts);
    }

    // Register a command
    registerCommand(command: Command): void {
        this.app.commands.register(this.manifest.id, command);
    }

    // Tracks an event subscription for automatic cleanup
    registerEvent(ref: EventRef): void {
        this._eventRefs.push(ref);
    }

    /**
     * @internal Called by the PluginRegistry only.
     * Uses Symbol key so subclasses don't accidentally override or call it.
     */
    [PLUGIN_CLEANUP](): void{
        this.onunload();
        this.app.editor.unregisterExtensions(this.manifest.id);
        this.app.commands.unregister(this.manifest.id);
        this.app.ui.unregisterCalloutTypes(this.manifest.id);
        this.app.ui.unregisterSidebarActions(this.manifest.id);
        this.app.ui.unregisterPaletteCommands(this.manifest.id);
        this.app.ui.unregisterUIActions(this.manifest.id);
        this.app.events.removeAll(this._eventRefs);
        this._eventRefs = [];
    }

}