import { useEffect } from "react";
import { SettingSection } from "./items/SettingSection";
import { ToggleSetting } from "./items/ToggleSetting";
import { usePluginsStore } from "../../stores";
import { useTessellumApp } from "../../plugins/TessellumApp";
import { useAppTranslation } from "../../i18n/react.tsx";

const LOCKED_PLUGIN_IDS = new Set(["core-ui-actions"]);

export function PluginsSettings() {
    const app = useTessellumApp();
    const { t } = useAppTranslation("settings");
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
                    {t("plugins.noPluginsAvailable")}
                </div>
            );
        }
        return list.map((plugin) => {
            const locked = LOCKED_PLUGIN_IDS.has(plugin.manifest.id);
            const isBuiltin = plugin.manifest.source === "builtin";
            const name = isBuiltin ? t(`plugins.list.${plugin.manifest.id}.name`, { defaultValue: plugin.manifest.name }) : plugin.manifest.name;
            const manifestDescription = isBuiltin ? t(`plugins.list.${plugin.manifest.id}.description`, { defaultValue: plugin.manifest.description }) : plugin.manifest.description;
            const description = locked
                ? `${manifestDescription} (${t("plugins.requiredForCoreUi")})`
                : manifestDescription;
            return (
                <ToggleSetting
                    key={plugin.manifest.id}
                    label={name}
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
                title={t("plugins.builtinTitle")}
                description={t("plugins.builtinDescription")}
            >
                {renderPluginList(builtinPlugins)}
            </SettingSection>
            <SettingSection
                title={t("plugins.externalTitle")}
                description={t("plugins.externalDescription")}
            >
                {renderPluginList(externalPlugins)}
            </SettingSection>
        </div>
    );
}
