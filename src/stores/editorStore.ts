import {create} from 'zustand';
import {FileMetadata} from "../types.ts";

interface EditorState {
    vaultPath: string | null;
    files: FileMetadata[];
    activeNote: FileMetadata | null;
    activeNoteContent: string;
    isDirty: boolean;

    setVaultPath: (path: string) => void;
    setFiles: (files: FileMetadata[]) => void;
    setActiveNote: (file: FileMetadata | null) => void;
    setActiveNoteContent: (content: string) => void;
    setIsDirty: (isDirty: boolean) => void;
    renameFile: (oldPath: string, newFilename: string) => void;

    expandedFolders: Record<string, boolean>;
    toggleFolder: (path: string, expand?: boolean) => void;
}

export const useEditorStore = create<EditorState>((set:any) => ({
    vaultPath: localStorage.getItem('vaultPath'),
    files: [],
    activeNote: null,
    activeNoteContent: '',
    isDirty: false,
    expandedFolders: {},

    setVaultPath: (path: string) => {
        localStorage.setItem('vaultPath', path);
        set({vaultPath: path});
    },
    setFiles: (files: FileMetadata[]) => set({files}),
    setActiveNote: (note: FileMetadata | null) => set({activeNote: note}),
    setActiveNoteContent: (content: string) => set({activeNoteContent: content}),
    setIsDirty: (isDirty:boolean) => set({isDirty}),
    renameFile: (newPath: string, newFilename: string) => set((state:any) => {
        // 1. Safety check
        if (!state.activeNote) return {};

        // 2. Create the New Note Object
        const updatedNote = {
            ...state.activeNote,
            path: newPath,
            filename: newFilename,
            last_modified: Math.floor(Date.now() / 1000), // Optional: Update timestamp
        };

        // 3. Update the List (Swap old for new)
        const updatedFiles = state.files.map((f:any) =>
            f.path === state.activeNote?.path ? updatedNote : f
        );

        // Optional: Re-sort alphabetical
        updatedFiles.sort((a:any,b:any) => {
            if(a.is_dir === b.is_dir) return a.filename.localeCompare(b.filename);
            return a.is_dir ? -1 : 1;
        });

        // 4. IMPORTANT: Return BOTH to update the UI and keep selection
        return {
            files: updatedFiles,
            activeNote: updatedNote, // 👈 This keeps the editor open/selected
        };
    }),
    toggleFolder: (path: string, forceState?: boolean) => set((state: any) => {
        const current = state.expandedFolders[path] || false;
        // If forceState is provided (true/false), use it. Otherwise toggle.
        const nextState = forceState !== undefined ? forceState : !current;

        return {
            expandedFolders: {
                ...state.expandedFolders,
                [path]: nextState
            }
        };
    }),
}));