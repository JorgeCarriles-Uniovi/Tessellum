import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { trackStore } from "../test/storeIsolation";
import { useAppearanceStore } from "../stores/appearanceStore";
import {
    applyAccentPaletteFromColor,
    applyAppearanceCustomCssVars,
    useApplyAppearanceSettings,
} from "./useApplyAppearanceSettings";

function resetRootState() {
    const root = document.documentElement;
    root.style.cssText = "";
    delete root.dataset.density;
    delete root.dataset.iconStyle;
}

describe("useApplyAppearanceSettings", () => {
    beforeEach(() => {
        trackStore(useAppearanceStore);
        resetRootState();
    });

    test("applies accent palette css vars for valid colors and ignores invalid input", () => {
        const root = document.documentElement;

        applyAccentPaletteFromColor("#336699");
        const appliedPrimary = root.style.getPropertyValue("--primary");
        const appliedBlue600 = root.style.getPropertyValue("--color-blue-600");

        expect(appliedPrimary).toMatch(/^hsl\(/);
        expect(appliedBlue600).toMatch(/^hsl\(/);

        applyAccentPaletteFromColor("not-a-color");
        expect(root.style.getPropertyValue("--primary")).toBe(appliedPrimary);
        expect(root.style.getPropertyValue("--color-blue-600")).toBe(appliedBlue600);
    });

    test("applies and clears custom terminal, syntax, and inline-code variables", () => {
        const root = document.documentElement;

        applyAppearanceCustomCssVars({
            terminalHeaderBg: "#111111",
            terminalLineBg: "#222222",
            terminalBorder: "#333333",
            terminalText: "#444444",
            terminalMuted: "#555555",
            terminalCustom: true,
            syntaxComment: "#666666",
            syntaxKeyword: "#777777",
            syntaxOperator: "#888888",
            syntaxString: "#999999",
            syntaxNumber: "#aaaaaa",
            syntaxVariable: "#bbbbbb",
            syntaxFunction: "#cccccc",
            syntaxCustom: true,
            inlineCodeColor: "#dddddd",
            inlineCodeCustom: true,
        });

        expect(root.style.getPropertyValue("--terminal-header-bg")).toBe("#111111");
        expect(root.style.getPropertyValue("--syntax-keyword")).toBe("#777777");
        expect(root.style.getPropertyValue("--code-inline-color")).toBe("#dddddd");

        applyAppearanceCustomCssVars({
            terminalHeaderBg: "#111111",
            terminalLineBg: "#222222",
            terminalBorder: "#333333",
            terminalText: "#444444",
            terminalMuted: "#555555",
            terminalCustom: false,
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
        });

        expect(root.style.getPropertyValue("--terminal-header-bg")).toBe("");
        expect(root.style.getPropertyValue("--syntax-keyword")).toBe("");
        expect(root.style.getPropertyValue("--code-inline-color")).toBe("");
    });

    test("writes appearance datasets and css vars from store changes and skips identical snapshots", () => {
        const root = document.documentElement;
        const setPropertySpy = vi.spyOn(root.style, "setProperty");

        renderHook(() => useApplyAppearanceSettings());

        act(() => {
            const store = useAppearanceStore.getState();
            store.setDensity("compact");
            store.setRadius("16");
            store.setShadow("strong");
            store.setIconStyle("filled");
            store.setAccentColor("#336699");
            store.setTerminalHeaderBg("#111111");
            store.setTerminalLineBg("#222222");
            store.setTerminalBorder("#333333");
            store.setTerminalText("#444444");
            store.setTerminalMuted("#555555");
            store.setSyntaxKeyword("#777777");
            store.setInlineCodeColor("#dddddd");
        });

        expect(root.dataset.density).toBe("compact");
        expect(root.dataset.iconStyle).toBe("filled");
        expect(root.style.getPropertyValue("--spacing-4")).toBe("0.85rem");
        expect(root.style.getPropertyValue("--radius")).toBe("16px");
        expect(root.style.getPropertyValue("--shadow-modal")).toContain("rgb");
        expect(root.style.getPropertyValue("--terminal-header-bg")).toBe("#111111");
        expect(root.style.getPropertyValue("--syntax-keyword")).toBe("#777777");
        expect(root.style.getPropertyValue("--code-inline-color")).toBe("#dddddd");
        expect(root.style.getPropertyValue("--color-blue-600")).toMatch(/^hsl\(/);

        const callsAfterUpdate = setPropertySpy.mock.calls.length;

        act(() => {
            useAppearanceStore.getState().setDensity("compact");
        });

        expect(setPropertySpy.mock.calls.length).toBe(callsAfterUpdate);

        setPropertySpy.mockRestore();
    });
});
