import { create } from "zustand";

const ACCENT_COLOR_KEY = "tessellum:appearance:accentColor";
const ACCENT_SOURCE_KEY = "tessellum:appearance:accentSource";
const DENSITY_KEY = "tessellum:appearance:density";
const RADIUS_KEY = "tessellum:appearance:radius";
const SHADOW_KEY = "tessellum:appearance:shadow";
const ICON_STYLE_KEY = "tessellum:appearance:iconStyle";
const SIDEBAR_POSITION_KEY = "tessellum:appearance:sidebarPosition";
const TOOLBAR_VISIBLE_KEY = "tessellum:appearance:toolbarVisible";
// Legacy per-field keys kept for migration reads only.
const TERMINAL_HEADER_BG_KEY = "tessellum:appearance:terminalHeaderBg";
const TERMINAL_LINE_BG_KEY = "tessellum:appearance:terminalLineBg";
const TERMINAL_BORDER_KEY = "tessellum:appearance:terminalBorder";
const TERMINAL_TEXT_KEY = "tessellum:appearance:terminalText";
const TERMINAL_MUTED_KEY = "tessellum:appearance:terminalMuted";
const TERMINAL_CUSTOM_KEY = "tessellum:appearance:terminalCustom";
// Single key for all terminal color fields — avoids multi-write window.
const TERMINAL_COLORS_KEY = "tessellum:appearance:terminalColors";
const SYNTAX_COMMENT_KEY = "tessellum:appearance:syntaxComment";
const SYNTAX_KEYWORD_KEY = "tessellum:appearance:syntaxKeyword";
const SYNTAX_OPERATOR_KEY = "tessellum:appearance:syntaxOperator";
const SYNTAX_STRING_KEY = "tessellum:appearance:syntaxString";
const SYNTAX_NUMBER_KEY = "tessellum:appearance:syntaxNumber";
const SYNTAX_VARIABLE_KEY = "tessellum:appearance:syntaxVariable";
const SYNTAX_FUNCTION_KEY = "tessellum:appearance:syntaxFunction";
const SYNTAX_CUSTOM_KEY = "tessellum:appearance:syntaxCustom";
const INLINE_CODE_COLOR_KEY = "tessellum:appearance:inlineCodeColor";
const INLINE_CODE_CUSTOM_KEY = "tessellum:appearance:inlineCodeCustom";
const THEME_SCHEDULE_MODE_KEY = "tessellum:appearance:themeScheduleMode";
const THEME_SCHEDULE_LIGHT_START_KEY = "tessellum:appearance:themeScheduleLightStart";
const THEME_SCHEDULE_DARK_START_KEY = "tessellum:appearance:themeScheduleDarkStart";
const THEME_SCHEDULE_LAT_KEY = "tessellum:appearance:themeScheduleLat";
const THEME_SCHEDULE_LON_KEY = "tessellum:appearance:themeScheduleLon";

export type Density = "compact" | "comfortable";
export type ShadowStrength = "subtle" | "medium" | "strong";
export type IconStyle = "outline" | "filled";
export type SidebarPosition = "left" | "right";

export interface AppearanceState {
    accentColor: string;
    accentSource: "theme" | "custom";
    density: Density;
    radius: "6" | "10" | "16";
    shadow: ShadowStrength;
    iconStyle: IconStyle;
    sidebarPosition: SidebarPosition;
    toolbarVisible: boolean;
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
    themeScheduleMode: "off" | "system" | "sun" | "custom";
    themeScheduleLightStart: string;
    themeScheduleDarkStart: string;
    themeScheduleLat: number | null;
    themeScheduleLon: number | null;
}

export interface AppearanceActions {
    setAccentColor: (value: string) => void;
    setAccentFromTheme: (value: string) => void;
    setDensity: (value: Density) => void;
    setRadius: (value: "6" | "10" | "16") => void;
    setShadow: (value: ShadowStrength) => void;
    setIconStyle: (value: IconStyle) => void;
    setSidebarPosition: (value: SidebarPosition) => void;
    setToolbarVisible: (value: boolean) => void;
    setTerminalCustom: (value: boolean) => void;
    setTerminalHeaderBg: (value: string) => void;
    setTerminalLineBg: (value: string) => void;
    setTerminalBorder: (value: string) => void;
    setTerminalText: (value: string) => void;
    setTerminalMuted: (value: string) => void;
    setSyntaxComment: (value: string) => void;
    setSyntaxKeyword: (value: string) => void;
    setSyntaxOperator: (value: string) => void;
    setSyntaxString: (value: string) => void;
    setSyntaxNumber: (value: string) => void;
    setSyntaxVariable: (value: string) => void;
    setSyntaxFunction: (value: string) => void;
    setSyntaxCustom: (value: boolean) => void;
    setInlineCodeColor: (value: string) => void;
    setInlineCodeCustom: (value: boolean) => void;
    setThemeScheduleMode: (value: "off" | "system" | "sun" | "custom") => void;
    setThemeScheduleLightStart: (value: string) => void;
    setThemeScheduleDarkStart: (value: string) => void;
    setThemeScheduleLocation: (lat: number | null, lon: number | null) => void;
}

export type AppearanceStore = AppearanceState & AppearanceActions;

const DEFAULT_ACCENT_COLOR = "#3d14b8";
const DEFAULT_TERMINAL_HEADER_BG = "#0d1117";
const DEFAULT_TERMINAL_LINE_BG = "#24292e";
const DEFAULT_TERMINAL_BORDER = "#30363d";
const DEFAULT_TERMINAL_TEXT = "#c9d1d9";
const DEFAULT_TERMINAL_MUTED = "#959da5";
const DEFAULT_SYNTAX_COMMENT = "#a0a1a7";
const DEFAULT_SYNTAX_KEYWORD = "#a626a4";
const DEFAULT_SYNTAX_OPERATOR = "#0184bc";
const DEFAULT_SYNTAX_STRING = "#50a14f";
const DEFAULT_SYNTAX_NUMBER = "#986801";
const DEFAULT_SYNTAX_VARIABLE = "#e45649";
const DEFAULT_SYNTAX_FUNCTION = "#4078f2";
const DEFAULT_INLINE_CODE_COLOR = "#111827";
const DEFAULT_THEME_SCHEDULE_MODE: AppearanceState["themeScheduleMode"] = "off";
const DEFAULT_THEME_SCHEDULE_LIGHT_START = "08:00";
const DEFAULT_THEME_SCHEDULE_DARK_START = "20:00";

function readString(key: string, fallback: string): string {
    const raw = localStorage.getItem(key);
    return raw ?? fallback;
}

function readAccentSource(): "theme" | "custom" {
    const stored = localStorage.getItem(ACCENT_SOURCE_KEY);
    if (stored === "theme" || stored === "custom") return stored;
    return "theme";
}

function readBoolean(key: string, fallback: boolean): boolean {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === "true";
}

function readOptionalNumber(key: string): number | null {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === "") return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
}

interface TerminalColors {
    custom: boolean;
    headerBg: string;
    lineBg: string;
    border: string;
    text: string;
    muted: string;
}

function readTerminalColors(): TerminalColors {
    const raw = localStorage.getItem(TERMINAL_COLORS_KEY);
    if (raw) {
        try {
            const parsed = JSON.parse(raw) as Partial<TerminalColors>;
            return {
                custom: parsed.custom ?? false,
                headerBg: parsed.headerBg ?? DEFAULT_TERMINAL_HEADER_BG,
                lineBg: parsed.lineBg ?? DEFAULT_TERMINAL_LINE_BG,
                border: parsed.border ?? DEFAULT_TERMINAL_BORDER,
                text: parsed.text ?? DEFAULT_TERMINAL_TEXT,
                muted: parsed.muted ?? DEFAULT_TERMINAL_MUTED,
            };
        } catch { /* fall through to legacy migration */ }
    }
    // Migrate from legacy per-field keys.
    const colors: TerminalColors = {
        custom: readBoolean(TERMINAL_CUSTOM_KEY, false),
        headerBg: readString(TERMINAL_HEADER_BG_KEY, DEFAULT_TERMINAL_HEADER_BG),
        lineBg: readString(TERMINAL_LINE_BG_KEY, DEFAULT_TERMINAL_LINE_BG),
        border: readString(TERMINAL_BORDER_KEY, DEFAULT_TERMINAL_BORDER),
        text: readString(TERMINAL_TEXT_KEY, DEFAULT_TERMINAL_TEXT),
        muted: readString(TERMINAL_MUTED_KEY, DEFAULT_TERMINAL_MUTED),
    };
    localStorage.setItem(TERMINAL_COLORS_KEY, JSON.stringify(colors));
    return colors;
}

function writeTerminalColors(colors: TerminalColors): void {
    localStorage.setItem(TERMINAL_COLORS_KEY, JSON.stringify(colors));
}

export const useAppearanceStore = create<AppearanceStore>((set) => ({
    accentColor: readString(ACCENT_COLOR_KEY, DEFAULT_ACCENT_COLOR),
    accentSource: readAccentSource(),
    density: readString(DENSITY_KEY, "comfortable") as Density,
    radius: readString(RADIUS_KEY, "10") as AppearanceState["radius"],
    shadow: readString(SHADOW_KEY, "medium") as ShadowStrength,
    iconStyle: readString(ICON_STYLE_KEY, "outline") as IconStyle,
    sidebarPosition: readString(SIDEBAR_POSITION_KEY, "left") as SidebarPosition,
    toolbarVisible: readBoolean(TOOLBAR_VISIBLE_KEY, true),
    ...(() => {
        const tc = readTerminalColors();
        return {
            terminalCustom: tc.custom,
            terminalHeaderBg: tc.headerBg,
            terminalLineBg: tc.lineBg,
            terminalBorder: tc.border,
            terminalText: tc.text,
            terminalMuted: tc.muted,
        };
    })(),
    syntaxComment: readString(SYNTAX_COMMENT_KEY, DEFAULT_SYNTAX_COMMENT),
    syntaxKeyword: readString(SYNTAX_KEYWORD_KEY, DEFAULT_SYNTAX_KEYWORD),
    syntaxOperator: readString(SYNTAX_OPERATOR_KEY, DEFAULT_SYNTAX_OPERATOR),
    syntaxString: readString(SYNTAX_STRING_KEY, DEFAULT_SYNTAX_STRING),
    syntaxNumber: readString(SYNTAX_NUMBER_KEY, DEFAULT_SYNTAX_NUMBER),
    syntaxVariable: readString(SYNTAX_VARIABLE_KEY, DEFAULT_SYNTAX_VARIABLE),
    syntaxFunction: readString(SYNTAX_FUNCTION_KEY, DEFAULT_SYNTAX_FUNCTION),
    syntaxCustom: readBoolean(SYNTAX_CUSTOM_KEY, false),
    inlineCodeColor: readString(INLINE_CODE_COLOR_KEY, DEFAULT_INLINE_CODE_COLOR),
    inlineCodeCustom: readBoolean(INLINE_CODE_CUSTOM_KEY, false),
    themeScheduleMode: readString(THEME_SCHEDULE_MODE_KEY, DEFAULT_THEME_SCHEDULE_MODE) as AppearanceState["themeScheduleMode"],
    themeScheduleLightStart: readString(THEME_SCHEDULE_LIGHT_START_KEY, DEFAULT_THEME_SCHEDULE_LIGHT_START),
    themeScheduleDarkStart: readString(THEME_SCHEDULE_DARK_START_KEY, DEFAULT_THEME_SCHEDULE_DARK_START),
    themeScheduleLat: readOptionalNumber(THEME_SCHEDULE_LAT_KEY),
    themeScheduleLon: readOptionalNumber(THEME_SCHEDULE_LON_KEY),

    setAccentColor: (accentColor) => set(() => {
        localStorage.setItem(ACCENT_COLOR_KEY, accentColor);
        localStorage.setItem(ACCENT_SOURCE_KEY, "custom");
        return { accentColor, accentSource: "custom" };
    }),
    setAccentFromTheme: (accentColor) => set(() => {
        localStorage.setItem(ACCENT_COLOR_KEY, accentColor);
        localStorage.setItem(ACCENT_SOURCE_KEY, "theme");
        return { accentColor, accentSource: "theme" };
    }),
    setDensity: (density) => set(() => {
        localStorage.setItem(DENSITY_KEY, density);
        return { density };
    }),
    setRadius: (radius) => set(() => {
        localStorage.setItem(RADIUS_KEY, radius);
        return { radius };
    }),
    setShadow: (shadow) => set(() => {
        localStorage.setItem(SHADOW_KEY, shadow);
        return { shadow };
    }),
    setIconStyle: (iconStyle) => set(() => {
        localStorage.setItem(ICON_STYLE_KEY, iconStyle);
        return { iconStyle };
    }),
    setSidebarPosition: (sidebarPosition) => set(() => {
        localStorage.setItem(SIDEBAR_POSITION_KEY, sidebarPosition);
        return { sidebarPosition };
    }),
    setToolbarVisible: (toolbarVisible) => set(() => {
        localStorage.setItem(TOOLBAR_VISIBLE_KEY, String(toolbarVisible));
        return { toolbarVisible };
    }),
    setTerminalCustom: (terminalCustom) => set((state) => {
        writeTerminalColors({
            custom: terminalCustom,
            headerBg: state.terminalHeaderBg,
            lineBg: state.terminalLineBg,
            border: state.terminalBorder,
            text: state.terminalText,
            muted: state.terminalMuted,
        });
        return { terminalCustom };
    }),
    setTerminalHeaderBg: (terminalHeaderBg) => set((state) => {
        writeTerminalColors({
            custom: true,
            headerBg: terminalHeaderBg,
            lineBg: state.terminalLineBg,
            border: state.terminalBorder,
            text: state.terminalText,
            muted: state.terminalMuted,
        });
        return { terminalHeaderBg, terminalCustom: true };
    }),
    setTerminalLineBg: (terminalLineBg) => set((state) => {
        writeTerminalColors({
            custom: true,
            headerBg: state.terminalHeaderBg,
            lineBg: terminalLineBg,
            border: state.terminalBorder,
            text: state.terminalText,
            muted: state.terminalMuted,
        });
        return { terminalLineBg, terminalCustom: true };
    }),
    setTerminalBorder: (terminalBorder) => set((state) => {
        writeTerminalColors({
            custom: true,
            headerBg: state.terminalHeaderBg,
            lineBg: state.terminalLineBg,
            border: terminalBorder,
            text: state.terminalText,
            muted: state.terminalMuted,
        });
        return { terminalBorder, terminalCustom: true };
    }),
    setTerminalText: (terminalText) => set((state) => {
        writeTerminalColors({
            custom: true,
            headerBg: state.terminalHeaderBg,
            lineBg: state.terminalLineBg,
            border: state.terminalBorder,
            text: terminalText,
            muted: state.terminalMuted,
        });
        return { terminalText, terminalCustom: true };
    }),
    setTerminalMuted: (terminalMuted) => set((state) => {
        writeTerminalColors({
            custom: true,
            headerBg: state.terminalHeaderBg,
            lineBg: state.terminalLineBg,
            border: state.terminalBorder,
            text: state.terminalText,
            muted: terminalMuted,
        });
        return { terminalMuted, terminalCustom: true };
    }),
    setSyntaxComment: (syntaxComment) => set(() => {
        localStorage.setItem(SYNTAX_COMMENT_KEY, syntaxComment);
        localStorage.setItem(SYNTAX_CUSTOM_KEY, "true");
        return { syntaxComment, syntaxCustom: true };
    }),
    setSyntaxKeyword: (syntaxKeyword) => set(() => {
        localStorage.setItem(SYNTAX_KEYWORD_KEY, syntaxKeyword);
        localStorage.setItem(SYNTAX_CUSTOM_KEY, "true");
        return { syntaxKeyword, syntaxCustom: true };
    }),
    setSyntaxOperator: (syntaxOperator) => set(() => {
        localStorage.setItem(SYNTAX_OPERATOR_KEY, syntaxOperator);
        localStorage.setItem(SYNTAX_CUSTOM_KEY, "true");
        return { syntaxOperator, syntaxCustom: true };
    }),
    setSyntaxString: (syntaxString) => set(() => {
        localStorage.setItem(SYNTAX_STRING_KEY, syntaxString);
        localStorage.setItem(SYNTAX_CUSTOM_KEY, "true");
        return { syntaxString, syntaxCustom: true };
    }),
    setSyntaxNumber: (syntaxNumber) => set(() => {
        localStorage.setItem(SYNTAX_NUMBER_KEY, syntaxNumber);
        localStorage.setItem(SYNTAX_CUSTOM_KEY, "true");
        return { syntaxNumber, syntaxCustom: true };
    }),
    setSyntaxVariable: (syntaxVariable) => set(() => {
        localStorage.setItem(SYNTAX_VARIABLE_KEY, syntaxVariable);
        localStorage.setItem(SYNTAX_CUSTOM_KEY, "true");
        return { syntaxVariable, syntaxCustom: true };
    }),
    setSyntaxFunction: (syntaxFunction) => set(() => {
        localStorage.setItem(SYNTAX_FUNCTION_KEY, syntaxFunction);
        localStorage.setItem(SYNTAX_CUSTOM_KEY, "true");
        return { syntaxFunction, syntaxCustom: true };
    }),
    setSyntaxCustom: (syntaxCustom) => set(() => {
        localStorage.setItem(SYNTAX_CUSTOM_KEY, String(syntaxCustom));
        return { syntaxCustom };
    }),
    setInlineCodeColor: (inlineCodeColor) => set(() => {
        localStorage.setItem(INLINE_CODE_COLOR_KEY, inlineCodeColor);
        localStorage.setItem(INLINE_CODE_CUSTOM_KEY, "true");
        return { inlineCodeColor, inlineCodeCustom: true };
    }),
    setInlineCodeCustom: (inlineCodeCustom) => set(() => {
        localStorage.setItem(INLINE_CODE_CUSTOM_KEY, String(inlineCodeCustom));
        return { inlineCodeCustom };
    }),
    setThemeScheduleMode: (themeScheduleMode) => set(() => {
        localStorage.setItem(THEME_SCHEDULE_MODE_KEY, themeScheduleMode);
        return { themeScheduleMode };
    }),
    setThemeScheduleLightStart: (themeScheduleLightStart) => set(() => {
        localStorage.setItem(THEME_SCHEDULE_LIGHT_START_KEY, themeScheduleLightStart);
        return { themeScheduleLightStart };
    }),
    setThemeScheduleDarkStart: (themeScheduleDarkStart) => set(() => {
        localStorage.setItem(THEME_SCHEDULE_DARK_START_KEY, themeScheduleDarkStart);
        return { themeScheduleDarkStart };
    }),
    setThemeScheduleLocation: (lat, lon) => set(() => {
        if (lat === null || lon === null) {
            localStorage.removeItem(THEME_SCHEDULE_LAT_KEY);
            localStorage.removeItem(THEME_SCHEDULE_LON_KEY);
            return { themeScheduleLat: null, themeScheduleLon: null };
        }
        localStorage.setItem(THEME_SCHEDULE_LAT_KEY, String(lat));
        localStorage.setItem(THEME_SCHEDULE_LON_KEY, String(lon));
        return { themeScheduleLat: lat, themeScheduleLon: lon };
    }),
}));
