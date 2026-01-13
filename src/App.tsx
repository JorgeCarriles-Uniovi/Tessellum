import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {FileMetadata} from "./types.ts";
import {useEditorStore} from "./stores/editorStore.ts";
import {listen} from "@tauri-apps/api/event";
import {path} from "@tauri-apps/api";
import { open } from '@tauri-apps/plugin-dialog';
import {Editor} from "./components/Editor.tsx";
import {VaultExplorer} from "./components/VaultExplorer.tsx";


function App() {
  const {vaultPath, setVaultPath, setFiles} = useEditorStore();


  // If there is a vaultPath, watch it for changes
  useEffect(() =>{
    if (vaultPath) {
        invoke('watch_vault', {vaultPath}).catch(console.error);
        refreshFiles(vaultPath);
    }
  }, [vaultPath]);

  // Refresh files when a change is detected (file-changed event from backend)
  useEffect(() => {
      const unlistenPromise = listen('file-changed', () => {
          if (vaultPath) {
              refreshFiles(vaultPath);
          }
      });
      return () => {
          unlistenPromise.then(unlisten => unlisten());
      };
  }, [vaultPath]);

    // @ts-ignore
    /**
     * Refreshes the list of files in the specified vault path by invoking a file listing operation,
     * sorting the results, and updating the file state.
     *
     * @param {string} vaultPath - The path of the vault directory for which the files need to be refreshed.
     * @return {Promise<void>} A promise that resolves when the file refreshing process is completed.
     */

    async function refreshFiles(vaultPath: string): Promise<void> {
      try {
          const result = await invoke<FileMetadata[]>('list_files', {vaultPath})
          const sorted = result.sort((a,b) => {
              if(a.is_dir === b.is_dir)
                  return a.filename.localeCompare(b.filename);
              return a.is_dir ? -1 : 1;
          });

          setFiles(sorted);

      } catch (e) {console.error(e);}
  }

  async function handleOpenVault() {
      try {
          const selected = await open({
              directory: true,
              multiple: false,
              title: "Select Vault Folder"
          });

          if (selected) {
              setVaultPath(selected);
          }

      } catch (e) {console.error(e);}
  }

  if(!vaultPath) {
      return (
          <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-50 gap-6 select-none">
              <div className="text-center space-y-2">
                  <h1 className="text-4xl font-bold bg-gradient-to-br from-indigo-600 to-purple-600 bg-clip-text text-transparent">Tessellum</h1>
                  <p className="text-gray-500">Local-first Knowledge Management</p>
              </div>
              <button
                  onClick={handleOpenVault}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition-all hover:scale-105 active:scale-95"
              >
                  Open Vault
              </button>
          </div>
      );
  }

    return (
        <div className="flex h-screen w-screen bg-white text-gray-900 font-sans overflow-hidden">
            <VaultExplorer />
            <div className="flex-1 flex flex-col min-w-0 bg-white">
                <Editor />
            </div>
        </div>
    );

}

export default App;
