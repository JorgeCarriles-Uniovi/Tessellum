import { create } from 'zustand';
import { FileMetadata } from "../types";

// --- 1. Define Helper Logic (Pure Functions) ---
const sortFiles = (files: FileMetadata[]) => {
    return [...files].sort((a, b) => {
        // Folders first, then alphabetically
        if (a.is_dir === b.is_dir) return a.filename.localeCompare(b.filename);
        return a.is_dir ? -1 : 1;
    });
};

interface EditorState {
    // State
    vaultPath: string | null;
    files: FileMetadata[];
    activeNote: FileMetadata | null;
    activeNoteContent: string;
    isDirty: boolean;
    expandedFolders: Record<string, boolean>;
    isSidebarOpen: boolean; // <--- NEW STATE

    // Actions
    setVaultPath: (path: string) => void;
    setFiles: (files: FileMetadata[]) => void;
    setActiveNote: (file: FileMetadata | null) => void;
    setActiveNoteContent: (content: string) => void;
    setIsDirty: (isDirty: boolean) => void;
    toggleSidebar: () => void; // <--- NEW ACTION

    // Complex Actions
    renameFile: (oldPath: string, newPath: string, newName: string) => void;
    toggleFolder: (path: string, expand?: boolean) => void;
    addFile: (file: FileMetadata) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
    // --- Initial State ---
    vaultPath: localStorage.getItem('vaultPath'),
    files: [],
    activeNote: null,
    activeNoteContent: '',
    isDirty: false,
    expandedFolders: {},
    isSidebarOpen: true, // <--- DEFAULT OPEN

    // --- Simple Setters ---
    setVaultPath: (path) => {
        localStorage.setItem('vaultPath', path);
        set({ vaultPath: path });
    },
    setFiles: function(files) { return set({ files: sortFiles(files) }) },
    setActiveNote: function(activeNote) { return set({ activeNote }) },
    setActiveNoteContent: function(activeNoteContent) { return set({ activeNoteContent }) },
    setIsDirty: (isDirty) => set({ isDirty }),

    // <--- TOGGLE IMPLEMENTATION
    toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

    // --- Complex Logic ---

    toggleFolder: (path, forceState) => set((state) => {
        const nextState = forceState !== undefined
            ? forceState
            : !state.expandedFolders[path];

        return {
            expandedFolders: { ...state.expandedFolders, [path]: nextState }
        };
    }),

    addFile: (newFile) => set((state) => ({
        files: sortFiles([...state.files, newFile])
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
            files: sortFiles(updatedFiles),
            activeNote: updatedActiveNote
        };
    }),
}));