import { create } from "zustand";
import { DEFAULT_EDITOR_MODE, type EditorMode } from "../constants/editorModes";

export interface EditorModeState {
    editorMode: EditorMode;
}

export interface EditorModeActions {
    setEditorMode: (mode: EditorMode) => void;
}

export type EditorModeStore = EditorModeState & EditorModeActions;

export const useEditorModeStore = create<EditorModeStore>((set) => ({
    editorMode: DEFAULT_EDITOR_MODE,
    setEditorMode: (editorMode) => set({ editorMode }),
}));
