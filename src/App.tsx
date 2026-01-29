import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileMetadata } from "./types.ts";
import { useEditorStore } from "./stores/editorStore.ts";
import { listen } from "@tauri-apps/api/event";
import { open } from '@tauri-apps/plugin-dialog';
import { Editor } from "./components/Editor.tsx";
import { Sidebar } from "./components/Sidebar.tsx";
import { Toaster } from "sonner";
import 'katex/dist/katex.min.css';

function App() {
    const {vaultPath, setVaultPath, setFiles} = useEditorStore();

    /// Watch vault folder for changes
    useEffect(() =>{
        if (vaultPath) {
            invoke('watch_vault', {vaultPath}).catch(console.error);
            refreshFiles(vaultPath);
        }
    }, [vaultPath]);

    /// Listen for file changes

    useEffect(() => {
        const unlistenPromise = listen('file-changed', () => {
            if (vaultPath) refreshFiles(vaultPath);
        });
        return () => { unlistenPromise.then(unlisten => unlisten()); };
    }, [vaultPath]);

    /// Refresh files list
    async function refreshFiles(vaultPath: string): Promise<void> {
        try {
            const result = await invoke<FileMetadata[]>('list_files', {vaultPath});
            setFiles(result);
        } catch (e) {console.error(e);}
    }

    /// Open vault folder dialog
    async function handleOpenVault() {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                title: "Select Vault Folder"
            });
            if (selected) setVaultPath(selected);
        } catch (e) {console.error(e);}
    }
    
    if(!vaultPath) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-50 gap-6 select-none">
                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-bold bg-gradient-to-br from-indigo-600 to-purple-600 bg-clip-text text-transparent">Tessellum</h1>
                    <p className="text-gray-500">Local-first Knowledge Management</p>
                </div>
                <button onClick={handleOpenVault} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition-all hover:scale-105 active:scale-95">
                    Open Vault
                </button>
            </div>
        );
    }

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-white">
            <Sidebar />
            <div className="flex-1 h-full ">
                <Editor />
            </div>

            <Toaster position="bottom-right" richColors />
        </div>
    );
}

export default App;