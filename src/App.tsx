import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileMetadata, TreeNode } from "./types.ts";
import {
    useAppearanceStore,
    useEditorContentStore,
    useEditorModeStore,
    useGraphStore,
    useSettingsStore,
    useThemeStore,
    useUiStore,
    useVaultStore
} from "./stores";
import { DEFAULT_EDITOR_MODE, isEditorMode } from "./constants/editorModes";
import { listen } from "@tauri-apps/api/event";
import { exists } from '@tauri-apps/plugin-fs';
import { getCurrentWindow, LogicalPosition, LogicalSize } from '@tauri-apps/api/window';
import { Editor } from "./components/Editor/Editor.tsx";
import { Sidebar } from "./components/Sidebar/Sidebar.tsx";
import { GraphView } from "./components/GraphView/GraphView.tsx";
import { LocalGraphPanel } from "./components/GraphView/LocalGraphPanel.tsx";
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
import { useApplyAppearanceSettings } from "./hooks/useApplyAppearanceSettings";
import { useApplyAccessibilitySettings } from "./hooks/useApplyAccessibilitySettings";
import { useApplyThemeSchedule } from "./hooks/useApplyThemeSchedule";
import { ColorFilterDefs } from "./components/Accessibility/ColorFilterDefs";
import { useWorkspaceNavigationHistory } from "./hooks/useWorkspaceNavigationHistory";

const WINDOW_KEY = "tessellum-window";

function App() {
    const {
        vaultPath,
        setVaultPath,
        setFiles,
        setFileTree,
        activeNote,
        setActiveNote,
        closeTab,
        openTabPaths,
        restoreWorkspaceTabs,
    } = useVaultStore();
    const { expandedFolders, setExpandedFolders, openSearch, closeSearch } = useUiStore();
    const { viewMode, isLocalGraphOpen, setViewMode } = useGraphStore();
    const editorMode = useEditorModeStore((state) => state.editorMode);
    const setEditorMode = useEditorModeStore((state) => state.setEditorMode);
    const [isLoaded, setIsLoaded] = useState(false);
    const [workspaceRestored, setWorkspaceRestored] = useState(false);
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
    const editorFontSizePx = useEditorContentStore((state) => state.editorFontSizePx);
    const { fontFamily, editorLineHeight, editorLetterSpacing } = useSettingsStore();
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
    useWorkspaceNavigationHistory({ workspaceRestored });

    useEffect(() => {
        loadThemes();
        startThemeWatch();
        return () => {
            stopThemeWatch();
        };
    }, [loadThemes, startThemeWatch, stopThemeWatch]);

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

    useEffect(() => {
        app.plugins.loadAll();
        setIsLoaded(true);
        return () => {
            setIsLoaded(false);
            app.plugins.unloadAll();
        };
    }, [app]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (target) {
                const tag = target.tagName;
                const isEditor = target.closest(".cm-editor");
                if ((tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) && !isEditor) {
                    return;
                }
            }

            const isMac = navigator.platform.toLowerCase().includes("mac");
            const modifier = isMac ? event.metaKey : event.ctrlKey;
            if (modifier && event.key.toLowerCase() === "k") {
                event.preventDefault();
                setIsCommandPaletteOpen((prev) => !prev);
                return;
            }

            if (modifier && event.key.toLowerCase() === "w" && activeNote?.path) {
                event.preventDefault();
                closeTab(activeNote.path);
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [activeNote, closeTab]);

    useEffect(() => {
        const ref = app.events.on("ui:open-command-palette", () => {
            setIsCommandPaletteOpen(true);
        });
        return () => app.events.off(ref);
    }, [app]);

    useEffect(() => {
        const openRef = app.events.on("ui:open-search", () => {
            openSearch();
        });
        const closeRef = app.events.on("ui:close-search", () => {
            closeSearch();
        });
        return () => {
            app.events.off(openRef);
            app.events.off(closeRef);
        };
    }, [app, closeSearch, openSearch]);

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
        document.documentElement.style.setProperty("--editor-font-size", `${editorFontSizePx}px`);
    }, [editorFontSizePx]);

    useEffect(() => {
        const root = document.documentElement;
        const fallback = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Helvetica Neue', sans-serif";
        const hasComma = fontFamily.includes(",");
        const needsQuotes = fontFamily.includes(" ");
        const family = hasComma ? fontFamily : `${needsQuotes ? `"${fontFamily}"` : fontFamily}, ${fallback}`;
        root.style.setProperty("--font-sans", family);
        root.style.setProperty("--editor-line-height", String(editorLineHeight));
        root.style.setProperty("--editor-letter-spacing", `${editorLetterSpacing}em`);
    }, [fontFamily, editorLineHeight, editorLetterSpacing]);

    useEffect(() => {
        const appWindow = getCurrentWindow();

        const restore = async () => {
            try {
                const raw = localStorage.getItem(WINDOW_KEY);
                if (!raw) return;
                const state = JSON.parse(raw) as { x: number; y: number; width: number; height: number; isMaximized?: boolean };
                if (state.isMaximized) {
                    await appWindow.maximize();
                    return;
                }
                if (state.width && state.height) {
                    await appWindow.setSize(new LogicalSize(state.width, state.height));
                }
                if (state.x !== undefined && state.y !== undefined) {
                    await appWindow.setPosition(new LogicalPosition(state.x, state.y));
                }
            } catch (e) {
                console.error(e);
            }
        };

        const persist = async () => {
            try {
                const isMaximized = await appWindow.isMaximized();
                const pos = await appWindow.outerPosition();
                const size = await appWindow.outerSize();
                localStorage.setItem(WINDOW_KEY, JSON.stringify({
                    x: pos.x,
                    y: pos.y,
                    width: size.width,
                    height: size.height,
                    isMaximized,
                }));
            } catch (e) {
                console.error(e);
            }
        };

        restore();
        const unlistenResize = appWindow.listen('tauri://resize', persist);
        const unlistenMove = appWindow.listen('tauri://move', persist);
        return () => {
            unlistenResize.then((f) => f());
            unlistenMove.then((f) => f());
        };
    }, []);

    useEffect(() => {
        if (vaultPath) {
            exists(vaultPath).then((doesExist: boolean) => {
                if (!doesExist) {
                    console.warn(`Vault path ${vaultPath} no longer exists. Clearing.`);
                    setVaultPath(null);
                    return;
                }
                invoke("set_vault_path", { path: vaultPath })
                    .then(() => app.events.emit("vault:scope-ready", vaultPath))
                    .catch(console.error);
            }).catch(console.error);
        }
    }, [vaultPath, setVaultPath, app]);

    useEffect(() => {
        if (vaultPath) {
            invoke('watch_vault', { vaultPath }).catch(console.error);
            setWorkspaceRestored(false);
            refreshFiles(vaultPath, true);
        } else {
            setActiveNote(null);
            setExpandedFolders({});
            setWorkspaceRestored(false);
        }
    }, [vaultPath]);

    useEffect(() => {
        let syncTimer: number | null = null;
        const unlistenPromise = listen('file-changed', () => {
            if (!vaultPath) return;
            refreshFiles(vaultPath, false);
            if (syncTimer) window.clearTimeout(syncTimer);
            syncTimer = window.setTimeout(() => {
                invoke('sync_vault', { vaultPath }).catch(console.error);
            }, 400);
        });
        return () => { unlistenPromise.then(unlisten => unlisten()); };
    }, [vaultPath]);

    useEffect(() => {
        if (!vaultPath || !workspaceRestored) return;
        invoke('sync_vault', { vaultPath }).catch(console.error);
        const interval = setInterval(() => {
            invoke('sync_vault', { vaultPath }).catch(console.error);
        }, 300_000);
        return () => clearInterval(interval);
    }, [vaultPath, workspaceRestored]);

    useEffect(() => {
        TessellumApp.instance.workspace.onLinkClick = navigateToWikiLink;
    }, [navigateToWikiLink]);

    useEffect(() => {
        if (!vaultPath || !workspaceRestored) return;
        const keyPrefix = `tessellum:${vaultPath}`;
        localStorage.setItem(`${keyPrefix}:expandedFolders`, JSON.stringify(expandedFolders));
        localStorage.setItem(`${keyPrefix}:viewMode`, viewMode);
        localStorage.setItem(`${keyPrefix}:editorMode`, editorMode);
        localStorage.setItem(`${keyPrefix}:openTabs`, JSON.stringify(openTabPaths));
        if (activeNote?.path) {
            localStorage.setItem(`${keyPrefix}:lastNote`, activeNote.path);
            localStorage.setItem(`${keyPrefix}:activeTabPath`, activeNote.path);
        }
    }, [vaultPath, expandedFolders, viewMode, editorMode, openTabPaths, activeNote, workspaceRestored]);

    async function refreshFiles(vaultPath: string, restoreState: boolean): Promise<void> {
        try {
            const [flatFiles, treeFiles] = await Promise.all([
                invoke<FileMetadata[]>('list_files', { vaultPath }),
                invoke<TreeNode[]>('list_files_tree', { vaultPath })
            ]);
            setFiles(flatFiles);
            setFileTree(treeFiles);

            if (restoreState) {
                const keyPrefix = `tessellum:${vaultPath}`;
                const storedExpanded = localStorage.getItem(`${keyPrefix}:expandedFolders`);
                const storedViewMode = localStorage.getItem(`${keyPrefix}:viewMode`);
                const storedEditorMode = localStorage.getItem(`${keyPrefix}:editorMode`);
                const storedOpenTabs = localStorage.getItem(`${keyPrefix}:openTabs`);
                const storedActiveTabPath = localStorage.getItem(`${keyPrefix}:activeTabPath`);
                const storedLastNote = localStorage.getItem(`${keyPrefix}:lastNote`);

                if (storedExpanded) {
                    setExpandedFolders(JSON.parse(storedExpanded));
                }
                if (storedViewMode === 'graph' || storedViewMode === 'editor') {
                    setViewMode(storedViewMode);
                }
                if (isEditorMode(storedEditorMode)) {
                    setEditorMode(storedEditorMode);
                } else {
                    setEditorMode(DEFAULT_EDITOR_MODE);
                }

                let restoredTabs = false;
                if (storedOpenTabs) {
                    try {
                        const parsedTabs = JSON.parse(storedOpenTabs);
                        if (Array.isArray(parsedTabs)) {
                            const tabPaths = parsedTabs.filter((tabPath): tabPath is string => typeof tabPath === "string");
                            restoreWorkspaceTabs(tabPaths, storedActiveTabPath ?? storedLastNote);
                            restoredTabs = true;
                        }
                    } catch (e) {
                        console.error(e);
                    }
                }

                if (!restoredTabs && storedLastNote) {
                    const note = flatFiles.find((f) => f.path === storedLastNote) || null;
                    setActiveNote(note);
                }
                setWorkspaceRestored(true);
                seedTemplatesIfEmpty(vaultPath).catch(console.error);
            }
        } catch (e) { console.error(e); }
    }

    async function seedTemplatesIfEmpty(vaultPath: string): Promise<void> {
        try {
            const templates = await invoke<{ name: string; path: string }[]>('list_templates', { vaultPath });
            if (templates.length > 0) return;
            const baseDir = vaultPath.replace(/\\/g, "/") + "/.tessellum/templates";
            const templatesToSeed = [
                { name: "Daily Note", content: "# {{date}}\n\n## Highlights\n- \n\n## Notes\n- \n" },
                { name: "Meeting Notes", content: "# {{title}}\n\n**Date:** {{date}}\n\n## Agenda\n- \n\n## Notes\n- \n\n## Action Items\n- [ ] \n" },
                { name: "Project Brief", content: "# {{title}}\n\n## Goal\n\n## Scope\n\n## Milestones\n- \n" },
                { name: "Task List", content: "# {{title}}\n\n- [ ] \n- [ ] \n" },
                { name: "Procrastination Plan", content: "# {{title}}\n\n## Things I should do\n- [ ] \n\n## What I will probably do instead\n- [ ] \n" },
            ];
            for (const tmpl of templatesToSeed) {
                const path = `${baseDir}/${tmpl.name}.md`;
                await invoke('write_file', { vaultPath, path, content: tmpl.content });
            }
        } catch (e) {
            console.error(e);
        }
    }

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
                    <Toaster position="bottom-right" richColors />
                </div>
            ) : null}
        </TessellumAppContext.Provider>
    );
}

export default App;
