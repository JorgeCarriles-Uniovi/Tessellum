import { create } from "zustand";
import { toast } from "sonner";
import type { PluginManifest } from "../plugins/types";
import type { TessellumApp } from "../plugins/TessellumApp";
import { writeDisabledPluginIds } from "../plugins/pluginPreferences";

export interface PluginListItem {
    manifest: PluginManifest;
    enabled: boolean;
}

export interface PluginsState {
    plugins: PluginListItem[];
}

export interface PluginsActions {
    refreshFromRegistry: (app: TessellumApp) => void;
    togglePlugin: (app: TessellumApp, id: string, nextEnabled: boolean) => void;
}

export type PluginsStore = PluginsState & PluginsActions;

function getDisabledIds(items: PluginListItem[]): string[] {
    return items.filter((item) => !item.enabled).map((item) => item.manifest.id);
}

export const usePluginsStore = create<PluginsStore>((set) => ({
    plugins: [],

    refreshFromRegistry: (app) => {
        set({ plugins: app.plugins.list() });
    },

    togglePlugin: (app, id, nextEnabled) => {
        const result = app.plugins.setEnabled(id, nextEnabled);
        const plugins = app.plugins.list();
        writeDisabledPluginIds(getDisabledIds(plugins));
        set({ plugins });
        if (!result.ok) {
            toast.error("Failed to update plugin");
        }
    },
}));
