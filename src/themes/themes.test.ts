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
