import { create } from "zustand";

const HIGH_CONTRAST_KEY = "tessellum:accessibility:highContrast";
const REDUCED_MOTION_KEY = "tessellum:accessibility:reducedMotion";
const UI_SCALE_KEY = "tessellum:accessibility:uiScale";
const COLOR_FILTER_KEY = "tessellum:accessibility:colorFilter";

const DEFAULT_HIGH_CONTRAST = false;
const DEFAULT_UI_SCALE = 100;
const DEFAULT_COLOR_FILTER = "none";

const UI_SCALE_OPTIONS = [90, 100, 110, 125, 150] as const;
export type UiScale = typeof UI_SCALE_OPTIONS[number];
export type ColorFilter = "none" | "protanopia" | "deuteranopia" | "tritanopia";

function readString(key: string, fallback: string): string {
    const raw = localStorage.getItem(key);
    return raw ?? fallback;
}

function readBoolean(key: string, fallback: boolean): boolean {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === "true";
}

function readNumber(key: string, fallback: number): number {
    const raw = localStorage.getItem(key);
    const parsed = raw ? Number(raw) : NaN;
    if (!Number.isFinite(parsed)) return fallback;
    return parsed;
}

function readInitialReducedMotion(): boolean {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return false;
    }
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function coerceUiScale(value: number): UiScale {
    if (UI_SCALE_OPTIONS.includes(value as UiScale)) return value as UiScale;
    return DEFAULT_UI_SCALE;
}

function coerceColorFilter(value: string): ColorFilter {
    if (value === "protanopia" || value === "deuteranopia" || value === "tritanopia") {
        return value;
    }
    return "none";
}

export interface AccessibilityState {
    highContrast: boolean;
    reducedMotion: boolean;
    uiScale: UiScale;
    colorFilter: ColorFilter;
}

export interface AccessibilityActions {
    setHighContrast: (value: boolean) => void;
    setReducedMotion: (value: boolean) => void;
    setUiScale: (value: UiScale) => void;
    setColorFilter: (value: ColorFilter) => void;
}

export type AccessibilityStore = AccessibilityState & AccessibilityActions;

export const useAccessibilityStore = create<AccessibilityStore>((set) => ({
    highContrast: readBoolean(HIGH_CONTRAST_KEY, DEFAULT_HIGH_CONTRAST),
    reducedMotion: readBoolean(REDUCED_MOTION_KEY, readInitialReducedMotion()),
    uiScale: coerceUiScale(readNumber(UI_SCALE_KEY, DEFAULT_UI_SCALE)),
    colorFilter: coerceColorFilter(readString(COLOR_FILTER_KEY, DEFAULT_COLOR_FILTER)),

    setHighContrast: (highContrast) => set(() => {
        localStorage.setItem(HIGH_CONTRAST_KEY, String(highContrast));
        return { highContrast };
    }),
    setReducedMotion: (reducedMotion) => set(() => {
        localStorage.setItem(REDUCED_MOTION_KEY, String(reducedMotion));
        return { reducedMotion };
    }),
    setUiScale: (uiScale) => set(() => {
        const nextValue = coerceUiScale(uiScale);
        localStorage.setItem(UI_SCALE_KEY, String(nextValue));
        return { uiScale: nextValue };
    }),
    setColorFilter: (colorFilter) => set(() => {
        const nextValue = coerceColorFilter(colorFilter);
        localStorage.setItem(COLOR_FILTER_KEY, nextValue);
        return { colorFilter: nextValue };
    }),
}));
