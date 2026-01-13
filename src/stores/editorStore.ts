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

}

export const useEditorStore = create<EditorState>((set:any) => ({
    vaultPath: localStorage.getItem('vaultPath'),
    files: [],
    activeNote: null,
    activeNoteContent: '',
    isDirty: false,

    setVaultPath: (path: string) => {
        localStorage.setItem('vaultPath', path);
        set({vaultPath: path});
    },
    setFiles: (files: FileMetadata[]) => set({files}),
    setActiveNote: (note: FileMetadata | null) => set({activeNote: note}),
    setActiveNoteContent: (content: string) => set({activeNoteContent: content}),
    setIsDirty: (isDirty:boolean) => set({isDirty}),

}));