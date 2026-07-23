import { describe, expect, it } from "vitest";
import { useThemeStore } from "../stores/themeStore";
import { getSiblingThemeName } from "./useColorMode";

describe("getSiblingThemeName", () => {
  it("maps Warm Paper -> Warm Paper Dark and back", () => {
    const themes = useThemeStore.getState().themes;
    expect(getSiblingThemeName("Warm Paper", themes)).toBe("Warm Paper Dark");
    expect(getSiblingThemeName("Warm Paper Dark", themes)).toBe("Warm Paper");
  });

  it("falls back to the first theme of the opposite variant", () => {
    const themes = useThemeStore.getState().themes;
    const sibling = getSiblingThemeName("Ocean", themes); // light -> some dark
    const found = themes.find((t) => t.name === sibling);
    expect(found?.variant).toBe("dark");
  });

  it("exercises fallback path for themes not in PAIRS", () => {
    // Create synthetic themes that are not registered in PAIRS
    const fakeThemes = [
      { name: "Custom Light", variant: "light" as const, tokens: {}, source: "user" as const },
      { name: "Custom Dark", variant: "dark" as const, tokens: {}, source: "user" as const },
    ];
    // "Custom Light" has no entry in PAIRS, so should fall back to themes.find()
    const sibling = getSiblingThemeName("Custom Light", fakeThemes);
    expect(sibling).toBe("Custom Dark");
  });
});
