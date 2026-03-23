import { useEffect } from "react";
import SunCalc from "suncalc";
import { useAppearanceStore, useThemeStore } from "../stores";
import { DEFAULT_THEME_NAME } from "../themes/builtinThemes";
import { normalizeThemeName } from "../themes/themeUtils";

type ThemeVariant = "light" | "dark";

function normalizeName(name: string): string {
    return normalizeThemeName(name);
}

function findThemeByName(themes: { name: string; variant: ThemeVariant }[], name: string, variant?: ThemeVariant) {
    const normalized = normalizeName(name);
    return themes.find((theme) => normalizeName(theme.name) === normalized && (!variant || theme.variant === variant));
}

function resolveFallbackThemeName(themes: { name: string; variant: ThemeVariant }[], variant: ThemeVariant): string {
    const defaultTheme = findThemeByName(themes, DEFAULT_THEME_NAME, variant);
    if (defaultTheme) return defaultTheme.name;
    const firstMatch = themes.find((theme) => theme.variant === variant);
    return firstMatch ? firstMatch.name : themes[0]?.name ?? DEFAULT_THEME_NAME;
}

function resolveThemeForVariant(
    themes: { name: string; variant: ThemeVariant }[],
    currentName: string,
    targetVariant: ThemeVariant
): string {
    const currentTheme = findThemeByName(themes, currentName);
    if (currentTheme && currentTheme.variant === targetVariant) {
        return currentTheme.name;
    }

    const suffix = targetVariant === "dark" ? " Dark" : " Light";
    const inverseSuffix = targetVariant === "dark" ? " Light" : " Dark";

    if (currentName.endsWith(inverseSuffix)) {
        const base = currentName.slice(0, -inverseSuffix.length);
        const direct = findThemeByName(themes, base, targetVariant);
        if (direct) return direct.name;
        const withSuffix = findThemeByName(themes, `${base}${suffix}`, targetVariant);
        if (withSuffix) return withSuffix.name;
    }

    const bySuffix = findThemeByName(themes, `${currentName}${suffix}`, targetVariant);
    if (bySuffix) return bySuffix.name;

    const byName = findThemeByName(themes, currentName, targetVariant);
    if (byName) return byName.name;

    return resolveFallbackThemeName(themes, targetVariant);
}

function parseTimeToMinutes(value: string, fallbackMinutes: number): number {
    const [hourRaw, minuteRaw] = value.split(":");
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return fallbackMinutes;
    return Math.min(1439, Math.max(0, hour * 60 + minute));
}

function isLightTime(nowMinutes: number, lightStart: number, darkStart: number): boolean {
    if (lightStart === darkStart) return true;
    if (lightStart < darkStart) {
        return nowMinutes >= lightStart && nowMinutes < darkStart;
    }
    return nowMinutes >= lightStart || nowMinutes < darkStart;
}

function nextBoundaryFromMinutes(now: Date, lightStart: number, darkStart: number): Date {
    const nextLight = new Date(now);
    nextLight.setHours(Math.floor(lightStart / 60), lightStart % 60, 0, 0);
    if (nextLight <= now) nextLight.setDate(nextLight.getDate() + 1);

    const nextDark = new Date(now);
    nextDark.setHours(Math.floor(darkStart / 60), darkStart % 60, 0, 0);
    if (nextDark <= now) nextDark.setDate(nextDark.getDate() + 1);

    return nextLight < nextDark ? nextLight : nextDark;
}

export function useApplyThemeSchedule() {
    const themeScheduleMode = useAppearanceStore((state) => state.themeScheduleMode);
    const themeScheduleLightStart = useAppearanceStore((state) => state.themeScheduleLightStart);
    const themeScheduleDarkStart = useAppearanceStore((state) => state.themeScheduleDarkStart);
    const themeScheduleLat = useAppearanceStore((state) => state.themeScheduleLat);
    const themeScheduleLon = useAppearanceStore((state) => state.themeScheduleLon);
    const setThemeScheduleLocation = useAppearanceStore((state) => state.setThemeScheduleLocation);

    const themes = useThemeStore((state) => state.themes);
    const activeThemeName = useThemeStore((state) => state.activeThemeName);
    const setActiveTheme = useThemeStore((state) => state.setActiveTheme);

    useEffect(() => {
        if (typeof document === "undefined") return;

        let disposed = false;
        let timer: number | null = null;
        let mediaQuery: MediaQueryList | null = null;
        let useCustomFallback = false;

        const clearTimer = () => {
            if (timer !== null) {
                window.clearTimeout(timer);
                timer = null;
            }
        };

        const scheduleNext = (date: Date) => {
            clearTimer();
            const delay = Math.max(1000, date.getTime() - Date.now());
            timer = window.setTimeout(() => {
                runSchedule();
            }, delay);
        };

        const applyVariant = (variant: ThemeVariant) => {
            const nextTheme = resolveThemeForVariant(themes, activeThemeName, variant);
            if (normalizeName(nextTheme) !== normalizeName(activeThemeName)) {
                setActiveTheme(nextTheme);
            }
        };

        const applyCustomSchedule = () => {
            const now = new Date();
            const nowMinutes = now.getHours() * 60 + now.getMinutes();
            const lightStart = parseTimeToMinutes(themeScheduleLightStart, 8 * 60);
            const darkStart = parseTimeToMinutes(themeScheduleDarkStart, 20 * 60);
            const light = isLightTime(nowMinutes, lightStart, darkStart);
            applyVariant(light ? "light" : "dark");
            scheduleNext(nextBoundaryFromMinutes(now, lightStart, darkStart));
        };

        const applySunSchedule = (lat: number, lon: number) => {
            const now = new Date();
            const times = SunCalc.getTimes(now, lat, lon);
            const sunrise = times.sunrise;
            const sunset = times.sunset;
            const light = now >= sunrise && now < sunset;
            applyVariant(light ? "light" : "dark");
            let next = light ? sunset : sunrise;
            if (next <= now) {
                const tomorrow = new Date(now);
                tomorrow.setDate(tomorrow.getDate() + 1);
                next = SunCalc.getTimes(tomorrow, lat, lon).sunrise;
            }
            scheduleNext(next);
        };

        const runSchedule = () => {
            if (disposed) return;

            if (themeScheduleMode === "off") {
                return;
            }

            if (themeScheduleMode === "system") {
                const isDark = mediaQuery ? mediaQuery.matches : window.matchMedia("(prefers-color-scheme: dark)").matches;
                applyVariant(isDark ? "dark" : "light");
                return;
            }

            if (themeScheduleMode === "sun") {
                if (themeScheduleLat !== null && themeScheduleLon !== null) {
                    applySunSchedule(themeScheduleLat, themeScheduleLon);
                    return;
                }
                if (useCustomFallback) {
                    applyCustomSchedule();
                    return;
                }
                if (!navigator.geolocation) {
                    useCustomFallback = true;
                    applyCustomSchedule();
                    return;
                }
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        if (disposed) return;
                        setThemeScheduleLocation(position.coords.latitude, position.coords.longitude);
                        applySunSchedule(position.coords.latitude, position.coords.longitude);
                    },
                    () => {
                        if (disposed) return;
                        useCustomFallback = true;
                        applyCustomSchedule();
                    }
                );
                return;
            }

            applyCustomSchedule();
        };

        if (themeScheduleMode === "off") {
            return () => {
                disposed = true;
                clearTimer();
            };
        }

        if (themeScheduleMode === "system") {
            mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
            const onChange = () => runSchedule();
            if (mediaQuery.addEventListener) {
                mediaQuery.addEventListener("change", onChange);
            } else {
                mediaQuery.addListener(onChange);
            }
            runSchedule();
            return () => {
                disposed = true;
                clearTimer();
                if (mediaQuery) {
                    if (mediaQuery.removeEventListener) {
                        mediaQuery.removeEventListener("change", onChange);
                    } else {
                        mediaQuery.removeListener(onChange);
                    }
                }
            };
        }

        runSchedule();

        return () => {
            disposed = true;
            clearTimer();
        };
    }, [
        themeScheduleMode,
        themeScheduleLightStart,
        themeScheduleDarkStart,
        themeScheduleLat,
        themeScheduleLon,
        setThemeScheduleLocation,
        themes,
        activeThemeName,
        setActiveTheme,
    ]);
}
