import { describe, expect, test } from "vitest";
import { BUILTIN_THEMES, DEFAULT_THEME_NAME } from "./builtinThemes";
import { getCssVarForToken, THEME_TOKEN_KEYS } from "./themeTokens";
import {
    coerceVariant,
    extractTokens,
    normalizeThemeName,
    parseFlatYaml,
    parseJsonTheme,
    parseThemeDefinition,
} from "./themeUtils";

describe("theme helpers", () => {
    test("maps theme token keys to css variables", () => {
        expect(THEME_TOKEN_KEYS).toContain("background.primary");
        expect(getCssVarForToken("background.primary")).toBe("--color-bg-primary");
    });

    test("normalizes theme names and variants", () => {
        expect(normalizeThemeName("  Warm Paper  ")).toBe("warm paper");
        expect(coerceVariant("dark", "light")).toBe("dark");
        expect(coerceVariant(true, "light")).toBe("dark");
        expect(coerceVariant(false, "dark")).toBe("light");
        expect(coerceVariant("custom", "light")).toBe("light");
    });

    test("extracts only known theme tokens and ignores reserved fields", () => {
        const tokens = extractTokens({
            name: "Ignored",
            variant: "dark",
            background: {
                primary: "#101010",
            },
            accent: {
                default: "#ff0000",
            },
            unknown: "value",
        });

        expect(tokens).toEqual({
            "background.primary": "#101010",
            "accent.default": "#ff0000",
        });
    });

    test("parses json and flat yaml theme definitions", () => {
        expect(parseJsonTheme('{"name":"Sample","background.primary":"#fff"}')).toEqual({
            name: "Sample",
            "background.primary": "#fff",
        });
        expect(parseJsonTheme("{bad json")).toBeNull();

        expect(parseFlatYaml(`
# comment
name: Sample
background.primary: "#fff"
accent.default: #123456
empty:
        `)).toEqual({
            name: "Sample",
            "background.primary": "#fff",
            "accent.default": "#123456",
            empty: "",
        });
        expect(parseFlatYaml("not yaml at all")).toBeNull();
    });

    test("builds theme definitions only when a name exists", () => {
        expect(
            parseThemeDefinition(
                {
                    name: "  My Theme  ",
                    isDark: true,
                    background: { primary: "#111111" },
                },
                "user",
                "light",
            ),
        ).toEqual({
            name: "My Theme",
            variant: "dark",
            tokens: {
                "background.primary": "#111111",
            },
            source: "user",
        });

        expect(parseThemeDefinition({}, "user", "light")).toBeNull();
    });

    test("keeps builtin themes consistent", () => {
        const defaultTheme = BUILTIN_THEMES.find((theme) => theme.name === DEFAULT_THEME_NAME);

        expect(defaultTheme?.source).toBe("builtin");
        expect(defaultTheme?.tokens["background.primary"]).toBeDefined();
        expect(BUILTIN_THEMES.some((theme) => theme.variant === "light")).toBe(true);
        expect(BUILTIN_THEMES.some((theme) => theme.variant === "dark")).toBe(true);
    });
});

function themeByName(name: string) {
    const t = BUILTIN_THEMES.find((x) => x.name === name);
    if (!t) throw new Error(`missing theme ${name}`);
    return t;
}

describe("Warm Paper v2 palette", () => {
    test("is the default theme", () => {
        expect(DEFAULT_THEME_NAME).toBe("Warm Paper");
    });

    test("light uses the v2 paper backgrounds and blue accent", () => {
        const t = themeByName("Warm Paper");
        expect(t.tokens["background.app"]).toBe("#f2f0ea");
        expect(t.tokens["background.secondary"]).toBe("#f7f5f0");
        expect(t.tokens["background.primary"]).toBe("#fdfcf9");
        expect(t.tokens["background.elevated"]).toBe("#ffffff");
        expect(t.tokens["accent.default"]).toBe("#3452d6");
        expect(t.tokens["semantic.green"]).toBe("#3f8f57");
    });

    test("dark uses the v2 warm-charcoal backgrounds", () => {
        const t = themeByName("Warm Paper Dark");
        expect(t.tokens["background.app"]).toBe("#141310");
        expect(t.tokens["background.primary"]).toBe("#100f0d");
        expect(t.tokens["accent.default"]).toBe("#7c8cf0");
    });

    test("every builtin theme defines the new base tokens", () => {
        for (const t of BUILTIN_THEMES) {
            expect(t.tokens["background.app"]).toBeTruthy();
            expect(t.tokens["background.elevated"]).toBeTruthy();
            expect(t.tokens["semantic.green"]).toBeTruthy();
        }
    });
});
