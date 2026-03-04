import { Plugin, PLUGIN_CLEANUP } from "./Plugin";
import type { PluginManifest } from "./types";
import type { TessellumApp } from "./TessellumApp";

/**
 * Central registry for managing plugin lifecycle with error isolation.
 *
 * Each plugin is registered with its manifest and class constructor.
 * The registry owns instantiation, injects the app reference and handles
 * load/unload with try/catch so one failure doesn't affect others.
 */
export class PluginRegistry {
    private plugins= new Map<string, Plugin>();
    private disabled = new Set<string>();
    private app: TessellumApp;

    constructor(app: TessellumApp) {
        this.app = app;
    }

    // Register a plugin class
    register(manifest: PluginManifest, PluginClass: new () => Plugin): void {
        const instance = new PluginClass();
        instance.app = this.app;
        instance.manifest = manifest;
        this.plugins.set(manifest.id, instance);
    }

    // Load all registered plugins
    loadAll(): void {
        let loaded = 0;
        for (const [id, plugin] of this.plugins) {
            try {
                plugin.onload();
                loaded++;
            } catch (e) {
                console.error('[PluginRegistry] Error loading plugin:', id, e);
                this.disabled.add(id);
            }
        }
        console.log(`[PluginRegistry] Loaded ${loaded} plugins`);
    }

    // Unload all registered plugins
    unloadAll(): void {
        for (const [id, plugin] of this.plugins) {
            try {
                plugin[PLUGIN_CLEANUP]();
            } catch (e) {
                console.error('[PluginRegistry] Error unloading plugin:', id, e);
            }
        }
    }

    // Re-enable a disabled plugin
    enable(id: string): void {
        const plugin = this.plugins.get(id);
        if (!plugin) return;

        // Clean up any leftover state
        plugin[PLUGIN_CLEANUP]();

        try {
            plugin.onload();
            this.disabled.delete(id);
        } catch (e) {
            console.error('[PluginRegistry] Error re-enabling plugin:', id, e);
            this.disabled.add(id);
        }
    }

    // Disable a plugin
    disable(id: string): void {
        const plugin = this.plugins.get(id);
        if (plugin) {
            try {
                plugin[PLUGIN_CLEANUP]();
            } catch (e) {
                console.error('[PluginRegistry] Error disabling plugin:', id, e);
            }
        }
        this.disabled.add(id);
    }

    // Get a plugin by ID
    getPlugin<T extends Plugin>(id: string): T | undefined {
        return this.plugins.get(id) as T;
    }

    // Check if plugin is disabled
    isDisabled(id: string): boolean {
        return this.disabled.has(id);
    }
}