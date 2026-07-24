import { useThemeStore } from "../stores/themeStore";
import type { ThemeDefinition } from "../themes/builtinThemes";
import { DEFAULT_THEME_NAME } from "../themes/builtinThemes";

const PAIRS: Record<string, string> = {
    "Warm Paper": "Warm Paper Dark",
    "Warm Paper Dark": "Warm Paper",
    "Default": "Default Dark",
    "Default Dark": "Default",
    "Ocean": "Ocean Dark",
    "Ocean Dark": "Ocean",
    "Catppuccin Latte": "Catppuccin Mocha",
    "Catppuccin Mocha": "Catppuccin Latte",
};

export function getSiblingThemeName(current: string, themes: ThemeDefinition[]): string {
    const active = themes.find((t) => t.name === current);
    const targetVariant = active?.variant === "dark" ? "light" : "dark";
    const paired = PAIRS[current];
    if (paired && themes.some((t) => t.name === paired && t.variant === targetVariant)) {
        return paired;
    }
    const fallback = themes.find((t) => t.variant === targetVariant);
    return fallback?.name ?? current;
}

export function useColorMode() {
    const activeTheme = useThemeStore((s) => s.activeTheme);
    const themes = useThemeStore((s) => s.themes);
    const setActiveTheme = useThemeStore((s) => s.setActiveTheme);
    const variant: "light" | "dark" = activeTheme?.variant === "dark" ? "dark" : "light";
    const toggle = () => {
        const name = getSiblingThemeName(activeTheme?.name ?? DEFAULT_THEME_NAME, themes);
        setActiveTheme(name);
    };
    return { variant, toggle };
}
