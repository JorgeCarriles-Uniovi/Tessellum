import { create } from "zustand";

const ACCENT_COLOR_KEY = "tessellum:appearance:accentColor";
const DENSITY_KEY = "tessellum:appearance:density";
const RADIUS_KEY = "tessellum:appearance:radius";
const SHADOW_KEY = "tessellum:appearance:shadow";
const ICON_STYLE_KEY = "tessellum:appearance:iconStyle";
const SIDEBAR_POSITION_KEY = "tessellum:appearance:sidebarPosition";
const TOOLBAR_VISIBLE_KEY = "tessellum:appearance:toolbarVisible";

export type Density = "compact" | "comfortable";
export type ShadowStrength = "subtle" | "medium" | "strong";
export type IconStyle = "outline" | "filled";
export type SidebarPosition = "left" | "right";

export interface AppearanceState {
    accentColor: string;
    density: Density;
    radius: "6" | "10" | "16";
    shadow: ShadowStrength;
    iconStyle: IconStyle;
    sidebarPosition: SidebarPosition;
    toolbarVisible: boolean;
}

export interface AppearanceActions {
    setAccentColor: (value: string) => void;
    setDensity: (value: Density) => void;
    setRadius: (value: "6" | "10" | "16") => void;
    setShadow: (value: ShadowStrength) => void;
    setIconStyle: (value: IconStyle) => void;
    setSidebarPosition: (value: SidebarPosition) => void;
    setToolbarVisible: (value: boolean) => void;
}

export type AppearanceStore = AppearanceState & AppearanceActions;

const DEFAULT_ACCENT_COLOR = "#3d14b8";

function readString(key: string, fallback: string): string {
    const raw = localStorage.getItem(key);
    return raw ?? fallback;
}

function readBoolean(key: string, fallback: boolean): boolean {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === "true";
}

export const useAppearanceStore = create<AppearanceStore>((set) => ({
    accentColor: readString(ACCENT_COLOR_KEY, DEFAULT_ACCENT_COLOR),
    density: readString(DENSITY_KEY, "comfortable") as Density,
    radius: readString(RADIUS_KEY, "10") as AppearanceState["radius"],
    shadow: readString(SHADOW_KEY, "medium") as ShadowStrength,
    iconStyle: readString(ICON_STYLE_KEY, "outline") as IconStyle,
    sidebarPosition: readString(SIDEBAR_POSITION_KEY, "left") as SidebarPosition,
    toolbarVisible: readBoolean(TOOLBAR_VISIBLE_KEY, true),

    setAccentColor: (accentColor) => set(() => {
        localStorage.setItem(ACCENT_COLOR_KEY, accentColor);
        return { accentColor };
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
}));
