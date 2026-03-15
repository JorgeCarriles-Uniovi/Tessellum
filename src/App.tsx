import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileMetadata, TreeNode } from "./types.ts";
import { useGraphStore, useUiStore, useVaultStore } from "./stores";
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
import { useWikiLinkNavigation } from "./components/Editor/hooks";
import { StatusBar } from "./components/Layout/StatusBar";
import { RightSidebar } from "./components/Layout/RightSidebar";

const THEME_KEY = "tessellum-theme";
const WINDOW_KEY = "tessellum-window";

function App() {
    const {
        vaultPath,
        setVaultPath,
        setFiles,
        setFileTree,
        activeNote,
        setActiveNote,
    } = useVaultStore();
    const { expandedFolders, setExpandedFolders } = useUiStore();
    const { viewMode, isLocalGraphOpen, setViewMode } = useGraphStore();
    const [isLoaded, setIsLoaded] = useState(false);
    const [workspaceRestored, setWorkspaceRestored] = useState(false);
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const [themeName, setThemeName] = useState<string>(() => localStorage.getItem(THEME_KEY) || "warm-paper");

    const navigateToWikiLink = useWikiLinkNavigation();

    const closeCommandPalette = () => setIsCommandPaletteOpen(false);

    const app = useMemo(() => {
        const isNew = !(TessellumApp as any)._instance;
        const instance = TessellumApp.create();
        if (isNew) {
            registerBuiltinPlugins(instance);
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
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    useEffect(() => {
        const ref = app.events.on("ui:open-command-palette", () => {
            setIsCommandPaletteOpen(true);
        });
        return () => app.events.off(ref);
    }, [app]);

    useEffect(() => {
        const ref = app.events.on("ui:set-theme", (nextTheme: string) => {
            if (typeof nextTheme === "string") {
                setThemeName(nextTheme);
            }
        });
        return () => app.events.off(ref);
    }, [app]);

    useEffect(() => {
        const root = document.documentElement;
        const themes = ["theme-warm-paper", "theme-graphite", "theme-ocean"];
        themes.forEach((t) => root.classList.remove(t));
        root.classList.add(`theme-${themeName}`);
        localStorage.setItem(THEME_KEY, themeName);
    }, [themeName]);

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
                }
            }).catch(console.error);
        }
    }, [vaultPath, setVaultPath]);

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
        const unlistenPromise = listen('file-changed', () => {
            if (vaultPath) refreshFiles(vaultPath, false);
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
        if (activeNote?.path) {
            localStorage.setItem(`${keyPrefix}:lastNote`, activeNote.path);
        }
    }, [vaultPath, expandedFolders, viewMode, activeNote, workspaceRestored]);

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
                const storedLastNote = localStorage.getItem(`${keyPrefix}:lastNote`);

                if (storedExpanded) {
                    setExpandedFolders(JSON.parse(storedExpanded));
                }
                if (storedViewMode === 'graph' || storedViewMode === 'editor') {
                    setViewMode(storedViewMode);
                }
                if (storedLastNote) {
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
                    className="flex flex-col h-screen w-screen overflow-hidden"
                    style={{
                        backgroundColor: theme.colors.background.primary,
                        fontFamily: theme.typography.fontFamily.sans
                    }}
                >
                    <TitleBar />

                    <div className="flex-1 flex overflow-hidden w-full relative">
                        <div className="flex w-full h-full overflow-hidden">
                            {/* Sidebar */}
                            <Sidebar />

                            {/* Main content area */}
                            <div className="flex-1 h-full min-w-0 bg-white relative flex flex-col min-h-0 overflow-hidden">
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

                            <RightSidebar />
                        </div>
                    </div>

                    <CommandPalette isOpen={isCommandPaletteOpen} onClose={closeCommandPalette} />

                    <Toaster position="bottom-right" richColors />
                </div>
            ) : null}
        </TessellumAppContext.Provider>
    );
}

export default App;