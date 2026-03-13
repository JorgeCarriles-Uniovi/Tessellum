import { create } from 'zustand';
import { FileMetadata } from "../types";

// Sort logic moved to backend list_files_tree command

interface EditorState {
    // State
    vaultPath: string | null;
    files: FileMetadata[]; // Flat list used for fast lookups
    fileTree: import('../types').TreeNode[]; // Hierarchical tree from backend
    activeNote: FileMetadata | null;
    activeNoteContent: string;
    isDirty: boolean;
    expandedFolders: Record<string, boolean>;
    isSidebarOpen: boolean; // <--- NEW STATE
    isRightSidebarOpen: boolean;
    // Graph state
    viewMode: 'editor' | 'graph';
    isLocalGraphOpen: boolean;
    selectedGraphNode: string | null;

    // Actions
    setVaultPath: (path: string | null) => void;
    setFiles: (files: FileMetadata[]) => void;
    setFileTree: (tree: import('../types').TreeNode[]) => void;
    setActiveNote: (file: FileMetadata | null) => void;
    setActiveNoteContent: (content: string) => void;
    setIsDirty: (isDirty: boolean) => void;
    setExpandedFolders: (folders: Record<string, boolean>) => void;
    toggleSidebar: () => void; // <--- NEW ACTION
    toggleRightSidebar: () => void;
    // Graph actions
    setViewMode: (mode: 'editor' | 'graph') => void;
    toggleLocalGraph: () => void;
    setSelectedGraphNode: (path: string | null) => void;

    // Complex Actions
    renameFile: (oldPath: string, newPath: string, newName: string) => void;
    toggleFolder: (path: string, expand?: boolean) => void;
    addFile: (file: FileMetadata) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
    // --- Initial State ---
    vaultPath: localStorage.getItem('vaultPath'),
    files: [],
    fileTree: [],
    activeNote: null,
    activeNoteContent: '',
    isDirty: false,
    expandedFolders: {},
    isSidebarOpen: true, // <--- DEFAULT OPEN
    isRightSidebarOpen: true,
    // Graph initial state
    viewMode: 'editor',
    isLocalGraphOpen: false,
    selectedGraphNode: null,

    // --- Simple Setters ---
    setVaultPath: (path) => {
        if (path) {
            localStorage.setItem('vaultPath', path);
        } else {
            localStorage.removeItem('vaultPath');
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
    setActiveNoteContent: (activeNoteContent) => set({ activeNoteContent }),
    setIsDirty: (isDirty) => set({ isDirty }),
    setExpandedFolders: (folders) => set({ expandedFolders: folders }),

    // <--- TOGGLE IMPLEMENTATION
    toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
    toggleRightSidebar: () => set((state) => ({ isRightSidebarOpen: !state.isRightSidebarOpen })),

    // Graph actions
    setViewMode: (mode) => set({ viewMode: mode, selectedGraphNode: null }),
    toggleLocalGraph: () => set((state) => ({ isLocalGraphOpen: !state.isLocalGraphOpen, selectedGraphNode: null })),
    setSelectedGraphNode: (path) => set({ selectedGraphNode: path }),

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
        files: [...state.files, newFile]
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

