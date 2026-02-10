import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileMetadata } from "./types.ts";
import { useEditorStore } from "./stores/editorStore.ts";
import { listen } from "@tauri-apps/api/event";
import { open } from '@tauri-apps/plugin-dialog';
import { Editor } from "./components/Editor/Editor.tsx";
import { Sidebar } from "./components/Sidebar/Sidebar.tsx";
import { Toaster } from "sonner";
import { theme } from './styles/theme';
import 'katex';
import { cn } from "./lib/utils";
import { TitleBar } from "./components/TitleBar/TitleBar";

function App() {
    // Add isSidebarOpen to the destructuring
    const { vaultPath, setVaultPath, setFiles, isSidebarOpen } = useEditorStore();

    useEffect(() => {
        if (vaultPath) {
            invoke('watch_vault', { vaultPath }).catch(console.error);
            refreshFiles(vaultPath);
        }
    }, [vaultPath]);

    useEffect(() => {
        if(vaultPath) {
            invoke('sync_vault', { vaultPath }).catch(console.error);
        }
    })

    useEffect(() => {
        const unlistenPromise = listen('file-changed', () => {
            if (vaultPath) refreshFiles(vaultPath);
        });
        return () => { unlistenPromise.then(unlisten => unlisten()); };
    }, [vaultPath]);

    async function refreshFiles(vaultPath: string): Promise<void> {
        try {
            const result = await invoke<FileMetadata[]>('list_files', { vaultPath });
            setFiles(result);
        } catch (e) { console.error(e); }
    }

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
                        {/* Logic to hide/show sidebar */}
                        {/* You can use conditional rendering or CSS hiding for animation support */}
                        <div className={cn(
                            "h-full overflow-hidden transition-all duration-300 ease-in-out border-r border-gray-200 dark:border-gray-800",
                            isSidebarOpen ? "w-64 opacity-100" : "w-0 opacity-0 overflow-hidden border-none"
                        )}>
                            <Sidebar />
                        </div>

                        <div className="flex-1 h-full min-w-0 bg-white relative flex flex-col">
                            <Editor />
                        </div>
                    </div>
                )}
            </div>

            <Toaster position="bottom-right" richColors />
        </div>
    );
}

export default App;