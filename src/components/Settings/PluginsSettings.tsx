import { useEffect } from "react";
import { SettingSection } from "./items/SettingSection";
import { ToggleSetting } from "./items/ToggleSetting";
import { usePluginsStore } from "../../stores";
import { useTessellumApp } from "../../plugins/TessellumApp";

const LOCKED_PLUGIN_IDS = new Set(["core-ui-actions"]);

export function PluginsSettings() {
    const app = useTessellumApp();
    const plugins = usePluginsStore((state) => state.plugins);
    const refreshFromRegistry = usePluginsStore((state) => state.refreshFromRegistry);
    const togglePlugin = usePluginsStore((state) => state.togglePlugin);

    useEffect(() => {
        refreshFromRegistry(app);
    }, [app, refreshFromRegistry]);

    const builtinPlugins = plugins.filter((plugin) => plugin.manifest.source === "builtin");
    const externalPlugins = plugins.filter((plugin) => plugin.manifest.source === "external");

    const renderPluginList = (list: typeof plugins) => {
        if (list.length === 0) {
            return (
                <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    No plugins available.
                </div>
            );
        }
        return list.map((plugin) => {
            const locked = LOCKED_PLUGIN_IDS.has(plugin.manifest.id);
            const description = locked
                ? `${plugin.manifest.description} (Required for core UI)`
                : plugin.manifest.description;
            return (
                <ToggleSetting
                    key={plugin.manifest.id}
                    label={plugin.manifest.name}
                    description={description}
                    checked={plugin.enabled}
                    disabled={locked}
                    onChange={(next) => togglePlugin(app, plugin.manifest.id, next)}
                />
            );
        });
    };

    return (
        <div className="space-y-6">
            <SettingSection
                title="Built-in Plugins"
                description="Core plugins that ship with the app."
            >
                {renderPluginList(builtinPlugins)}
            </SettingSection>
            <SettingSection
                title="External Plugins"
                description="Plugins added from outside the core app."
            >
                {renderPluginList(externalPlugins)}
            </SettingSection>
        </div>
    );
}
