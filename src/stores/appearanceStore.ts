import { create } from "zustand";

const ACCENT_COLOR_KEY = "tessellum:appearance:accentColor";
const ACCENT_SOURCE_KEY = "tessellum:appearance:accentSource";
const DENSITY_KEY = "tessellum:appearance:density";
const RADIUS_KEY = "tessellum:appearance:radius";
const SHADOW_KEY = "tessellum:appearance:shadow";
const ICON_STYLE_KEY = "tessellum:appearance:iconStyle";
const SIDEBAR_POSITION_KEY = "tessellum:appearance:sidebarPosition";
const TOOLBAR_VISIBLE_KEY = "tessellum:appearance:toolbarVisible";
const TERMINAL_HEADER_BG_KEY = "tessellum:appearance:terminalHeaderBg";
const TERMINAL_LINE_BG_KEY = "tessellum:appearance:terminalLineBg";
const TERMINAL_BORDER_KEY = "tessellum:appearance:terminalBorder";
const TERMINAL_TEXT_KEY = "tessellum:appearance:terminalText";
const TERMINAL_MUTED_KEY = "tessellum:appearance:terminalMuted";
const TERMINAL_CUSTOM_KEY = "tessellum:appearance:terminalCustom";
const SYNTAX_COMMENT_KEY = "tessellum:appearance:syntaxComment";
const SYNTAX_KEYWORD_KEY = "tessellum:appearance:syntaxKeyword";
const SYNTAX_OPERATOR_KEY = "tessellum:appearance:syntaxOperator";
const SYNTAX_STRING_KEY = "tessellum:appearance:syntaxString";
const SYNTAX_NUMBER_KEY = "tessellum:appearance:syntaxNumber";
const SYNTAX_VARIABLE_KEY = "tessellum:appearance:syntaxVariable";
const SYNTAX_FUNCTION_KEY = "tessellum:appearance:syntaxFunction";
const SYNTAX_CUSTOM_KEY = "tessellum:appearance:syntaxCustom";

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

export const useAppearanceStore = create<AppearanceStore>((set) => ({
    accentColor: readString(ACCENT_COLOR_KEY, DEFAULT_ACCENT_COLOR),
    accentSource: readAccentSource(),
    density: readString(DENSITY_KEY, "comfortable") as Density,
    radius: readString(RADIUS_KEY, "10") as AppearanceState["radius"],
    shadow: readString(SHADOW_KEY, "medium") as ShadowStrength,
    iconStyle: readString(ICON_STYLE_KEY, "outline") as IconStyle,
    sidebarPosition: readString(SIDEBAR_POSITION_KEY, "left") as SidebarPosition,
    toolbarVisible: readBoolean(TOOLBAR_VISIBLE_KEY, true),
    terminalCustom: readBoolean(TERMINAL_CUSTOM_KEY, false),
    terminalHeaderBg: readString(TERMINAL_HEADER_BG_KEY, DEFAULT_TERMINAL_HEADER_BG),
    terminalLineBg: readString(TERMINAL_LINE_BG_KEY, DEFAULT_TERMINAL_LINE_BG),
    terminalBorder: readString(TERMINAL_BORDER_KEY, DEFAULT_TERMINAL_BORDER),
    terminalText: readString(TERMINAL_TEXT_KEY, DEFAULT_TERMINAL_TEXT),
    terminalMuted: readString(TERMINAL_MUTED_KEY, DEFAULT_TERMINAL_MUTED),
    syntaxComment: readString(SYNTAX_COMMENT_KEY, DEFAULT_SYNTAX_COMMENT),
    syntaxKeyword: readString(SYNTAX_KEYWORD_KEY, DEFAULT_SYNTAX_KEYWORD),
    syntaxOperator: readString(SYNTAX_OPERATOR_KEY, DEFAULT_SYNTAX_OPERATOR),
    syntaxString: readString(SYNTAX_STRING_KEY, DEFAULT_SYNTAX_STRING),
    syntaxNumber: readString(SYNTAX_NUMBER_KEY, DEFAULT_SYNTAX_NUMBER),
    syntaxVariable: readString(SYNTAX_VARIABLE_KEY, DEFAULT_SYNTAX_VARIABLE),
    syntaxFunction: readString(SYNTAX_FUNCTION_KEY, DEFAULT_SYNTAX_FUNCTION),
    syntaxCustom: readBoolean(SYNTAX_CUSTOM_KEY, false),

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
    setTerminalCustom: (terminalCustom) => set(() => {
        localStorage.setItem(TERMINAL_CUSTOM_KEY, String(terminalCustom));
        return { terminalCustom };
    }),
    setTerminalHeaderBg: (terminalHeaderBg) => set(() => {
        localStorage.setItem(TERMINAL_HEADER_BG_KEY, terminalHeaderBg);
        localStorage.setItem(TERMINAL_CUSTOM_KEY, "true");
        return { terminalHeaderBg, terminalCustom: true };
    }),
    setTerminalLineBg: (terminalLineBg) => set(() => {
        localStorage.setItem(TERMINAL_LINE_BG_KEY, terminalLineBg);
        localStorage.setItem(TERMINAL_CUSTOM_KEY, "true");
        return { terminalLineBg, terminalCustom: true };
    }),
    setTerminalBorder: (terminalBorder) => set(() => {
        localStorage.setItem(TERMINAL_BORDER_KEY, terminalBorder);
        localStorage.setItem(TERMINAL_CUSTOM_KEY, "true");
        return { terminalBorder, terminalCustom: true };
    }),
    setTerminalText: (terminalText) => set(() => {
        localStorage.setItem(TERMINAL_TEXT_KEY, terminalText);
        localStorage.setItem(TERMINAL_CUSTOM_KEY, "true");
        return { terminalText, terminalCustom: true };
    }),
    setTerminalMuted: (terminalMuted) => set(() => {
        localStorage.setItem(TERMINAL_MUTED_KEY, terminalMuted);
        localStorage.setItem(TERMINAL_CUSTOM_KEY, "true");
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
}));
