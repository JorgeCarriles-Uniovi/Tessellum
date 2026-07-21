import { useEffect, useMemo, useState } from "react";
import {
    useAppearanceStore,
    useGraphStore,
    useSelectionStore,
    useSearchStore,
    useThemeStore,
    useUiStore,
    useVaultStore
} from "./stores";
import { Editor } from "./components/Editor/Editor.tsx";
import { Sidebar } from "./components/Sidebar/Sidebar.tsx";
import { GraphView } from "./components/GraphView/GraphView.tsx";
import { LocalGraphPanel } from "./components/GraphView/LocalGraphPanel.tsx";
import { CanvasView } from "./components/canvas/CanvasView.tsx";
import { Toaster } from "sonner";
import { theme } from './styles/theme';
import 'katex';
import { TitleBar } from "./components/TitleBar/TitleBar";
import { CommandPalette } from "./components/CommandPalette/CommandPalette";
import { TessellumApp, TessellumAppContext } from "./plugins/TessellumApp";
import { registerBuiltinPlugins } from "./plugins/builtin";
import { readDisabledPluginIds } from "./plugins/pluginPreferences";
import { useWikiLinkNavigation } from "./components/Editor/hooks";
import { StatusBar } from "./components/Layout/StatusBar";
import { RightSidebar } from "./components/Layout/RightSidebar";
import { SettingsModal } from "./components/Settings/SettingsModal.tsx";
import { UpdatePrompt } from "./components/Updates/UpdatePrompt.tsx";
import { useUpdaterStore } from "./stores/updaterStore";
import { useApplyAppearanceSettings } from "./hooks/useApplyAppearanceSettings";
import { useApplyAccessibilitySettings } from "./hooks/useApplyAccessibilitySettings";
import { useApplyThemeSchedule } from "./hooks/useApplyThemeSchedule";
import { ColorFilterDefs } from "./components/Accessibility/ColorFilterDefs";
import { useWorkspaceNavigationHistory } from "./hooks/useWorkspaceNavigationHistory";
import { useApplySpellCheckSettings } from "./hooks/useApplySpellCheckSettings";
import { useClipboardFilePaste } from "./features/clipboard/useClipboardFilePaste";
import { useClipboardFileCopy } from "./features/clipboard/useClipboardFileCopy";
import { useAutoSave } from "./hooks/useAutoSave";
import { useVaultSession } from "./hooks/useVaultSession";
import { useGlobalShortcuts } from "./hooks/useGlobalShortcuts";
import { useWindowStatePersistence } from "./hooks/useWindowStatePersistence";
import { useTypographyCssVars } from "./hooks/useTypographyCssVars";

const MIN_WINDOW_WIDTH = 720;
const MIN_WINDOW_HEIGHT = 500;

function App() {
    const { vaultPath, activeNote, closeTab, files } = useVaultStore();
    const selectedFilePaths = useSelectionStore((state) => state.selectedFilePaths);
    const { openSearch, closeSearch, toggleSidebar } = useUiStore();
    const { viewMode, isLocalGraphOpen, setViewMode } = useGraphStore();
    const [isLoaded, setIsLoaded] = useState(false);
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
    const ensureSearchReadiness = useSearchStore((state) => state.ensureReadiness);
    const resetAndEnsureSearchReadiness = useSearchStore((state) => state.resetAndEnsureReadiness);
    const loadThemes = useThemeStore((state) => state.loadThemes);
    const startThemeWatch = useThemeStore((state) => state.startWatching);
    const stopThemeWatch = useThemeStore((state) => state.stopWatching);
    const [layoutAppearance, setLayoutAppearance] = useState(() => {
        const state = useAppearanceStore.getState();
        return { sidebarPosition: state.sidebarPosition, toolbarVisible: state.toolbarVisible };
    });

    const navigateToWikiLink = useWikiLinkNavigation();
    useApplyAppearanceSettings();
    useApplyThemeSchedule();
    useApplyAccessibilitySettings();
    useApplySpellCheckSettings();
    useAutoSave();

    useEffect(() => {
        if (!vaultPath) return;

        loadThemes();
        startThemeWatch();
        return () => {
            stopThemeWatch();
        };
    }, [loadThemes, startThemeWatch, stopThemeWatch, vaultPath]);

    useEffect(() => {
        const unsubscribe = useAppearanceStore.subscribe((state) => {
            const next = { sidebarPosition: state.sidebarPosition, toolbarVisible: state.toolbarVisible };
            setLayoutAppearance((prev) => {
                if (prev.sidebarPosition === next.sidebarPosition && prev.toolbarVisible === next.toolbarVisible) {
                    return prev;
                }
                return next;
            });
        });
        return unsubscribe;
    }, []);

    const closeCommandPalette = () => setIsCommandPaletteOpen(false);
    const closeSettingsPanel = () => setIsSettingsPanelOpen(false);

    const warmSearchIndex = (path: string, resetAttempts: boolean) => {
        const runWarmup = async () => {
            try {
                if (resetAttempts) {
                    await useSearchStore.getState().syncReadiness(path);
                    if (useSearchStore.getState().readinessReopenRequired) {
                        await resetAndEnsureSearchReadiness(path);
                        return;
                    }
                }
                await ensureSearchReadiness(path);
            } catch (error) {
                console.error(error);
            }
        };

        void runWarmup();
    };

    const app = useMemo(() => {
        const isNew = !(TessellumApp as any)._instance;
        const instance = TessellumApp.create();
        if (isNew) {
            registerBuiltinPlugins(instance);
            const disabledIds = readDisabledPluginIds();
            instance.plugins.initializeDisabled(disabledIds);
        }
        return instance;
    }, []);
    const clipboardFilePaste = useClipboardFilePaste({
        vaultPath,
        refreshVault: () => {
            app.events.emit("vault:refresh-files");
        },
    });
    const clipboardFileCopy = useClipboardFileCopy();

    useEffect(() => {
        app.plugins.loadAll();
        setIsLoaded(true);
        return () => {
            setIsLoaded(false);
            app.plugins.unloadAll();
        };
    }, [app]);

    const { workspaceRestored } = useVaultSession(app);
    useWorkspaceNavigationHistory({ workspaceRestored });
    useGlobalShortcuts({
        app,
        files,
        selectedFilePaths,
        activeNotePath: activeNote?.path,
        viewMode,
        setViewMode,
        toggleSidebar,
        toggleCommandPalette: () => setIsCommandPaletteOpen((prev) => !prev),
        closeTab,
        clipboardFilePaste,
        clipboardFileCopy,
    });
    useWindowStatePersistence({ minWidth: MIN_WINDOW_WIDTH, minHeight: MIN_WINDOW_HEIGHT });
    useTypographyCssVars();

    useEffect(() => {
        const ref = app.events.on("ui:open-command-palette", () => {
            setIsCommandPaletteOpen(true);
        });
        return () => app.events.off(ref);
    }, [app]);

    useEffect(() => {
        const openRef = app.events.on("ui:open-search", () => {
            openSearch();
            if (vaultPath) {
                warmSearchIndex(vaultPath, true);
            }
        });
        const closeRef = app.events.on("ui:close-search", () => {
            closeSearch();
        });
        return () => {
            app.events.off(openRef);
            app.events.off(closeRef);
        };
    }, [app, closeSearch, openSearch, vaultPath]);

    useEffect(() => {
        const ref = app.events.on("vault:scope-ready", (path: string) => {
            if (!path) {
                return;
            }
            warmSearchIndex(path, false);
        });
        return () => app.events.off(ref);
    }, [app]);

    useEffect(() => {
        const ref = app.events.on("ui:open-settings", () => {
            setIsSettingsPanelOpen(true);
        });
        return () => app.events.off(ref);
    }, [app]);

    useEffect(() => {
        const ref = app.events.on("ui:set-theme", (nextTheme: string) => {
            if (typeof nextTheme === "string") {
                useThemeStore.getState().setActiveTheme(nextTheme);
            }
        });
        return () => app.events.off(ref);
    }, [app]);

    useEffect(() => {
        TessellumApp.instance.workspace.onLinkClick = navigateToWikiLink;
    }, [navigateToWikiLink]);

    // Auto-detect updates shortly after startup (silent: no errors in dev/offline).
    useEffect(() => {
        const timer = setTimeout(() => {
            void useUpdaterStore.getState().checkForUpdates({ silent: true });
        }, 3000);
        return () => clearTimeout(timer);
    }, []);

    return (
        <TessellumAppContext.Provider value={app}>
            {isLoaded ? (
                <div
                    className="app-root flex flex-col h-screen w-screen overflow-hidden"
                    style={{
                        backgroundColor: theme.colors.background.primary,
                        fontFamily: theme.typography.fontFamily.sans
                    }}
                >
                    <ColorFilterDefs />
                    {layoutAppearance.toolbarVisible && <TitleBar />}

                    <div className="flex-1 flex overflow-hidden w-full relative" style={{ backgroundColor: theme.colors.background.primary }}>
                        <div className="flex w-full h-full overflow-hidden">
                            {/* Sidebar */}
                            {layoutAppearance.sidebarPosition === "left" && <Sidebar side="left" />}

                            {/* Main content area */}
                            <div
                                className="flex-1 h-full min-w-0 relative flex flex-col min-h-0 overflow-hidden"
                                style={{ backgroundColor: theme.colors.background.primary }}
                            >
                                {viewMode === 'graph' ? (
                                    <div className="flex-1 h-full min-w-0 relative flex flex-col min-h-0 overflow-hidden">
                                        <GraphView />
                                    </div>
                                ) : viewMode === 'canvas' ? (
                                    <div className="flex-1 h-full min-w-0 relative flex flex-col min-h-0 overflow-hidden">
                                        <CanvasView />
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex-1 h-full min-w-0 relative flex min-h-0 overflow-hidden">
                                            <div className="flex-1 h-full min-w-0 relative flex flex-col min-h-0 overflow-hidden">
                                                <Editor />
                                            </div>
                                            <LocalGraphPanel isOpen={isLocalGraphOpen} />
                                        </div>
                                    </>
                                )}
                                <StatusBar />
                            </div>

                            {layoutAppearance.sidebarPosition === "right" && <Sidebar side="right" />}
                            <RightSidebar />
                        </div>
                    </div>

                    <CommandPalette isOpen={isCommandPaletteOpen} onClose={closeCommandPalette} />
                    <SettingsModal isOpen={isSettingsPanelOpen} onClose={closeSettingsPanel} />
                    <UpdatePrompt />
                    <Toaster position="bottom-right" richColors />
                </div>
            ) : null}
        </TessellumAppContext.Provider>
    );
}

export default App;
