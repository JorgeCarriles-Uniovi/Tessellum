import { useEditorStore } from "../../../stores/editorStore.ts";
import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
export function useCreateFolder() {
    const { vaultPath, toggleFolder, addFile } = useEditorStore();

    // Now accepts name and path as arguments
    return useCallback(async (name: string, parentPath?: string) => {
        const targetDir = parentPath || vaultPath;
        if (!targetDir || !name) return;

        try {
            // 1. Backend Operation
            const newPath = await invoke<string>('create_folder', {
                vaultPath: targetDir,
                folderName: name
            });

            // 2. UI Updates (Side Effects)
            if (parentPath) toggleFolder(parentPath, true);

            // 3. Update Store (Logic is now hidden inside addFile)
            addFile({
                path: newPath,
                filename: name,
                is_dir: true,
                size: 0,
                last_modified: Math.floor(Date.now() / 1000)
            });

            toast.success("Folder created");

        } catch (e: unknown) {
            console.error(e);
            const message = e instanceof Error ? e.message : (typeof e === 'string' ? e : "Failed to create folder");
            toast.error(message);
        }
    }, [vaultPath, toggleFolder, addFile]);
}