import { create } from 'zustand';
import { FileMetadata } from "../types";

const EDITOR_FONT_SIZE_KEY = "tessellum:editorFontSizePx";
export const DEFAULT_EDITOR_FONT_SIZE_PX = 16;
const MIN_EDITOR_FONT_SIZE_PX = 12;
const MAX_EDITOR_FONT_SIZE_PX = 24;

export function clampEditorFontSizePx(value: number): number {
    return Math.min(MAX_EDITOR_FONT_SIZE_PX, Math.max(MIN_EDITOR_FONT_SIZE_PX, value));
}

export function nextEditorFontSizePx(current: number, delta: number): number {
    if (!delta) return clampEditorFontSizePx(current);
    return clampEditorFontSizePx(current + delta);
}

function readInitialEditorFontSizePx(): number {
    const raw = localStorage.getItem(EDITOR_FONT_SIZE_KEY);
    const parsed = raw ? Number(raw) : NaN;
    if (!Number.isFinite(parsed)) return DEFAULT_EDITOR_FONT_SIZE_PX;
    return clampEditorFontSizePx(parsed);
}
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
    isSidebarOpen: boolean;
    isRightSidebarOpen: boolean;
    selectedFilePaths: string[];
    lastSelectedPath: string | null;
    editorFontSizePx: number;
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
    setSelectedFilePaths: (paths: string[]) => void;
    selectOnly: (path: string) => void;
    toggleSelection: (path: string) => void;
    rangeSelect: (orderedPaths: string[], targetPath: string) => void;
    clearSelection: () => void;
    setEditorFontSizePx: (value: number) => void;
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
    isSidebarOpen: true,
    isRightSidebarOpen: true,
    selectedFilePaths: [],
    lastSelectedPath: null,
    editorFontSizePx: readInitialEditorFontSizePx(),
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

    setSelectedFilePaths: (paths) => set({ selectedFilePaths: paths }),
    selectOnly: (path) => set(() => ({
        selectedFilePaths: [path],
        lastSelectedPath: path
    })),
    toggleSelection: (path) => set((state) => {
        const alreadySelected = state.selectedFilePaths.includes(path);
        const nextSelection = alreadySelected
            ? state.selectedFilePaths.filter((p) => p !== path)
            : [...state.selectedFilePaths, path];
        return {
            selectedFilePaths: nextSelection,
            lastSelectedPath: path
        };
    }),
    rangeSelect: (orderedPaths, targetPath) => set((state) => {
        const from = state.lastSelectedPath ?? targetPath;
        const fromIndex = orderedPaths.indexOf(from);
        const toIndex = orderedPaths.indexOf(targetPath);
        if (fromIndex === -1 || toIndex === -1) {
            return {
                selectedFilePaths: [targetPath],
                lastSelectedPath: targetPath
            };
        }
        const [start, end] = fromIndex < toIndex ? [fromIndex, toIndex] : [toIndex, fromIndex];
        const nextSelection = orderedPaths.slice(start, end + 1);
        return {
            selectedFilePaths: nextSelection,
            lastSelectedPath: targetPath
        };
    }),
    clearSelection: () => set({ selectedFilePaths: [], lastSelectedPath: null }),
    setEditorFontSizePx: (value) => set(() => {
        const nextValue = clampEditorFontSizePx(value);
        localStorage.setItem(EDITOR_FONT_SIZE_KEY, String(nextValue));
        return { editorFontSizePx: nextValue };
    }),

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