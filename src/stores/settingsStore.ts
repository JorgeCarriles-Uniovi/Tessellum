import { create } from "zustand";
import { isSupportedLocale, type AppLocale } from "../i18n/types.ts";

const FONT_FAMILY_KEY = "tessellum:fontFamily";
const EDITOR_LINE_HEIGHT_KEY = "tessellum:editorLineHeight";
const EDITOR_LETTER_SPACING_KEY = "tessellum:editorLetterSpacing";
const LOCALE_KEY = "tessellum:locale";
const VIM_MODE_KEY = "tessellum:vimMode";
const LINE_NUMBERS_KEY = "tessellum:lineNumbers";
const SPELL_CHECK_KEY = "tessellum:spellCheck";

const DEFAULT_FONT_FAMILY = "Geist Sans";
const DEFAULT_EDITOR_LINE_HEIGHT = 1.7;
const DEFAULT_EDITOR_LETTER_SPACING = 0;
export const DEFAULT_LOCALE: AppLocale = "en";
export const DEFAULT_VIM_MODE = false;
export const DEFAULT_LINE_NUMBERS = false;
export const DEFAULT_SPELL_CHECK = true;

function readString(key: string, fallback: string): string {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return raw;
}

function readNumber(key: string, fallback: number): number {
    const raw = localStorage.getItem(key);
    const parsed = raw ? Number(raw) : NaN;
    if (!Number.isFinite(parsed)) return fallback;
    return parsed;
}

function readBoolean(key: string, fallback: boolean): boolean {
    const raw = localStorage.getItem(key);
    if (raw === "true") return true;
    if (raw === "false") return false;
    return fallback;
}

export function readStoredLocale(): AppLocale {
    const raw = localStorage.getItem(LOCALE_KEY);
    if (raw && isSupportedLocale(raw)) {
        return raw;
    }
    return DEFAULT_LOCALE;
}

export function readStoredVimMode(): boolean {
    return readBoolean(VIM_MODE_KEY, DEFAULT_VIM_MODE);
}

export interface SettingsState {
    fontFamily: string;
    editorLineHeight: number;
    editorLetterSpacing: number;
    locale: AppLocale;
    vimMode: boolean;
    lineNumbers: boolean;
    spellCheck: boolean;
}

export interface SettingsActions {
    setFontFamily: (value: string) => void;
    setEditorLineHeight: (value: number) => void;
    setEditorLetterSpacing: (value: number) => void;
    setLocale: (value: AppLocale) => void;
    setVimMode: (value: boolean) => void;
    setLineNumbers: (value: boolean) => void;
    setSpellCheck: (value: boolean) => void;
}

export type SettingsStore = SettingsState & SettingsActions;

export const useSettingsStore = create<SettingsStore>((set) => ({
    fontFamily: readString(FONT_FAMILY_KEY, DEFAULT_FONT_FAMILY),
    editorLineHeight: readNumber(EDITOR_LINE_HEIGHT_KEY, DEFAULT_EDITOR_LINE_HEIGHT),
    editorLetterSpacing: readNumber(EDITOR_LETTER_SPACING_KEY, DEFAULT_EDITOR_LETTER_SPACING),
    locale: readStoredLocale(),
    vimMode: readStoredVimMode(),
    lineNumbers: readBoolean(LINE_NUMBERS_KEY, DEFAULT_LINE_NUMBERS),
    spellCheck: readBoolean(SPELL_CHECK_KEY, DEFAULT_SPELL_CHECK),

    setFontFamily: (fontFamily) => set(() => {
        localStorage.setItem(FONT_FAMILY_KEY, fontFamily);
        return { fontFamily };
    }),
    setEditorLineHeight: (editorLineHeight) => set(() => {
        localStorage.setItem(EDITOR_LINE_HEIGHT_KEY, String(editorLineHeight));
        return { editorLineHeight };
    }),
    setEditorLetterSpacing: (editorLetterSpacing) => set(() => {
        localStorage.setItem(EDITOR_LETTER_SPACING_KEY, String(editorLetterSpacing));
        return { editorLetterSpacing };
    }),
    setLocale: (locale) => set(() => {
        localStorage.setItem(LOCALE_KEY, locale);
        return { locale };
    }),
    setVimMode: (vimMode) => set(() => {
        localStorage.setItem(VIM_MODE_KEY, String(vimMode));
        return { vimMode };
    }),
    setLineNumbers: (lineNumbers) => set(() => {
        localStorage.setItem(LINE_NUMBERS_KEY, String(lineNumbers));
        return { lineNumbers };
    }),
    setSpellCheck: (spellCheck) => set(() => {
        localStorage.setItem(SPELL_CHECK_KEY, String(spellCheck));
        return { spellCheck };
    }),
}));
