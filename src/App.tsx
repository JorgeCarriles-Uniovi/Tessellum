import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileMetadata } from "./types.ts";
import { useEditorStore } from "./stores/editorStore.ts";
import { listen } from "@tauri-apps/api/event";
import { open } from '@tauri-apps/plugin-dialog';
import { exists } from '@tauri-apps/plugin-fs';
import { Editor } from "./components/Editor/Editor.tsx";
import { Sidebar } from "./components/Sidebar/Sidebar.tsx";
import { GraphView } from "./components/GraphView/GraphView.tsx";
import { LocalGraphPanel } from "./components/GraphView/LocalGraphPanel.tsx";
import { Toaster } from "sonner";
import { theme } from './styles/theme';
import 'katex';
import { cn } from "./lib/utils";
import { TitleBar } from "./components/TitleBar/TitleBar";
import { TessellumApp, TessellumAppContext } from "./plugins/TessellumApp";
import { registerBuiltinPlugins } from "./plugins/builtin";
import {useWikiLinkNavigation} from "./components/Editor/hooks";

function App() {
    const {
        vaultPath,
        setVaultPath,
        setFiles,
        isSidebarOpen,
        viewMode,
        isLocalGraphOpen
    } = useEditorStore();

    const [isLoaded, setIsLoaded] = useState(false);

    const navigateToWikiLink = useWikiLinkNavigation();

    // Create TessellumApp singleton and register plugins.
    const app = useMemo(() => {
        const isNew = !(TessellumApp as any)._instance;
        const instance = TessellumApp.create();
        if (isNew) {
            registerBuiltinPlugins(instance);
        }
        return instance;
    }, []);

    // Manage plugin lifecycle
    useEffect(() => {
        app.plugins.loadAll();
        setIsLoaded(true);
        return () => {
            setIsLoaded(false);
            app.plugins.unloadAll();
        };
    }, [app]);

    /**
     * 1. VALIDATION & PERSISTENCE
     * Validates vaultPath existence on startup.
     * Because 'tauri-plugin-persisted-scope' is active in Rust,
     * previously authorized paths will pass this check automatically.
     */
    useEffect(() => {
        let isMounted = true;

        const validateVault = async () => {
            if (!vaultPath) return;

            try {
                await invoke('set_vault_path', { path: vaultPath }); // re-grant scope on startup
                const doesExist = await exists(vaultPath);
                if (!doesExist && isMounted) {
                    console.warn(`Vault path ${vaultPath} no longer exists. Clearing.`);
                    setVaultPath(null);
                }
            } catch (error) {
                // This usually triggers if the path is forbidden.
                // If persisted-scope is working, this shouldn't happen for known vaults.
                console.error("Scope validation error:", error);
                if (isMounted) setVaultPath(null);
            }
        };

        validateVault();
        return () => { isMounted = false; };
    }, [vaultPath, setVaultPath]);

    /**
     * 2. VAULT WATCHER & SYNC
     */
    useEffect(() => {
        if (vaultPath) {
            invoke('watch_vault', { vaultPath }).catch(console.error);
            refreshFiles(vaultPath);
        }
    }, [vaultPath]);

    useEffect(() => {
        const unlistenPromise = listen('file-changed', () => {
            if (vaultPath) refreshFiles(vaultPath);
        });
        return () => { unlistenPromise.then(unlisten => unlisten()); };
    }, [vaultPath]);

    useEffect(() => {
        if (!vaultPath) return;

        invoke('sync_vault', { vaultPath }).catch(console.error);

        const interval = setInterval(() => {
            invoke('sync_vault', { vaultPath }).catch(console.error);
        }, 30_000);

        return () => clearInterval(interval);
    }, [vaultPath]);

    /**
     * 3. HELPERS
     */
    async function refreshFiles(path: string): Promise<void> {
        try {
            const result = await invoke<FileMetadata[]>('list_files', { vaultPath: path });
            setFiles(result);
        } catch (e) {
            console.error("Error listing files:", e);
        }
    }

    useEffect(() => {
        TessellumApp.instance.workspace.onLinkClick = navigateToWikiLink;
    }, [navigateToWikiLink]);

    /**
     * 4. VAULT SELECTION
     * Using the 'open' dialog from @tauri-apps/plugin-dialog
     * grants the app permission to the selected folder.
     */
    async function handleOpenVault() {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                title: "Select Vault Folder"
            });

            if (selected) {
                await invoke('set_vault_path', { path: selected });
                setVaultPath(selected);
            }
        } catch (e) {
            console.error("Failed to select vault:", e);
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
                        {!vaultPath ? (
                            <div
                                className="w-full h-full flex flex-col items-center justify-center gap-6 select-none"
                                style={{ backgroundColor: theme.colors.gray[50] }}
                            >
                                <div className="text-center space-y-2">
                                    <h1 className="bg-clip-text text-transparent text-4xl font-bold bg-gradient-to-br from-blue-600 to-blue-800">
                                        Tessellum
                                    </h1>
                                    <p className="text-gray-500">Local-first Knowledge Management</p>
                                </div>
                                <button
                                    onClick={handleOpenVault}
                                    className="px-6 py-2.5 text-white bg-blue-600 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
                                >
                                    Open Vault
                                </button>
                            </div>
                        ) : (
                            <div className="flex w-full h-full overflow-hidden">
                                <div className={cn(
                                    "h-full overflow-hidden transition-all duration-300 ease-in-out border-r border-gray-200 dark:border-gray-800",
                                    isSidebarOpen ? "w-64 opacity-100" : "w-0 opacity-0 overflow-hidden border-none"
                                )}>
                                    <Sidebar />
                                </div>

                                {viewMode === 'graph' ? (
                                    <div className="flex-1 h-full min-w-0 relative flex flex-col">
                                        <GraphView />
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex-1 h-full min-w-0 bg-white relative flex flex-col">
                                            <Editor />
                                        </div>
                                        {isLocalGraphOpen && (
                                            <LocalGraphPanel />
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    <Toaster position="bottom-right" richColors />
                </div>
            ) : null}
        </TessellumAppContext.Provider>
    );
}

export default App;