import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileMetadata, TreeNode } from "./types.ts";
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
import { useWikiLinkNavigation } from "./components/Editor/hooks";

function App() {
    // Add isSidebarOpen to the destructuring
    const { vaultPath, setVaultPath, setFiles, setFileTree, isSidebarOpen, viewMode, isLocalGraphOpen } = useEditorStore();
    const [isLoaded, setIsLoaded] = useState(false);

    const navigateToWikiLink = useWikiLinkNavigation();


    // Create TessellumApp singleton and register plugins.
    const app = useMemo(() => {
        // Handle React StrictMode double-invocation gracefully
        const isNew = !(TessellumApp as any)._instance;
        const instance = TessellumApp.create();
        if (isNew) {
            registerBuiltinPlugins(instance);
        }
        return instance;
    }, []);

    // Manage plugin lifecycle safely outside of useMemo
    useEffect(() => {
        app.plugins.loadAll();
        setIsLoaded(true);
        return () => {
            setIsLoaded(false);
            app.plugins.unloadAll();
        };
    }, [app]);

    // Validate vaultPath existence on startup
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
            refreshFiles(vaultPath);
        }
    }, [vaultPath]);

    useEffect(() => {
        const unlistenPromise = listen('file-changed', () => {
            if (vaultPath) refreshFiles(vaultPath);
        });
        return () => { unlistenPromise.then(unlisten => unlisten()); };
    }, [vaultPath]);

    // Periodic vault sync to pick up external filesystem changes
    useEffect(() => {
        if (!vaultPath) return;

        // Initial sync on vault load
        invoke('sync_vault', { vaultPath }).catch(console.error);

        // Re-sync every 5 minutes
        const interval = setInterval(() => {
            invoke('sync_vault', { vaultPath }).catch(console.error);
        }, 300_000);

        return () => clearInterval(interval);
    }, [vaultPath]);

    async function refreshFiles(vaultPath: string): Promise<void> {
        try {
            const [flatFiles, treeFiles] = await Promise.all([
                invoke<FileMetadata[]>('list_files', { vaultPath }),
                invoke<TreeNode[]>('list_files_tree', { vaultPath })
            ]);
            setFiles(flatFiles);
            setFileTree(treeFiles);
        } catch (e) { console.error(e); }
    }

    useEffect(() => {
        TessellumApp.instance.workspace.onLinkClick = navigateToWikiLink;
    }, [navigateToWikiLink]);

    async function handleOpenVault() {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                title: "Select Vault Folder"
            });
            if (selected) setVaultPath(selected);
        } catch (e) { console.error(e); }
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
                    {/* TitleBar controls the isSidebarOpen state */}
                    <TitleBar />

                    <div className="flex-1 flex overflow-hidden w-full relative">
                        {!vaultPath ? (
                            <div
                                className="w-full h-full flex flex-col items-center justify-center gap-6 select-none"
                                style={{ backgroundColor: theme.colors.gray[50] }}
                            >
                                {/* ... Welcome Screen Content ... */}
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
                                {/* Sidebar */}
                                <div className={cn(
                                    "h-full overflow-hidden transition-all duration-300 ease-in-out border-r border-gray-200 dark:border-gray-800",
                                    isSidebarOpen ? "w-64 opacity-100" : "w-0 opacity-0 overflow-hidden border-none"
                                )}>
                                    <Sidebar />
                                </div>

                                {/* Main content area */}
                                {viewMode === 'graph' ? (
                                    /* Global Graph View — replaces the editor */
                                    <div className="flex-1 h-full min-w-0 relative flex flex-col">
                                        <GraphView />
                                    </div>
                                ) : (
                                    /* Editor + optional Local Graph Panel */
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