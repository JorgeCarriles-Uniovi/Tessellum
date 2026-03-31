import { create } from "zustand";

const EDITOR_FONT_SIZE_KEY = "tessellum:editorFontSizePx";
const SHOW_ADJACENT_PANELS_KEY = "tessellum:showAdjacentPanels";
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

function readInitialShowAdjacentPanels(): boolean {
    const raw = localStorage.getItem(SHOW_ADJACENT_PANELS_KEY);
    if (raw === null) return true;
    return raw === "true";
}

export interface EditorContentState {
    activeNoteContent: string;
    isDirty: boolean;
    editorFontSizePx: number;
    showAdjacentPanels: boolean;
}

export interface EditorContentActions {
    setActiveNoteContent: (content: string) => void;
    setIsDirty: (isDirty: boolean) => void;
    setEditorFontSizePx: (value: number) => void;
    setShowAdjacentPanels: (value: boolean) => void;
}

export type EditorContentStore = EditorContentState & EditorContentActions;

export const useEditorContentStore = create<EditorContentStore>((set) => ({
    activeNoteContent: "",
    isDirty: false,
    editorFontSizePx: readInitialEditorFontSizePx(),
    showAdjacentPanels: readInitialShowAdjacentPanels(),

    setActiveNoteContent: (activeNoteContent) => set({ activeNoteContent }),
    setIsDirty: (isDirty) => set({ isDirty }),
    setEditorFontSizePx: (value) => set(() => {
        const nextValue = clampEditorFontSizePx(value);
        localStorage.setItem(EDITOR_FONT_SIZE_KEY, String(nextValue));
        return { editorFontSizePx: nextValue };
    }),
    setShowAdjacentPanels: (value) => set(() => {
        localStorage.setItem(SHOW_ADJACENT_PANELS_KEY, String(value));
        return { showAdjacentPanels: value };
    }),
}));
