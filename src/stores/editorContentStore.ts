import { create } from "zustand";

export type AutoSaveStatusKind = "idle" | "pending" | "saving" | "saved" | "error";

export interface AutoSaveStatus {
    status: AutoSaveStatusKind;
    lastSavedAt: number | null;
    errorMessage: string | null;
}

const DEFAULT_AUTO_SAVE_STATUS: AutoSaveStatus = {
    status: "idle",
    lastSavedAt: null,
    errorMessage: null,
};

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



export interface EditorContentState {
    activeNoteContent: string;
    isDirty: boolean;
    /**
     * Every open path with unsaved edits, not just the active one.
     *
     * `isDirty` describes only the active note, so a close guard keyed on it
     * cannot protect background tabs. Keep both: `isDirty` drives the active
     * editor's save indicator, `dirtyPaths` drives per-tab decisions.
     */
    dirtyPaths: Set<string>;
    editorFontSizePx: number;
    autoSaveStatus: AutoSaveStatus;
}

export interface EditorContentActions {
    setActiveNoteContent: (content: string) => void;
    setIsDirty: (isDirty: boolean) => void;
    markPathDirty: (path: string) => void;
    markPathClean: (path: string) => void;
    setEditorFontSizePx: (value: number) => void;
    setAutoSaveStatus: (status: AutoSaveStatus) => void;
}

export type EditorContentStore = EditorContentState & EditorContentActions;

export const useEditorContentStore = create<EditorContentStore>((set) => ({
    activeNoteContent: "",
    isDirty: false,
    dirtyPaths: new Set<string>(),
    editorFontSizePx: readInitialEditorFontSizePx(),
    autoSaveStatus: DEFAULT_AUTO_SAVE_STATUS,

    setActiveNoteContent: (activeNoteContent) => set({ activeNoteContent }),
    setIsDirty: (isDirty) => set({ isDirty }),

    markPathDirty: (path) =>
        set((s) => {
            if (s.dirtyPaths.has(path)) return s;
            const next = new Set(s.dirtyPaths);
            next.add(path);
            return { dirtyPaths: next };
        }),

    markPathClean: (path) =>
        set((s) => {
            if (!s.dirtyPaths.has(path)) return s;
            const next = new Set(s.dirtyPaths);
            next.delete(path);
            return { dirtyPaths: next };
        }),

    setEditorFontSizePx: (value) => set(() => {
        const nextValue = clampEditorFontSizePx(value);
        localStorage.setItem(EDITOR_FONT_SIZE_KEY, String(nextValue));
        return { editorFontSizePx: nextValue };
    }),
    setAutoSaveStatus: (autoSaveStatus) => set({ autoSaveStatus }),
}));
