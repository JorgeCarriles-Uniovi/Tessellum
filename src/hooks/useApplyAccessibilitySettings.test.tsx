import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { trackStores } from "../test/storeIsolation";
import { useAccessibilityStore } from "../stores/accessibilityStore";
import { useAppearanceStore } from "../stores/appearanceStore";
import { useThemeStore } from "../stores/themeStore";

const accessibilityMocks = vi.hoisted(() => ({
    applyAccessibilityRootState: vi.fn(),
}));

vi.mock("./accessibilityCssVars.ts", () => ({
    applyAccessibilityRootState: accessibilityMocks.applyAccessibilityRootState,
}));

describe("useApplyAccessibilitySettings", () => {
    beforeEach(() => {
        trackStores(useAccessibilityStore, useAppearanceStore, useThemeStore);
        accessibilityMocks.applyAccessibilityRootState.mockReset();
    });

    test("applies the initial snapshot, ignores repeated values, and reapplies on accessibility changes", async () => {
        const { useApplyAccessibilitySettings } = await import("./useApplyAccessibilitySettings");

        renderHook(() => useApplyAccessibilitySettings());

        expect(accessibilityMocks.applyAccessibilityRootState).toHaveBeenCalledTimes(1);

        act(() => {
            useAccessibilityStore.getState().setHighContrast(false);
        });
        expect(accessibilityMocks.applyAccessibilityRootState).toHaveBeenCalledTimes(1);

        act(() => {
            useAccessibilityStore.getState().setHighContrast(true);
            useAccessibilityStore.getState().setUiScale(125);
        });

        expect(accessibilityMocks.applyAccessibilityRootState).toHaveBeenCalledTimes(3);
        expect(accessibilityMocks.applyAccessibilityRootState).toHaveBeenLastCalledWith({
            snapshot: expect.objectContaining({
                highContrast: true,
                uiScale: 125,
            }),
        });
    });

    test("reapplies the high-contrast overlay after appearance and theme updates", async () => {
        const { useApplyAccessibilitySettings } = await import("./useApplyAccessibilitySettings");
        useAccessibilityStore.setState({
            ...useAccessibilityStore.getState(),
            highContrast: true,
        });

        renderHook(() => useApplyAccessibilitySettings());

        accessibilityMocks.applyAccessibilityRootState.mockClear();

        act(() => {
            useAppearanceStore.getState().setDensity("compact");
            useThemeStore.setState({
                ...useThemeStore.getState(),
                activeThemeName: "Test Theme",
            });
        });
        await Promise.resolve();

        expect(accessibilityMocks.applyAccessibilityRootState).toHaveBeenCalledTimes(2);
    });
});
