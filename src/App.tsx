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
import 'katex'

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
            <div
                // We keep layout classes (flex, w-screen) but remove color classes
                className="h-screen w-screen flex flex-col items-center justify-center gap-6 select-none"
                style={{
                    backgroundColor: theme.colors.gray[50],
                    fontFamily: theme.typography.fontFamily.sans
                }}
            >
                <div className="text-center space-y-2">
                    <h1
                        className="bg-clip-text text-transparent"
                        style={{
                            fontSize: theme.typography.fontSize['4xl'],
                            fontWeight: theme.typography.fontWeight.bold,
                            // Creating a gradient using your theme's Blue palette
                            backgroundImage: `linear-gradient(to bottom right, ${theme.colors.blue[600]}, ${theme.colors.blue[800]})`
                        }}
                    >
                        Tessellum
                    </h1>
                    <p style={{ color: theme.colors.text.muted }}>
                        Local-first Knowledge Management
                    </p>
                </div>
                <button
                    onClick={handleOpenVault}
                    className="px-6 py-2.5 text-white shadow-sm transition-all hover:scale-105 active:scale-95"
                    style={{
                        backgroundColor: theme.colors.blue[600],
                        borderRadius: theme.borderRadius.lg,
                        fontWeight: theme.typography.fontWeight.medium,
                    }}
                    // Optional: Add hover state logic here or use CSS modules for cleaner hover handling
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.colors.blue[700]}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme.colors.blue[600]}
                >
                    Open Vault
                </button>
            </div>
        );
    }

    return (
        <div
            className="flex h-screen w-screen overflow-hidden"
            style={{
                backgroundColor: theme.colors.background.primary,
                fontFamily: theme.typography.fontFamily.sans
            }}
        >
            <Sidebar />
            <div className="flex-1 h-full">
                <Editor />
            </div>

            <Toaster position="bottom-right" richColors />
        </div>
    );
}

export default App;