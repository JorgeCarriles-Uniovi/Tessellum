import { describe, expect, it, beforeEach } from "vitest";
import { useThemeStore } from "../stores/themeStore";
import { getSiblingThemeName } from "./useColorMode";

describe("getSiblingThemeName", () => {
  beforeEach(() => {
    useThemeStore.setState({ themes: useThemeStore.getState().themes });
  });

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
});
