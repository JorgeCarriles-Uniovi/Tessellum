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
            if (this.disabled.has(id)) {
                continue;
            }
            try {
                plugin.onload();
                loaded++;
            } catch (e) {
                console.error('[PluginRegistry] Error loading plugin:', id, e);
                try {
                    plugin[PLUGIN_CLEANUP]();
                } catch (cleanupError) {
                    console.error("[PluginRegistry] Error cleaning failed plugin:", id, cleanupError);
                }
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
            try {
                plugin[PLUGIN_CLEANUP]();
            } catch (cleanupError) {
                console.error("[PluginRegistry] Error cleaning failed plugin re-enable:", id, cleanupError);
            }
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

    // List all registered plugins with enabled state
    list(): { manifest: PluginManifest; enabled: boolean }[] {
        const result: { manifest: PluginManifest; enabled: boolean }[] = [];
        for (const [id, plugin] of this.plugins) {
            result.push({ manifest: plugin.manifest, enabled: !this.disabled.has(id) });
        }
        return result;
    }

    // Seed disabled plugins before loadAll()
    initializeDisabled(ids: string[]): void {
        const known = ids.filter((id) => this.plugins.has(id));
        this.disabled = new Set(known);
    }

    // Toggle a plugin with status result
    setEnabled(id: string, enabled: boolean): { ok: boolean; error?: string } {
        try {
            if (enabled) {
                this.enable(id);
                if (this.disabled.has(id)) {
                    return { ok: false, error: "Plugin failed to enable" };
                }
            } else {
                this.disable(id);
            }
            return { ok: true };
        } catch (e) {
            console.error("[PluginRegistry] Failed to set plugin state:", id, e);
            return { ok: false, error: String(e) };
        }
    }
}
