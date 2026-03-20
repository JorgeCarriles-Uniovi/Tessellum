import { useEffect, useRef } from "react";
import { useAccessibilityStore } from "../stores";

type AccessibilitySnapshot = {
    highContrast: boolean;
    reducedMotion: boolean;
    uiScale: number;
    colorFilter: string;
};

function setRootDataAttribute(key: string, value: string) {
    const root = document.documentElement;
    root.setAttribute(`data-${key}`, value);
}

function applyAccessibilitySettings(snapshot: AccessibilitySnapshot) {
    const root = document.documentElement;
    root.style.setProperty("--ui-scale", String(snapshot.uiScale / 100));
    setRootDataAttribute("high-contrast", snapshot.highContrast ? "true" : "false");
    setRootDataAttribute("reduced-motion", snapshot.reducedMotion ? "true" : "false");
    setRootDataAttribute("color-filter", snapshot.colorFilter);
}

function isSameSnapshot(a: AccessibilitySnapshot | null, b: AccessibilitySnapshot): boolean {
    if (!a) return false;
    return (
        a.highContrast === b.highContrast &&
        a.reducedMotion === b.reducedMotion &&
        a.uiScale === b.uiScale &&
        a.colorFilter === b.colorFilter
    );
}

export function useApplyAccessibilitySettings() {
    const lastApplied = useRef<AccessibilitySnapshot | null>(null);

    useEffect(() => {
        const applyIfChanged = (state: AccessibilitySnapshot) => {
            if (isSameSnapshot(lastApplied.current, state)) return;
            lastApplied.current = state;
            applyAccessibilitySettings(state);
        };

        applyIfChanged(useAccessibilityStore.getState());
        const unsubscribe = useAccessibilityStore.subscribe((state) => {
            applyIfChanged({
                highContrast: state.highContrast,
                reducedMotion: state.reducedMotion,
                uiScale: state.uiScale,
                colorFilter: state.colorFilter,
            });
        });

        return unsubscribe;
    }, []);
}
