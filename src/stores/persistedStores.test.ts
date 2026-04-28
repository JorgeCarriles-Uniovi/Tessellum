import { describe, expect, test, vi } from "vitest";
import { trackStore } from "../test/storeIsolation";

async function importAccessibilityStore() {
    vi.resetModules();
    return import("./accessibilityStore");
}

async function importAppearanceStore() {
    vi.resetModules();
    return import("./appearanceStore");
}

async function importEditorContentStore() {
    vi.resetModules();
    return import("./editorContentStore");
}

async function importSettingsStore() {
    vi.resetModules();
    return import("./settingsStore");
}

describe("persisted stores", () => {
    test("falls back for invalid accessibility storage and persists coerced action values", async () => {
        Object.defineProperty(window, "matchMedia", {
            writable: true,
            value: vi.fn().mockReturnValue({
                matches: true,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            }),
        });
        localStorage.setItem("tessellum:accessibility:highContrast", "false");
        localStorage.setItem("tessellum:accessibility:uiScale", "999");
        localStorage.setItem("tessellum:accessibility:colorFilter", "sepia");

        const { useAccessibilityStore } = await importAccessibilityStore();
        trackStore(useAccessibilityStore);

        expect(useAccessibilityStore.getState()).toMatchObject({
            highContrast: false,
            reducedMotion: true,
            uiScale: 100,
            colorFilter: "none",
        });

        useAccessibilityStore.getState().setHighContrast(true);
        useAccessibilityStore.getState().setReducedMotion(false);
        useAccessibilityStore.getState().setUiScale(125);
        useAccessibilityStore.getState().setUiScale(999 as never);
        useAccessibilityStore.getState().setColorFilter("protanopia");
        useAccessibilityStore.getState().setColorFilter("broken" as never);

        expect(useAccessibilityStore.getState()).toMatchObject({
            highContrast: true,
            reducedMotion: false,
            uiScale: 100,
            colorFilter: "none",
        });
        expect(localStorage.getItem("tessellum:accessibility:highContrast")).toBe("true");
        expect(localStorage.getItem("tessellum:accessibility:reducedMotion")).toBe("false");
    });

    test("initializes and updates the appearance store across custom flag branches", async () => {
        localStorage.setItem("tessellum:appearance:accentSource", "invalid");
        localStorage.setItem("tessellum:appearance:themeScheduleLat", "north");
        localStorage.setItem("tessellum:appearance:themeScheduleLon", "");

        const { useAppearanceStore } = await importAppearanceStore();
        trackStore(useAppearanceStore);

        expect(useAppearanceStore.getState()).toMatchObject({
            accentSource: "theme",
            themeScheduleLat: null,
            themeScheduleLon: null,
        });

        const store = useAppearanceStore.getState();
        store.setAccentColor("#123456");
        store.setAccentFromTheme("#654321");
        store.setDensity("compact");
        store.setRadius("16");
        store.setShadow("strong");
        store.setIconStyle("filled");
        store.setSidebarPosition("right");
        store.setToolbarVisible(false);
        store.setTerminalCustom(true);
        store.setTerminalHeaderBg("#111111");
        store.setTerminalLineBg("#222222");
        store.setTerminalBorder("#333333");
        store.setTerminalText("#444444");
        store.setTerminalMuted("#555555");
        store.setSyntaxComment("#666666");
        store.setSyntaxKeyword("#777777");
        store.setSyntaxOperator("#888888");
        store.setSyntaxString("#999999");
        store.setSyntaxNumber("#aaaaaa");
        store.setSyntaxVariable("#bbbbbb");
        store.setSyntaxFunction("#cccccc");
        store.setSyntaxCustom(false);
        store.setInlineCodeColor("#dddddd");
        store.setInlineCodeCustom(false);
        store.setThemeScheduleMode("custom");
        store.setThemeScheduleLightStart("07:30");
        store.setThemeScheduleDarkStart("21:15");
        store.setThemeScheduleLocation(null, null);
        store.setThemeScheduleLocation(43.36, -5.85);

        expect(useAppearanceStore.getState()).toMatchObject({
            accentColor: "#654321",
            accentSource: "theme",
            density: "compact",
            radius: "16",
            shadow: "strong",
            iconStyle: "filled",
            sidebarPosition: "right",
            toolbarVisible: false,
            terminalCustom: true,
            syntaxComment: "#666666",
            syntaxKeyword: "#777777",
            syntaxOperator: "#888888",
            syntaxString: "#999999",
            syntaxNumber: "#aaaaaa",
            syntaxVariable: "#bbbbbb",
            syntaxFunction: "#cccccc",
            syntaxCustom: false,
            inlineCodeColor: "#dddddd",
            inlineCodeCustom: false,
            themeScheduleMode: "custom",
            themeScheduleLightStart: "07:30",
            themeScheduleDarkStart: "21:15",
            themeScheduleLat: 43.36,
            themeScheduleLon: -5.85,
        });
        expect(localStorage.getItem("tessellum:appearance:terminalCustom")).toBe("true");
        expect(localStorage.getItem("tessellum:appearance:syntaxCustom")).toBe("false");
        expect(localStorage.getItem("tessellum:appearance:inlineCodeCustom")).toBe("false");
    });

    test("clamps editor font sizes and persists the normalized value", async () => {
        localStorage.setItem("tessellum:editorFontSizePx", "40");

        const {
            clampEditorFontSizePx,
            DEFAULT_EDITOR_FONT_SIZE_PX,
            nextEditorFontSizePx,
            useEditorContentStore,
        } = await importEditorContentStore();
        trackStore(useEditorContentStore);

        expect(clampEditorFontSizePx(8)).toBe(12);
        expect(clampEditorFontSizePx(18)).toBe(18);
        expect(nextEditorFontSizePx(14, 2)).toBe(16);
        expect(nextEditorFontSizePx(16, 0)).toBe(16);
        expect(useEditorContentStore.getState().editorFontSizePx).toBe(24);

        useEditorContentStore.getState().setActiveNoteContent("Hello");
        useEditorContentStore.getState().setIsDirty(true);
        useEditorContentStore.getState().setEditorFontSizePx(6);

        expect(useEditorContentStore.getState()).toMatchObject({
            activeNoteContent: "Hello",
            isDirty: true,
            editorFontSizePx: 12,
        });
        expect(localStorage.getItem("tessellum:editorFontSizePx")).toBe("12");
        expect(DEFAULT_EDITOR_FONT_SIZE_PX).toBe(16);
    });

    test("reads persisted settings with locale and boolean fallbacks and updates through actions", async () => {
        localStorage.setItem("tessellum:locale", "fr");
        localStorage.setItem("tessellum:vimMode", "true");
        localStorage.setItem("tessellum:lineNumbers", "false");
        localStorage.setItem("tessellum:spellCheck", "maybe");
        localStorage.setItem("tessellum:editorLineHeight", "bad");

        const {
            DEFAULT_LOCALE,
            readStoredLocale,
            readStoredVimMode,
            useSettingsStore,
        } = await importSettingsStore();
        trackStore(useSettingsStore);

        expect(readStoredLocale()).toBe(DEFAULT_LOCALE);
        expect(readStoredVimMode()).toBe(true);
        expect(useSettingsStore.getState()).toMatchObject({
            locale: "en",
            vimMode: true,
            lineNumbers: false,
            spellCheck: true,
            editorLineHeight: 1.7,
        });

        const store = useSettingsStore.getState();
        store.setFontFamily("IBM Plex Sans");
        store.setEditorLineHeight(1.9);
        store.setEditorLetterSpacing(0.02);
        store.setLocale("es");
        store.setVimMode(false);
        store.setLineNumbers(true);
        store.setSpellCheck(false);

        expect(useSettingsStore.getState()).toMatchObject({
            fontFamily: "IBM Plex Sans",
            editorLineHeight: 1.9,
            editorLetterSpacing: 0.02,
            locale: "es",
            vimMode: false,
            lineNumbers: true,
            spellCheck: false,
        });
        expect(localStorage.getItem("tessellum:locale")).toBe("es");
    });
});
