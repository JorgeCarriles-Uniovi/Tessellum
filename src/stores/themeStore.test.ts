import { beforeEach, describe, expect, test, vi } from "vitest";
import { trackStores } from "../test/storeIsolation";
import {
    extnameMock,
    joinMock,
    mkdirMock,
    readDirMock,
    readTextFileMock,
    watchMock,
} from "../test/tauriMocks";

const themeMocks = vi.hoisted(() => ({
    applyAccentPaletteFromColor: vi.fn(),
    applyAppearanceCustomCssVars: vi.fn(),
}));

vi.mock("../hooks/useApplyAppearanceSettings", () => ({
    applyAccentPaletteFromColor: themeMocks.applyAccentPaletteFromColor,
    applyAppearanceCustomCssVars: themeMocks.applyAppearanceCustomCssVars,
}));

async function importThemeStore() {
    vi.resetModules();
    const [{ useThemeStore }, { useAppearanceStore }, { useVaultStore }] = await Promise.all([
        import("./themeStore"),
        import("./appearanceStore"),
        import("./vaultStore"),
    ]);
    return { useThemeStore, useAppearanceStore, useVaultStore };
}

function resetRootState() {
    const root = document.documentElement;
    root.style.cssText = "";
    delete root.dataset.theme;
    delete root.dataset.themeName;
    root.classList.remove("dark");
}

describe("themeStore", () => {
    beforeEach(() => {
        resetRootState();
        themeMocks.applyAccentPaletteFromColor.mockReset();
        themeMocks.applyAppearanceCustomCssVars.mockReset();
        joinMock.mockImplementation(async (...parts: string[]) => parts.filter(Boolean).join("/"));
        extnameMock.mockImplementation(async (fileName: string) => {
            const match = /\.[^.]+$/.exec(fileName);
            return match ? match[0] : "";
        });
    });

    test("loads user themes, skips invalid inputs, and persists the merged active theme", async () => {
        localStorage.setItem("tessellum:appearance:theme", "Ocean Dark");

        readDirMock.mockResolvedValueOnce([
            { isFile: true, name: "ocean.json" },
            { isFile: true, name: "notes.txt" },
            { isFile: true, name: "bad.yaml" },
        ]);
        readTextFileMock.mockImplementation(async (path: string) => {
            if (path.endsWith("ocean.json")) {
                return JSON.stringify({
                    name: "Ocean Dark",
                    variant: "dark",
                    "background.primary": "#0f172a",
                    "text.primary": "#e2e8f0",
                    "accent.default": "#38bdf8",
                });
            }
            if (path.endsWith("bad.yaml")) {
                throw new Error("invalid");
            }
            return "";
        });

        const { useAppearanceStore, useThemeStore, useVaultStore } = await importThemeStore();
        trackStores(useAppearanceStore, useThemeStore, useVaultStore);
        useAppearanceStore.setState({
            ...useAppearanceStore.getState(),
            accentSource: "theme",
        });
        useVaultStore.setState({
            ...useVaultStore.getState(),
            vaultPath: "vault",
            files: [],
            fileTree: [],
            activeNote: null,
            openTabPaths: [],
        });
        themeMocks.applyAccentPaletteFromColor.mockClear();
        themeMocks.applyAppearanceCustomCssVars.mockClear();

        await useThemeStore.getState().loadThemes();

        const state = useThemeStore.getState();
        expect(state.themes.some((theme) => theme.name === "Ocean Dark")).toBe(true);
        expect(state.activeThemeName).toBe("Ocean Dark");
        expect(state.activeTheme?.name).toBe("Ocean Dark");
        expect(localStorage.getItem("tessellum:appearance:theme")).toBe("Ocean Dark");
        expect(document.documentElement.dataset.theme).toBe("dark");
        expect(document.documentElement.dataset.themeName).toBe("Ocean Dark");
        expect(document.documentElement.classList.contains("dark")).toBe(true);
        expect(themeMocks.applyAppearanceCustomCssVars).toHaveBeenCalled();
        expect(themeMocks.applyAccentPaletteFromColor).toHaveBeenCalledWith("#38bdf8");
        expect(mkdirMock).toHaveBeenCalled();
    });

    test("falls back to the default theme and respects custom accent source until forced selection", async () => {
        localStorage.setItem("tessellum:appearance:theme", "Missing Theme");
        readDirMock.mockResolvedValueOnce([]);

        const { useAppearanceStore, useThemeStore, useVaultStore } = await importThemeStore();
        trackStores(useAppearanceStore, useThemeStore, useVaultStore);
        useAppearanceStore.setState({
            ...useAppearanceStore.getState(),
            accentSource: "custom",
        });
        useVaultStore.setState({
            ...useVaultStore.getState(),
            vaultPath: "vault",
            files: [],
            fileTree: [],
            activeNote: null,
            openTabPaths: [],
        });
        themeMocks.applyAccentPaletteFromColor.mockClear();

        await useThemeStore.getState().loadThemes();
        const fallbackTheme = useThemeStore.getState().activeTheme;

        expect(fallbackTheme).not.toBeNull();
        expect(useThemeStore.getState().activeThemeName).toBe(fallbackTheme?.name);
        expect(themeMocks.applyAccentPaletteFromColor).not.toHaveBeenCalled();

        useThemeStore.getState().setActiveTheme("Unknown");

        expect(useThemeStore.getState().activeThemeName).toBe(fallbackTheme?.name);
        expect(themeMocks.applyAccentPaletteFromColor).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem("tessellum:appearance:theme")).toBe(fallbackTheme?.name ?? null);
    });

    test("starts a watcher once, reloads on change, and stops cleanly", async () => {
        const unwatch = vi.fn();
        watchMock.mockResolvedValue(unwatch);
        readDirMock.mockResolvedValue([]);

        const { useAppearanceStore, useThemeStore, useVaultStore } = await importThemeStore();
        trackStores(useAppearanceStore, useThemeStore, useVaultStore);
        useAppearanceStore.setState({
            ...useAppearanceStore.getState(),
            accentSource: "theme",
        });
        useVaultStore.setState({
            ...useVaultStore.getState(),
            vaultPath: "vault",
            files: [],
            fileTree: [],
            activeNote: null,
            openTabPaths: [],
        });

        await useThemeStore.getState().startWatching();
        await useThemeStore.getState().startWatching();

        expect(watchMock).toHaveBeenCalledTimes(1);

        const onChange = watchMock.mock.calls[0][1] as () => Promise<void>;
        const loadSpy = vi.spyOn(useThemeStore.getState(), "loadThemes");
        await onChange();
        expect(loadSpy).toHaveBeenCalledTimes(1);

        useThemeStore.getState().stopWatching();
        expect(unwatch).toHaveBeenCalledTimes(1);
    });
});
