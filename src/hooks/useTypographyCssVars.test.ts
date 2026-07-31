import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useSettingsStore } from "../stores/settingsStore";
import { useTypographyCssVars } from "./useTypographyCssVars";

describe("useTypographyCssVars", () => {
    beforeEach(() => {
        document.documentElement.style.removeProperty("--font-editor");
        document.documentElement.style.removeProperty("--font-sans");
    });

    it("sets --font-editor from the readingFont setting, independent of --font-sans", () => {
        useSettingsStore.setState({ readingFont: "Newsreader", fontFamily: "Geist Sans" });
        renderHook(() => useTypographyCssVars());

        const fontEditor = document.documentElement.style.getPropertyValue("--font-editor");
        const fontSans = document.documentElement.style.getPropertyValue("--font-sans");
        expect(fontEditor).toContain("Newsreader");
        expect(fontSans).toContain("Geist Sans");
        expect(fontEditor).not.toBe(fontSans);
    });

    it("updates --font-editor when readingFont changes", () => {
        useSettingsStore.setState({ readingFont: "Newsreader" });
        renderHook(() => useTypographyCssVars());
        expect(document.documentElement.style.getPropertyValue("--font-editor")).toContain("Newsreader");

        act(() => {
            useSettingsStore.setState({ readingFont: "Georgia" });
        });
        expect(document.documentElement.style.getPropertyValue("--font-editor")).toContain("Georgia");
    });
});
