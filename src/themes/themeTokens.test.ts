import { describe, expect, it } from "vitest";
import { THEME_TOKEN_MAP, THEME_TOKEN_KEYS, getCssVarForToken } from "./themeTokens";

describe("themeTokens v2 additions", () => {
  it("maps the new v2 tokens to their CSS variables", () => {
    expect(getCssVarForToken("background.app")).toBe("--color-bg-app");
    expect(getCssVarForToken("background.elevated")).toBe("--color-bg-elevated");
    expect(getCssVarForToken("background.hover")).toBe("--color-bg-hover");
    expect(getCssVarForToken("background.active")).toBe("--color-bg-active");
    expect(getCssVarForToken("accent.accent2")).toBe("--color-accent-2");
    expect(getCssVarForToken("accent.soft")).toBe("--color-accent-soft");
    expect(getCssVarForToken("semantic.amber")).toBe("--color-amber");
    expect(getCssVarForToken("semantic.amberSoft")).toBe("--color-amber-soft");
    expect(getCssVarForToken("semantic.green")).toBe("--color-green");
    expect(getCssVarForToken("semantic.pink")).toBe("--color-pink");
    expect(getCssVarForToken("semantic.pinkSoft")).toBe("--color-pink-soft");
  });

  it("includes the new keys in THEME_TOKEN_KEYS", () => {
    expect(THEME_TOKEN_KEYS).toContain("background.elevated");
    expect(Object.keys(THEME_TOKEN_MAP)).toContain("semantic.green");
  });
});
