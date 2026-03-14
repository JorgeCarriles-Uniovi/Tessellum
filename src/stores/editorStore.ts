import { create } from "zustand";
import type { FileMetadata, TreeNode } from "../types";
import { useVaultStore } from "./vaultStore";
import {
    useEditorContentStore,
    DEFAULT_EDITOR_FONT_SIZE_PX,
    clampEditorFontSizePx,
    nextEditorFontSizePx,
} from "./editorContentStore";
import { useUiStore } from "./uiStore";
import { useGraphStore } from "./graphStore";
import { useSelectionStore } from "./selectionStore";

// Legacy compatibility layer. Prefer the specialized stores for new code.
export { useVaultStore, useEditorContentStore, useUiStore, useGraphStore, useSelectionStore };
export { DEFAULT_EDITOR_FONT_SIZE_PX, clampEditorFontSizePx, nextEditorFontSizePx };

interface EditorState {
    // State
    vaultPath: string | null;
    files: FileMetadata[]; // Flat list used for fast lookups
    fileTree: TreeNode[]; // Hierarchical tree from backend
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
    viewMode: "editor" | "graph";
    isLocalGraphOpen: boolean;
    selectedGraphNode: string | null;

    // Actions
    setVaultPath: (path: string | null) => void;
    setFiles: (files: FileMetadata[]) => void;
    setFileTree: (tree: TreeNode[]) => void;
    setActiveNote: (file: FileMetadata | null) => void;
    setActiveNoteContent: (content: string) => void;
    setIsDirty: (isDirty: boolean) => void;
    setExpandedFolders: (folders: Record<string, boolean>) => void;
    toggleSidebar: () => void;
    toggleRightSidebar: () => void;
    setSelectedFilePaths: (paths: string[]) => void;
    selectOnly: (path: string) => void;
    toggleSelection: (path: string) => void;
    rangeSelect: (orderedPaths: string[], targetPath: string) => void;
    clearSelection: () => void;
    setEditorFontSizePx: (value: number) => void;
    // Graph actions
    setViewMode: (mode: "editor" | "graph") => void;
    toggleLocalGraph: () => void;
    setSelectedGraphNode: (path: string | null) => void;

    // Complex Actions
    renameFile: (oldPath: string, newPath: string, newName: string) => void;
    toggleFolder: (path: string, expand?: boolean) => void;
    addFile: (file: FileMetadata) => void;
}

export const useEditorStore = create<EditorState>(() => {
    const vault = useVaultStore.getState();
    const editorContent = useEditorContentStore.getState();
    const ui = useUiStore.getState();
    const graph = useGraphStore.getState();
    const selection = useSelectionStore.getState();

    return {
        // State
        vaultPath: vault.vaultPath,
        files: vault.files,
        fileTree: vault.fileTree,
        activeNote: vault.activeNote,
        activeNoteContent: editorContent.activeNoteContent,
        isDirty: editorContent.isDirty,
        expandedFolders: ui.expandedFolders,
        isSidebarOpen: ui.isSidebarOpen,
        isRightSidebarOpen: ui.isRightSidebarOpen,
        selectedFilePaths: selection.selectedFilePaths,
        lastSelectedPath: selection.lastSelectedPath,
        editorFontSizePx: editorContent.editorFontSizePx,
        // Graph state
        viewMode: graph.viewMode,
        isLocalGraphOpen: graph.isLocalGraphOpen,
        selectedGraphNode: graph.selectedGraphNode,

        // Actions
        setVaultPath: (path) => useVaultStore.getState().setVaultPath(path),
        setFiles: (files) => useVaultStore.getState().setFiles(files),
        setFileTree: (tree) => useVaultStore.getState().setFileTree(tree),
        setActiveNote: (file) => useVaultStore.getState().setActiveNote(file),
        setActiveNoteContent: (content) => useEditorContentStore.getState().setActiveNoteContent(content),
        setIsDirty: (isDirty) => useEditorContentStore.getState().setIsDirty(isDirty),
        setExpandedFolders: (folders) => useUiStore.getState().setExpandedFolders(folders),
        toggleSidebar: () => useUiStore.getState().toggleSidebar(),
        toggleRightSidebar: () => useUiStore.getState().toggleRightSidebar(),
        setSelectedFilePaths: (paths) => useSelectionStore.getState().setSelectedFilePaths(paths),
        selectOnly: (path) => useSelectionStore.getState().selectOnly(path),
        toggleSelection: (path) => useSelectionStore.getState().toggleSelection(path),
        rangeSelect: (orderedPaths, targetPath) => useSelectionStore.getState().rangeSelect(orderedPaths, targetPath),
        clearSelection: () => useSelectionStore.getState().clearSelection(),
        setEditorFontSizePx: (value) => useEditorContentStore.getState().setEditorFontSizePx(value),
        // Graph actions
        setViewMode: (mode) => useGraphStore.getState().setViewMode(mode),
        toggleLocalGraph: () => useGraphStore.getState().toggleLocalGraph(),
        setSelectedGraphNode: (path) => useGraphStore.getState().setSelectedGraphNode(path),

        // Complex Actions
        renameFile: (oldPath, newPath, newName) => useVaultStore.getState().renameFile(oldPath, newPath, newName),
        toggleFolder: (path, expand) => useUiStore.getState().toggleFolder(path, expand),
        addFile: (file) => useVaultStore.getState().addFile(file),
    };
});

useVaultStore.subscribe((state) => {
    useEditorStore.setState({
        vaultPath: state.vaultPath,
        files: state.files,
        fileTree: state.fileTree,
        activeNote: state.activeNote,
    });
});

useEditorContentStore.subscribe((state) => {
    useEditorStore.setState({
        activeNoteContent: state.activeNoteContent,
        isDirty: state.isDirty,
        editorFontSizePx: state.editorFontSizePx,
    });
});

useUiStore.subscribe((state) => {
    useEditorStore.setState({
        expandedFolders: state.expandedFolders,
        isSidebarOpen: state.isSidebarOpen,
        isRightSidebarOpen: state.isRightSidebarOpen,
    });
});

useSelectionStore.subscribe((state) => {
    useEditorStore.setState({
        selectedFilePaths: state.selectedFilePaths,
        lastSelectedPath: state.lastSelectedPath,
    });
});

useGraphStore.subscribe((state) => {
    useEditorStore.setState({
        viewMode: state.viewMode,
        isLocalGraphOpen: state.isLocalGraphOpen,
        selectedGraphNode: state.selectedGraphNode,
    });
});
