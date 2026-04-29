import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { trackStores } from "../test/storeIsolation";
import { useAppearanceStore } from "../stores/appearanceStore";
import { useThemeStore } from "../stores/themeStore";

const sunCalcMocks = vi.hoisted(() => ({
    getTimes: vi.fn(),
}));

vi.mock("suncalc", () => ({
    default: {
        getTimes: sunCalcMocks.getTimes,
    },
}));

function stubMatchMedia(matches: boolean) {
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    const mediaQuery = {
        matches,
        addEventListener: vi.fn((_event: string, listener: (event: MediaQueryListEvent) => void) => {
            listeners.add(listener);
        }),
        removeEventListener: vi.fn((_event: string, listener: (event: MediaQueryListEvent) => void) => {
            listeners.delete(listener);
        }),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatch(nextMatches: boolean) {
            this.matches = nextMatches;
            listeners.forEach((listener) => listener({ matches: nextMatches } as MediaQueryListEvent));
        },
    };

    Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: vi.fn(() => mediaQuery),
    });

    return mediaQuery;
}

describe("useApplyThemeSchedule", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-04-29T09:00:00.000Z"));
        trackStores(useAppearanceStore, useThemeStore);
        sunCalcMocks.getTimes.mockReset();
        useThemeStore.setState({
            ...useThemeStore.getState(),
            themes: [
                { name: "Nord Light", variant: "light", tokens: {} as never },
                { name: "Nord Dark", variant: "dark", tokens: {} as never },
                { name: "Slate", variant: "dark", tokens: {} as never },
            ],
            activeThemeName: "Nord Light",
        });
    });

    test("does nothing in off mode and reacts to system changes in system mode", async () => {
        const mediaQuery = stubMatchMedia(true);
        const { useApplyThemeSchedule } = await import("./useApplyThemeSchedule");
        const setActiveTheme = vi.spyOn(useThemeStore.getState(), "setActiveTheme");

        useAppearanceStore.setState({
            ...useAppearanceStore.getState(),
            themeScheduleMode: "off",
        });
        const { rerender, unmount } = renderHook(
            ({ mode }) => {
                useAppearanceStore.setState({
                    ...useAppearanceStore.getState(),
                    themeScheduleMode: mode,
                });
                useApplyThemeSchedule();
            },
            { initialProps: { mode: "off" as const } },
        );

        expect(setActiveTheme).not.toHaveBeenCalled();

        rerender({ mode: "system" as const });
        expect(setActiveTheme).toHaveBeenCalledWith("Nord Dark");

        act(() => {
            mediaQuery.dispatch(false);
        });
        expect(setActiveTheme).toHaveBeenCalledWith("Nord Light");

        unmount();
        expect(mediaQuery.removeEventListener).toHaveBeenCalled();
    });

    test("uses geolocation and falls back to custom scheduling when sun mode cannot resolve coordinates", async () => {
        stubMatchMedia(false);
        const { useApplyThemeSchedule } = await import("./useApplyThemeSchedule");
        const setActiveTheme = vi.spyOn(useThemeStore.getState(), "setActiveTheme");
        const geolocation = {
            getCurrentPosition: vi.fn((success: (position: GeolocationPosition) => void) => {
                success({
                    coords: {
                        latitude: 43.36,
                        longitude: -5.85,
                    },
                } as GeolocationPosition);
            }),
        };

        Object.defineProperty(navigator, "geolocation", {
            configurable: true,
            value: geolocation,
        });

        sunCalcMocks.getTimes.mockReturnValue({
            sunrise: new Date("2026-04-29T06:00:00.000Z"),
            sunset: new Date("2026-04-29T18:00:00.000Z"),
        });

        useAppearanceStore.setState({
            ...useAppearanceStore.getState(),
            themeScheduleMode: "sun",
            themeScheduleLat: null,
            themeScheduleLon: null,
        });
        renderHook(() => useApplyThemeSchedule());

        expect(geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
        expect(useAppearanceStore.getState().themeScheduleLat).toBe(43.36);
        expect(setActiveTheme).not.toHaveBeenCalled();

        setActiveTheme.mockClear();
        geolocation.getCurrentPosition.mockImplementation((_success, error: () => void) => error());

        act(() => {
            useAppearanceStore.setState({
                ...useAppearanceStore.getState(),
                themeScheduleLat: null,
                themeScheduleLon: null,
                themeScheduleLightStart: "20:00",
                themeScheduleDarkStart: "08:00",
            });
        });

        expect(setActiveTheme).toHaveBeenCalledWith("Nord Dark");
    });

    test("schedules the next custom boundary and preserves the current theme when already matching", async () => {
        stubMatchMedia(false);
        const { useApplyThemeSchedule } = await import("./useApplyThemeSchedule");
        const setActiveTheme = vi.spyOn(useThemeStore.getState(), "setActiveTheme");

        useAppearanceStore.setState({
            ...useAppearanceStore.getState(),
            themeScheduleMode: "custom",
            themeScheduleLightStart: "08:00",
            themeScheduleDarkStart: "20:00",
        });
        renderHook(() => useApplyThemeSchedule());

        expect(setActiveTheme).not.toHaveBeenCalled();

        act(() => {
            vi.setSystemTime(new Date("2026-04-29T20:01:00.000Z"));
            vi.runOnlyPendingTimers();
        });

        expect(setActiveTheme).toHaveBeenCalledWith("Nord Dark");
    });
});
