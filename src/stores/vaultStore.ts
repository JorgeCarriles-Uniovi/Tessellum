import { create } from "zustand";
import type { FileMetadata, TreeNode } from "../types";

export interface VaultState {
    vaultPath: string | null;
    files: FileMetadata[];
    fileTree: TreeNode[];
    activeNote: FileMetadata | null;
}

export interface VaultActions {
    setVaultPath: (path: string | null) => void;
    setFiles: (files: FileMetadata[]) => void;
    setFileTree: (tree: TreeNode[]) => void;
    setActiveNote: (file: FileMetadata | null) => void;
    renameFile: (oldPath: string, newPath: string, newName: string) => void;
    addFile: (file: FileMetadata) => void;
}

export type VaultStore = VaultState & VaultActions;

export const useVaultStore = create<VaultStore>((set) => ({
    vaultPath: localStorage.getItem("vaultPath"),
    files: [],
    fileTree: [],
    activeNote: null,

    setVaultPath: (path) => {
        if (path) {
            localStorage.setItem("vaultPath", path);
        } else {
            localStorage.removeItem("vaultPath");
        }
        set({ vaultPath: path });
    },
    setFiles: (files) => set({ files }),
    setFileTree: (fileTree) => set({ fileTree }),
    setActiveNote: (activeNote) => set(() => {
        if (!activeNote) {
            return { activeNote: null };
        }
        return {
            activeNote,
        };
    }),
    addFile: (newFile) => set((state) => ({
        files: [...state.files, newFile],
        // Note: The tree refresh happens via backend file-changed event
    })),
    renameFile: (oldPath, newPath, newFilename) => set((state) => {
        const updatedFiles = state.files.map((f) =>
            f.path === oldPath
                ? { ...f, path: newPath, filename: newFilename }
                : f
        );

        const shouldUpdateActive = state.activeNote?.path === oldPath;
        const updatedActiveNote = shouldUpdateActive
            ? { ...state.activeNote!, path: newPath, filename: newFilename }
            : state.activeNote;

        return {
            files: updatedFiles,
            activeNote: updatedActiveNote,
        };
    }),
}));
