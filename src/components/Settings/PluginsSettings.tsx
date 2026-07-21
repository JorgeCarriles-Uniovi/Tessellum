import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { Download, Trash2, RefreshCw } from "lucide-react";
import { SettingSection } from "./items/SettingSection";
import { ToggleSetting } from "./items/ToggleSetting";
import { usePluginsStore } from "../../stores";
import { useTessellumApp } from "../../plugins/TessellumApp";
import { Button } from "../ui";
import { useAppTranslation } from "../../i18n/react.tsx";
import { useVaultStore } from "../../stores/vaultStore";

const LOCKED_PLUGIN_IDS = new Set(["core-ui-actions"]);
const DEFAULT_REGISTRY_URL =
    "https://raw.githubusercontent.com/tessellum-community/plugin-registry/main/registry.json";

interface InstalledPlugin {
    id: string;
    name: string;
    description: string;
    version: string;
    author: string;
    homepage?: string;
    keywords?: string[];
    permissions?: string[];
    entry: string;
}

interface CommunityPlugin {
    id: string;
    name: string;
    description: string;
    version: string;
    author: string;
    homepage?: string;
    keywords?: string[];
    permissions?: string[];
    entry: string;
}

export function PluginsSettings() {
    const app = useTessellumApp();
    const { t } = useAppTranslation("settings");
    const vaultPath = useVaultStore((s) => s.vaultPath);
    const plugins = usePluginsStore((state) => state.plugins);
    const refreshFromRegistry = usePluginsStore((state) => state.refreshFromRegistry);
    const togglePlugin = usePluginsStore((state) => state.togglePlugin);

    const [registryUrl, setRegistryUrl] = useState(DEFAULT_REGISTRY_URL);
    const [communityPlugins, setCommunityPlugins] = useState<CommunityPlugin[]>([]);
    const [installedPlugins, setInstalledPlugins] = useState<InstalledPlugin[]>([]);
    const [loadingRegistry, setLoadingRegistry] = useState(false);
    const [installingId, setInstallingId] = useState<string | null>(null);
    const [uninstallingId, setUninstallingId] = useState<string | null>(null);
    const urlInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        refreshFromRegistry(app);
    }, [app, refreshFromRegistry]);

    useEffect(() => {
        if (!vaultPath) return;
        invoke<InstalledPlugin[]>("list_installed_plugins", { vaultPath }).then(setInstalledPlugins).catch(() => {});
    }, [vaultPath]);

    const builtinPlugins = plugins.filter((p) => p.manifest.source === "builtin");
    const externalPlugins = plugins.filter((p) => p.manifest.source === "external");

    const installedIds = new Set(installedPlugins.map((p) => p.id));

    const handleBrowse = async () => {
        if (!registryUrl.trim()) return;
        setLoadingRegistry(true);
        try {
            const list = await invoke<CommunityPlugin[]>("fetch_community_registry", {
                registryUrl: registryUrl.trim(),
            });
            setCommunityPlugins(list);
        } catch {
            toast.error(t("plugins.loadError"));
        } finally {
            setLoadingRegistry(false);
        }
    };

    const handleInstall = async (plugin: CommunityPlugin) => {
        if (!vaultPath) {
            toast.error(t("plugins.noVaultOpen"));
            return;
        }
        const manifestUrl = registryUrl.trim().replace(/\/[^/]+$/, `/${plugin.id}/manifest.json`);
        setInstallingId(plugin.id);
        try {
            await invoke<InstalledPlugin>("install_plugin", { vaultPath, manifestUrl });
            const updated = await invoke<InstalledPlugin[]>("list_installed_plugins", { vaultPath });
            setInstalledPlugins(updated);
            toast.success(t("plugins.installSuccess"));
        } catch (e) {
            toast.error(`${t("plugins.installError")}: ${String(e)}`);
        } finally {
            setInstallingId(null);
        }
    };

    const handleUninstall = async (pluginId: string) => {
        if (!vaultPath) {
            toast.error(t("plugins.noVaultOpen"));
            return;
        }
        setUninstallingId(pluginId);
        try {
            await invoke("uninstall_plugin", { vaultPath, pluginId });
            setInstalledPlugins((prev) => prev.filter((p) => p.id !== pluginId));
            toast.success(t("plugins.uninstallSuccess"));
        } catch (e) {
            toast.error(`${t("plugins.uninstallError")}: ${String(e)}`);
        } finally {
            setUninstallingId(null);
        }
    };

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
            const name = isBuiltin
                ? t(`plugins.list.${plugin.manifest.id}.name`, { defaultValue: plugin.manifest.name })
                : plugin.manifest.name;
            const manifestDescription = isBuiltin
                ? t(`plugins.list.${plugin.manifest.id}.description`, { defaultValue: plugin.manifest.description })
                : plugin.manifest.description;
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

            {/* Installed community plugins */}
            {installedPlugins.length > 0 && (
                <SettingSection
                    title={t("plugins.marketplaceTitle")}
                    description={t("plugins.marketplaceDescription")}
                >
                    <div className="space-y-2">
                        {installedPlugins.map((p) => (
                            <div
                                key={p.id}
                                className="flex items-start justify-between gap-2 rounded-xl px-3 py-2"
                                style={{ background: "var(--color-background-secondary)" }}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                                        {p.name}
                                        <span
                                            className="ml-2 text-[0.625rem] font-mono px-1 rounded"
                                            style={{
                                                background: "var(--color-background-tertiary)",
                                                color: "var(--color-text-muted)",
                                            }}
                                        >
                                            v{p.version}
                                        </span>
                                    </div>
                                    <div className="text-xs mt-0.5 truncate" style={{ color: "var(--color-text-muted)" }}>
                                        {p.description}
                                    </div>
                                    {p.author && (
                                        <div className="text-[0.625rem] mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                                            by {p.author}
                                        </div>
                                    )}
                                </div>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    className="flex-shrink-0"
                                    disabled={uninstallingId === p.id}
                                    onClick={() => handleUninstall(p.id)}
                                >
                                    <Trash2 size={12} />
                                    {uninstallingId === p.id ? "…" : t("plugins.uninstallButton")}
                                </Button>
                            </div>
                        ))}
                    </div>
                </SettingSection>
            )}

            {/* Marketplace browser */}
            <SettingSection
                title={t("plugins.marketplaceTitle")}
                description={t("plugins.marketplaceDescription")}
            >
                {/* Registry URL input */}
                <div className="flex gap-2">
                    <input
                        ref={urlInputRef}
                        type="text"
                        value={registryUrl}
                        onChange={(e) => setRegistryUrl(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleBrowse()}
                        placeholder={t("plugins.marketplaceUrlLabel")}
                        className="flex-1 text-xs rounded-lg px-3 py-1.5"
                        style={{
                            background: "var(--color-background-secondary)",
                            border: "1px solid var(--color-border-light)",
                            color: "var(--color-text-primary)",
                            outline: "none",
                        }}
                    />
                    <Button variant="primary" size="sm" disabled={loadingRegistry} onClick={handleBrowse}>
                        <RefreshCw size={12} className={loadingRegistry ? "animate-spin" : ""} />
                        {t("plugins.browseButton")}
                    </Button>
                </div>

                {/* Community plugin list */}
                {communityPlugins.length > 0 && (
                    <div className="space-y-2 mt-2">
                        {communityPlugins.map((p) => {
                            const isInstalled = installedIds.has(p.id);
                            const isInstalling = installingId === p.id;
                            return (
                                <div
                                    key={p.id}
                                    className="flex items-start justify-between gap-2 rounded-xl px-3 py-2"
                                    style={{ background: "var(--color-background-secondary)" }}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                                            {p.name}
                                            <span
                                                className="ml-2 text-[0.625rem] font-mono px-1 rounded"
                                                style={{
                                                    background: "var(--color-background-tertiary)",
                                                    color: "var(--color-text-muted)",
                                                }}
                                            >
                                                v{p.version}
                                            </span>
                                            {isInstalled && (
                                                <span
                                                    className="ml-2 text-[0.625rem] px-1.5 py-0.5 rounded-full"
                                                    style={{
                                                        background: "color-mix(in srgb, var(--primary) 15%, transparent)",
                                                        color: "var(--primary)",
                                                    }}
                                                >
                                                    {t("plugins.installedBadge")}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                                            {p.description}
                                        </div>
                                        <div className="text-[0.625rem] mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                                            by {p.author}
                                            {p.homepage && (
                                                <>
                                                    {" · "}
                                                    <a
                                                        href={p.homepage}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{ color: "var(--primary)" }}
                                                    >
                                                        homepage
                                                    </a>
                                                </>
                                            )}
                                        </div>
                                        {p.keywords && p.keywords.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {p.keywords.map((kw) => (
                                                    <span
                                                        key={kw}
                                                        className="text-[0.5625rem] px-1 py-0.5 rounded"
                                                        style={{
                                                            background: "var(--color-background-tertiary)",
                                                            color: "var(--color-text-muted)",
                                                        }}
                                                    >
                                                        {kw}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <Button
                                        variant={isInstalled ? "ghost" : "tint"}
                                        size="sm"
                                        className="flex-shrink-0"
                                        style={isInstalled ? { background: "var(--color-background-tertiary)" } : undefined}
                                        disabled={isInstalling || isInstalled}
                                        onClick={() => !isInstalled && handleInstall(p)}
                                    >
                                        <Download size={12} />
                                        {isInstalling
                                            ? t("plugins.installingStatus")
                                            : isInstalled
                                            ? t("plugins.installedBadge")
                                            : t("plugins.installButton")}
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                )}

                {communityPlugins.length === 0 && !loadingRegistry && (
                    <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                        {t("plugins.noPluginsAvailable")}
                    </div>
                )}
            </SettingSection>
        </div>
    );
}
