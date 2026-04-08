import { create } from "zustand";
import { homeDir, join, extname } from "@tauri-apps/api/path";
import { mkdir, readDir, readTextFile, watch, type UnwatchFn } from "@tauri-apps/plugin-fs";
import { BUILTIN_THEMES, DEFAULT_THEME_NAME, type ThemeDefinition } from "../themes/builtinThemes";
import { getCssVarForToken, type ThemeTokenKey, type ThemeTokenMap } from "../themes/themeTokens";
import { normalizeThemeName, parseJsonTheme, parseFlatYaml, parseThemeDefinition } from "../themes/themeUtils";
import {
    applyAccentPaletteFromColor,
    applyAppearanceCustomCssVars,
} from "../hooks/useApplyAppearanceSettings";
import { useAppearanceStore } from "./appearanceStore";

const THEME_STORAGE_KEY = "tessellum:appearance:theme";

export interface ThemeState {
    themes: ThemeDefinition[];
    activeThemeName: string;
    activeTheme: ThemeDefinition | null;
    loadThemes: () => Promise<void>;
    setActiveTheme: (name: string) => void;
    startWatching: () => Promise<void>;
    stopWatching: () => void;
}

let unwatchFn: UnwatchFn | null = null;
let watchPending = false;

function buildCssVars(tokens: ThemeTokenMap): Record<string, string> {
    const vars: Record<string, string> = {};
    (Object.entries(tokens) as Array<[ThemeTokenKey, string]>).forEach(([tokenKey, value]) => {
        const cssVar = getCssVarForToken(tokenKey);
        if (cssVar && value) {
            vars[cssVar] = value;
        }
    });
    return vars;
}

function applyCssVars(vars: Record<string, string>) {
    const root = document.documentElement;
    Object.entries(vars).forEach(([key, value]) => {
        root.style.setProperty(key, value);
    });
}

function applyTheme(theme: ThemeDefinition, fallback: ThemeDefinition) {
    applyCssVars(buildCssVars(fallback.tokens));
    applyCssVars(buildCssVars(theme.tokens));
    applyAppearanceCustomCssVars(useAppearanceStore.getState());
    const root = document.documentElement;
    root.dataset.theme = theme.variant;
    root.dataset.themeName = theme.name;
    root.classList.toggle("dark", theme.variant === "dark");
}

function getDefaultTheme(): ThemeDefinition {
    return BUILTIN_THEMES.find((theme) => theme.name === DEFAULT_THEME_NAME) ?? BUILTIN_THEMES[0];
}

function getStoredThemeName(): string {
    return localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME_NAME;
}

function getAccentFromTheme(theme: ThemeDefinition, fallback: ThemeDefinition): string | null {
    return theme.tokens["accent.default"] || fallback.tokens["accent.default"] || null;
}

function applyThemeAccent(theme: ThemeDefinition, fallback: ThemeDefinition, force = false) {
    const appearance = useAppearanceStore.getState();
    const accent = getAccentFromTheme(theme, fallback);
    if (!accent) return;
    if (force) {
        appearance.setAccentFromTheme(accent);
        applyAccentPaletteFromColor(accent);
        return;
    }
    if (appearance.accentSource !== "theme") return;
    applyAccentPaletteFromColor(accent);
}

async function getThemeDir(): Promise<string> {
    const home = await homeDir();
    return join(home, ".tessellum", ".themes");
}

async function ensureThemeDir(): Promise<string> {
    const dir = await getThemeDir();
    try {
        await mkdir(dir, { recursive: true });
    } catch {
        // ignore
    }
    return dir;
}

async function loadUserThemes(): Promise<ThemeDefinition[]> {
    const dir = await ensureThemeDir();
    const entries = await readDir(dir);
    const themes: ThemeDefinition[] = [];

    for (const entry of entries) {
        if (!entry.isFile) continue;
        const extension = (await extname(entry.name || "")).toLowerCase();
        if (![".json", ".yaml", ".yml"].includes(extension)) continue;
        try {
            const fullPath = await join(dir, entry.name);
            const contents = await readTextFile(fullPath);
            const raw = extension === ".json" ? parseJsonTheme(contents) : parseFlatYaml(contents);
            if (!raw) continue;
            const parsed = parseThemeDefinition(raw, "user", "light");
            if (parsed) {
                themes.push(parsed);
            }
        } catch {
            // ignore invalid files
        }
    }

    return themes;
}

function mergeThemes(builtin: ThemeDefinition[], user: ThemeDefinition[]): ThemeDefinition[] {
    const byName = new Map<string, ThemeDefinition>();
    builtin.forEach((theme) => {
        byName.set(normalizeThemeName(theme.name), theme);
    });
    user.forEach((theme) => {
        byName.set(normalizeThemeName(theme.name), theme);
    });
    return Array.from(byName.values());
}

export const useThemeStore = create<ThemeState>((set, get) => ({
    themes: BUILTIN_THEMES,
    activeThemeName: getStoredThemeName(),
    activeTheme: (() => {
        const storedName = getStoredThemeName();
        const fallback = getDefaultTheme();
        const initial = BUILTIN_THEMES.find((theme) => normalizeThemeName(theme.name) === normalizeThemeName(storedName)) || fallback;
        if (typeof document !== "undefined") {
            applyTheme(initial, fallback);
            applyThemeAccent(initial, fallback);
        }
        return initial;
    })(),

    loadThemes: async () => {
        const userThemes = await loadUserThemes();
        const merged = mergeThemes(BUILTIN_THEMES, userThemes);
        const storedName = getStoredThemeName();
        const fallback = getDefaultTheme();
        const active = merged.find((theme) => normalizeThemeName(theme.name) === normalizeThemeName(storedName)) || fallback;
        set({
            themes: merged,
            activeThemeName: active.name,
            activeTheme: active,
        });
        applyTheme(active, fallback);
        applyThemeAccent(active, fallback);
        localStorage.setItem(THEME_STORAGE_KEY, active.name);
    },

    setActiveTheme: (name: string) => {
        const { themes } = get();
        const fallback = getDefaultTheme();
        const next = themes.find((theme) => normalizeThemeName(theme.name) === normalizeThemeName(name)) || fallback;
        set({ activeThemeName: next.name, activeTheme: next });
        applyTheme(next, fallback);
        applyThemeAccent(next, fallback, true);
        localStorage.setItem(THEME_STORAGE_KEY, next.name);
    },

    startWatching: async () => {
        if (unwatchFn || watchPending) return;
        watchPending = true;
        try {
            const dir = await ensureThemeDir();
            unwatchFn = await watch(dir, async () => {
                await get().loadThemes();
            }, { delayMs: 200 });
        } catch {
            unwatchFn = null;
        } finally {
            watchPending = false;
        }
    },

    stopWatching: () => {
        if (unwatchFn) {
            unwatchFn();
            unwatchFn = null;
        }
    },
}));
