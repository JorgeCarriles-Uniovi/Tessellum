import { create } from "zustand";
import type { FileMetadata, TreeNode } from "../types";

export interface VaultState {
    vaultPath: string | null;
    files: FileMetadata[];
    fileTree: TreeNode[];
    activeNote: FileMetadata | null;
    openTabPaths: string[];
}

export interface VaultActions {
    setVaultPath: (path: string | null) => void;
    setFiles: (files: FileMetadata[]) => void;
    setFileTree: (tree: TreeNode[]) => void;
    setActiveNote: (file: FileMetadata | null) => void;
    restoreWorkspaceTabs: (tabPaths: string[], activePath?: string | null) => void;
    reorderOpenTabs: (sourcePath: string, targetPath: string) => void;
    closeTab: (path: string) => void;
    closeOtherTabs: (path: string) => void;
    closeAllTabs: () => void;
    renameFile: (oldPath: string, newPath: string, newName: string) => void;
    addFile: (file: FileMetadata) => void;
    addFileIfMissing: (file: FileMetadata) => void;
}

export type VaultStore = VaultState & VaultActions;

export const useVaultStore = create<VaultStore>((set) => ({
    vaultPath: localStorage.getItem("vaultPath"),
    files: [],
    fileTree: [],
    activeNote: null,
    openTabPaths: [],

    setVaultPath: (path) => {
        if (path) {
            localStorage.setItem("vaultPath", path);
        } else {
            localStorage.removeItem("vaultPath");
        }
        // Reset per-vault volatile state when changing vault scope.
        set({ vaultPath: path, activeNote: null, openTabPaths: [] });
    },
    setFiles: (files) => set((state) => {
        const fileByPath = new Map(files.map((file) => [file.path, file]));
        const nextOpenTabs = state.openTabPaths.filter((path) => fileByPath.has(path));
        const nextActiveNote = state.activeNote ? fileByPath.get(state.activeNote.path) ?? null : null;

        return {
            files,
            openTabPaths: nextOpenTabs,
            activeNote: nextActiveNote,
        };
    }),
    setFileTree: (fileTree) => set({ fileTree }),
    setActiveNote: (activeNote) => set((state) => {
        if (!activeNote) {
            return { activeNote: null };
        }
        return {
            activeNote,
            openTabPaths: state.openTabPaths.includes(activeNote.path)
                ? state.openTabPaths
                : [...state.openTabPaths, activeNote.path],
        };
    }),
    restoreWorkspaceTabs: (tabPaths, activePath) => set((state) => {
        const fileByPath = new Map(state.files.map((file) => [file.path, file]));
        // Restore only existing files and keep tab order stable without duplicates.
        const validUniqueTabs = Array.from(
            new Set(tabPaths.filter((path) => fileByPath.has(path)))
        );

        const nextActivePath = activePath && fileByPath.has(activePath)
            ? activePath
            : validUniqueTabs[0] ?? null;

        return {
            openTabPaths: validUniqueTabs,
            activeNote: nextActivePath ? fileByPath.get(nextActivePath) ?? null : null,
        };
    }),
    reorderOpenTabs: (sourcePath, targetPath) => set((state) => {
        if (sourcePath === targetPath) {
            return state;
        }

        const sourceIndex = state.openTabPaths.indexOf(sourcePath);
        const targetIndex = state.openTabPaths.indexOf(targetPath);
        if (sourceIndex < 0 || targetIndex < 0) {
            return state;
        }

        const reorderedTabs = [...state.openTabPaths];
        const [moved] = reorderedTabs.splice(sourceIndex, 1);
        reorderedTabs.splice(targetIndex, 0, moved);
        return { openTabPaths: reorderedTabs };
    }),
    closeTab: (path) => set((state) => {
        if (!state.openTabPaths.includes(path)) {
            return state;
        }

        const closingIndex = state.openTabPaths.indexOf(path);
        const nextOpenTabs = state.openTabPaths.filter((item) => item !== path);

        if (state.activeNote?.path !== path) {
            return { openTabPaths: nextOpenTabs };
        }

        if (nextOpenTabs.length === 0) {
            return { openTabPaths: [], activeNote: null };
        }

        const fallbackPath = nextOpenTabs[Math.min(closingIndex, nextOpenTabs.length - 1)];
        const fallbackNote = state.files.find((file) => file.path === fallbackPath) ?? null;

        return { openTabPaths: nextOpenTabs, activeNote: fallbackNote };
    }),
    closeOtherTabs: (path) => set((state) => {
        if (!state.openTabPaths.includes(path)) {
            return state;
        }
        const active = state.files.find((file) => file.path === path) ?? state.activeNote;
        return {
            openTabPaths: [path],
            activeNote: active,
        };
    }),
    closeAllTabs: () => set(() => ({
        openTabPaths: [],
        activeNote: null,
    })),
    addFile: (newFile) => set((state) => ({
        files: [...state.files, newFile],
        // Note: The tree refresh happens via backend file-changed event
    })),
    addFileIfMissing: (newFile) => set((state) => {
        const exists = state.files.some((f) => f.path === newFile.path);
        if (exists) {
            return state;
        }
        return {
            files: [...state.files, newFile],
        };
    }),
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
        const updatedTabs = state.openTabPaths.map((path) => (path === oldPath ? newPath : path));

        return {
            files: updatedFiles,
            activeNote: updatedActiveNote,
            openTabPaths: updatedTabs,
        };
    }),
}));

