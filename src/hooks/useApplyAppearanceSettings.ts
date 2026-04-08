import { useEffect, useRef } from "react";
import { useAppearanceStore } from "../stores";

const SPACING_BASE_REM: Record<number, number> = {
    0: 0,
    1: 0.25,
    2: 0.5,
    3: 0.75,
    4: 1,
    5: 1.25,
    6: 1.5,
    8: 2,
    10: 2.5,
    12: 3,
    16: 4,
    20: 5,
    24: 6,
};

const RADIUS_PRESETS_PX: Record<"6" | "10" | "16", Record<string, number>> = {
    "6": { sm: 2, base: 3, md: 4, lg: 6, xl: 8, radius: 6 },
    "10": { sm: 3, base: 4, md: 6, lg: 8, xl: 10, radius: 10 },
    "16": { sm: 4, base: 6, md: 8, lg: 12, xl: 16, radius: 16 },
};

const SHADOW_PRESETS: Record<"subtle" | "medium" | "strong", Record<string, string>> = {
    subtle: {
        sm: "0 1px 2px 0 rgb(0 0 0 / 0.04)",
        base: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        md: "0 2px 4px -1px rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.05)",
        lg: "0 6px 10px -4px rgb(0 0 0 / 0.12), 0 4px 6px -2px rgb(0 0 0 / 0.08)",
        xl: "0 12px 16px -8px rgb(0 0 0 / 0.14), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
        modal: "0 20px 40px -16px rgb(0 0 0 / 0.2)",
    },
    medium: {
        sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        base: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px 0 rgb(0 0 0 / 0.06)",
        md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -1px rgb(0 0 0 / 0.06)",
        lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -2px rgb(0 0 0 / 0.05)",
        xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 10px 10px -5px rgb(0 0 0 / 0.04)",
        modal: "0 25px 50px -12px rgb(0 0 0 / 0.25)",
    },
    strong: {
        sm: "0 2px 4px 0 rgb(0 0 0 / 0.12)",
        base: "0 3px 6px 0 rgb(0 0 0 / 0.18), 0 2px 4px 0 rgb(0 0 0 / 0.12)",
        md: "0 8px 12px -2px rgb(0 0 0 / 0.2), 0 4px 6px -2px rgb(0 0 0 / 0.12)",
        lg: "0 16px 24px -6px rgb(0 0 0 / 0.22), 0 8px 12px -4px rgb(0 0 0 / 0.16)",
        xl: "0 28px 36px -12px rgb(0 0 0 / 0.28), 0 18px 22px -10px rgb(0 0 0 / 0.2)",
        modal: "0 36px 60px -16px rgb(0 0 0 / 0.35)",
    },
};

const LIGHTNESS_STOPS = [97, 94, 86, 76, 65, 54, 44, 36, 28, 20];
const BLUE_KEYS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function normalizeHex(hex: string): string | null {
    const cleaned = hex.trim().replace(/^#/, "");
    if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
        return `#${cleaned.split("").map((c) => c + c).join("")}`.toLowerCase();
    }
    if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
        return `#${cleaned}`.toLowerCase();
    }
    return null;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const normalized = normalizeHex(hex);
    if (!normalized) return null;
    const value = normalized.slice(1);
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return { r, g, b };
}

function rgbToHsl({ r, g, b }: { r: number; g: number; b: number }) {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const delta = max - min;

    let h = 0;
    if (delta !== 0) {
        if (max === rn) h = ((gn - bn) / delta) % 6;
        else if (max === gn) h = (bn - rn) / delta + 2;
        else h = (rn - gn) / delta + 4;
        h = Math.round(h * 60);
        if (h < 0) h += 360;
    }

    const l = (max + min) / 2;
    const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

    return {
        h,
        s: Math.round(s * 100),
        l: Math.round(l * 100),
    };
}

function formatRem(value: number): string {
    if (value === 0) return "0";
    return `${Number(value.toFixed(2))}rem`;
}

function setCssVars(vars: Record<string, string>) {
    const root = document.documentElement;
    Object.entries(vars).forEach(([key, value]) => {
        root.style.setProperty(key, value);
    });
}

function applySpacing(density: "compact" | "comfortable") {
    const scale = density === "compact" ? 0.85 : 1;
    const vars: Record<string, string> = {};
    Object.entries(SPACING_BASE_REM).forEach(([key, value]) => {
        vars[`--spacing-${key}`] = formatRem(value * scale);
    });
    setCssVars(vars);
}

function applyRadius(radius: "6" | "10" | "16") {
    const preset = RADIUS_PRESETS_PX[radius];
    setCssVars({
        "--radius": `${preset.radius}px`,
        "--radius-sm": `${preset.sm}px`,
        "--radius-base": `${preset.base}px`,
        "--radius-md": `${preset.md}px`,
        "--radius-lg": `${preset.lg}px`,
        "--radius-xl": `${preset.xl}px`,
    });
}

function applyShadows(shadow: "subtle" | "medium" | "strong") {
    const preset = SHADOW_PRESETS[shadow];
    setCssVars({
        "--shadow-sm": preset.sm,
        "--shadow-base": preset.base,
        "--shadow-md": preset.md,
        "--shadow-lg": preset.lg,
        "--shadow-xl": preset.xl,
        "--shadow-modal": preset.modal,
    });
}

function applyAccentPalette(accentColor: string) {
    const rgb = hexToRgb(accentColor);
    if (!rgb) return;
    const { h, s } = rgbToHsl(rgb);
    const saturation = clamp(s, 35, 90);
    const palette: Record<number, string> = {};
    BLUE_KEYS.forEach((key, idx) => {
        const lightness = LIGHTNESS_STOPS[idx];
        palette[key] = `hsl(${h} ${saturation}% ${lightness}%)`;
    });

    const vars: Record<string, string> = {};
    BLUE_KEYS.forEach((key) => {
        vars[`--color-blue-${key}`] = palette[key];
    });
    vars["--primary"] = palette[600];
    vars["--ring"] = palette[600];
    vars["--sidebar-ring"] = palette[600];
    vars["--color-text-link"] = palette[600];
    setCssVars(vars);
}

export function applyAccentPaletteFromColor(accentColor: string) {
    applyAccentPalette(accentColor);
}

type AppearanceSnapshot = {
    accentColor: string;
    accentSource: "theme" | "custom";
    density: "compact" | "comfortable";
    radius: "6" | "10" | "16";
    shadow: "subtle" | "medium" | "strong";
    iconStyle: "outline" | "filled";
    terminalCustom: boolean;
    terminalHeaderBg: string;
    terminalLineBg: string;
    terminalBorder: string;
    terminalText: string;
    terminalMuted: string;
    syntaxComment: string;
    syntaxKeyword: string;
    syntaxOperator: string;
    syntaxString: string;
    syntaxNumber: string;
    syntaxVariable: string;
    syntaxFunction: string;
    syntaxCustom: boolean;
    inlineCodeColor: string;
    inlineCodeCustom: boolean;
};

function setOrClearCssVars(vars: Record<string, string>, enabled: boolean) {
    const root = document.documentElement;
    Object.entries(vars).forEach(([key, value]) => {
        if (enabled) {
            root.style.setProperty(key, value);
        } else {
            root.style.removeProperty(key);
        }
    });
}

function applyTerminalColors(snapshot: Pick<
    AppearanceSnapshot,
    "terminalHeaderBg" | "terminalLineBg" | "terminalBorder" | "terminalText" | "terminalMuted" | "terminalCustom"
>) {
    setOrClearCssVars({
        "--terminal-header-bg": snapshot.terminalHeaderBg,
        "--terminal-line-bg": snapshot.terminalLineBg,
        "--terminal-border": snapshot.terminalBorder,
        "--terminal-text": snapshot.terminalText,
        "--terminal-muted": snapshot.terminalMuted,
    }, snapshot.terminalCustom);
}

function applySyntaxColors(snapshot: Pick<
    AppearanceSnapshot,
    "syntaxComment" | "syntaxKeyword" | "syntaxOperator" | "syntaxString" | "syntaxNumber" | "syntaxVariable" | "syntaxFunction" | "syntaxCustom"
>) {
    setOrClearCssVars({
        "--syntax-comment": snapshot.syntaxComment,
        "--syntax-keyword": snapshot.syntaxKeyword,
        "--syntax-operator": snapshot.syntaxOperator,
        "--syntax-string": snapshot.syntaxString,
        "--syntax-number": snapshot.syntaxNumber,
        "--syntax-variable": snapshot.syntaxVariable,
        "--syntax-function": snapshot.syntaxFunction,
    }, snapshot.syntaxCustom);
}

function applyInlineCodeColors(snapshot: Pick<
    AppearanceSnapshot,
    "inlineCodeColor" | "inlineCodeCustom"
>) {
    setOrClearCssVars({
        "--code-inline-color": snapshot.inlineCodeColor,
    }, snapshot.inlineCodeCustom);
}

export function applyAppearanceCustomCssVars(snapshot: Pick<
    AppearanceSnapshot,
    | "terminalHeaderBg"
    | "terminalLineBg"
    | "terminalBorder"
    | "terminalText"
    | "terminalMuted"
    | "terminalCustom"
    | "syntaxComment"
    | "syntaxKeyword"
    | "syntaxOperator"
    | "syntaxString"
    | "syntaxNumber"
    | "syntaxVariable"
    | "syntaxFunction"
    | "syntaxCustom"
    | "inlineCodeColor"
    | "inlineCodeCustom"
>) {
    applyTerminalColors(snapshot);
    applySyntaxColors(snapshot);
    applyInlineCodeColors(snapshot);
}

function applyAppearance(snapshot: AppearanceSnapshot) {
    const root = document.documentElement;
    root.dataset.density = snapshot.density;
    root.dataset.iconStyle = snapshot.iconStyle;
    applySpacing(snapshot.density);
    applyRadius(snapshot.radius);
    applyShadows(snapshot.shadow);
    applyAppearanceCustomCssVars(snapshot);
    if (snapshot.accentSource === "custom") {
        applyAccentPalette(snapshot.accentColor);
    }
}

function isSameAppearance(a: AppearanceSnapshot | null, b: AppearanceSnapshot): boolean {
    if (!a) return false;
    return (
        a.accentColor === b.accentColor &&
        a.accentSource === b.accentSource &&
        a.density === b.density &&
        a.radius === b.radius &&
        a.shadow === b.shadow &&
        a.iconStyle === b.iconStyle &&
        a.terminalCustom === b.terminalCustom &&
        a.terminalHeaderBg === b.terminalHeaderBg &&
        a.terminalLineBg === b.terminalLineBg &&
        a.terminalBorder === b.terminalBorder &&
        a.terminalText === b.terminalText &&
        a.terminalMuted === b.terminalMuted &&
        a.syntaxComment === b.syntaxComment &&
        a.syntaxKeyword === b.syntaxKeyword &&
        a.syntaxOperator === b.syntaxOperator &&
        a.syntaxString === b.syntaxString &&
        a.syntaxNumber === b.syntaxNumber &&
        a.syntaxVariable === b.syntaxVariable &&
        a.syntaxFunction === b.syntaxFunction &&
        a.syntaxCustom === b.syntaxCustom &&
        a.inlineCodeColor === b.inlineCodeColor &&
        a.inlineCodeCustom === b.inlineCodeCustom
    );
}

export function useApplyAppearanceSettings() {
    const lastApplied = useRef<AppearanceSnapshot | null>(null);

    useEffect(() => {
        const applyIfChanged = (state: AppearanceSnapshot) => {
            if (isSameAppearance(lastApplied.current, state)) return;
            lastApplied.current = state;
            applyAppearance(state);
        };

        applyIfChanged(useAppearanceStore.getState());
        const unsubscribe = useAppearanceStore.subscribe((state) => {
            applyIfChanged({
                accentColor: state.accentColor,
                accentSource: state.accentSource,
                density: state.density,
                radius: state.radius,
                shadow: state.shadow,
                iconStyle: state.iconStyle,
                terminalCustom: state.terminalCustom,
                terminalHeaderBg: state.terminalHeaderBg,
                terminalLineBg: state.terminalLineBg,
                terminalBorder: state.terminalBorder,
                terminalText: state.terminalText,
                terminalMuted: state.terminalMuted,
                syntaxComment: state.syntaxComment,
                syntaxKeyword: state.syntaxKeyword,
                syntaxOperator: state.syntaxOperator,
                syntaxString: state.syntaxString,
                syntaxNumber: state.syntaxNumber,
                syntaxVariable: state.syntaxVariable,
                syntaxFunction: state.syntaxFunction,
                syntaxCustom: state.syntaxCustom,
                inlineCodeColor: state.inlineCodeColor,
                inlineCodeCustom: state.inlineCodeCustom,
            });
        });

        return unsubscribe;
    }, []);
}
