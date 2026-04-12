import { create } from "zustand";
import { isSupportedLocale, type AppLocale } from "../i18n/types.ts";

const FONT_FAMILY_KEY = "tessellum:fontFamily";
const EDITOR_LINE_HEIGHT_KEY = "tessellum:editorLineHeight";
const EDITOR_LETTER_SPACING_KEY = "tessellum:editorLetterSpacing";
const LOCALE_KEY = "tessellum:locale";

const DEFAULT_FONT_FAMILY = "Geist Sans";
const DEFAULT_EDITOR_LINE_HEIGHT = 1.7;
const DEFAULT_EDITOR_LETTER_SPACING = 0;
export const DEFAULT_LOCALE: AppLocale = "en";

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

export function readStoredLocale(): AppLocale {
    const raw = localStorage.getItem(LOCALE_KEY);
    if (raw && isSupportedLocale(raw)) {
        return raw;
    }
    return DEFAULT_LOCALE;
}

export interface SettingsState {
    fontFamily: string;
    editorLineHeight: number;
    editorLetterSpacing: number;
    locale: AppLocale;
}

export interface SettingsActions {
    setFontFamily: (value: string) => void;
    setEditorLineHeight: (value: number) => void;
    setEditorLetterSpacing: (value: number) => void;
    setLocale: (value: AppLocale) => void;
}

export type SettingsStore = SettingsState & SettingsActions;

export const useSettingsStore = create<SettingsStore>((set) => ({
    fontFamily: readString(FONT_FAMILY_KEY, DEFAULT_FONT_FAMILY),
    editorLineHeight: readNumber(EDITOR_LINE_HEIGHT_KEY, DEFAULT_EDITOR_LINE_HEIGHT),
    editorLetterSpacing: readNumber(EDITOR_LETTER_SPACING_KEY, DEFAULT_EDITOR_LETTER_SPACING),
    locale: readStoredLocale(),

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
}));
