import { create } from 'zustand';
import { FileMetadata } from "../types";

// --- 1. Define Helper Logic (Pure Functions) ---
// Moving this out keeps the store clean and reusable
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

    // Actions
    setVaultPath: (path: string) => void;
    setFiles: (files: FileMetadata[]) => void;
    setActiveNote: (file: FileMetadata | null) => void;
    setActiveNoteContent: (content: string) => void;
    setIsDirty: (isDirty: boolean) => void;

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

    // --- Simple Setters ---
    setVaultPath: (path) => {
        localStorage.setItem('vaultPath', path);
        set({ vaultPath: path });
    },
    setFiles: (files) => set({ files: sortFiles(files) }), // Auto-sort on set
    setActiveNote: (activeNote) => set({ activeNote }),
    setActiveNoteContent: (activeNoteContent) => set({ activeNoteContent }),
    setIsDirty: (isDirty) => set({ isDirty }),

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

    // Refactored to be safer and simpler
    renameFile: (oldPath, newPath, newFilename) => set((state) => {
        // 1. Find and update the file in the list
        const updatedFiles = state.files.map((f) =>
            f.path === oldPath
                ? { ...f, path: newPath, filename: newFilename }
                : f
        );

        // 2. Determine if we need to update the activeNote
        // (Only if the file being renamed is the one currently open)
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