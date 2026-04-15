import { useEffect, useRef } from "react";
import { useAccessibilityStore, useAppearanceStore, useThemeStore } from "../stores";
import { applyAccessibilityRootState, type AccessibilitySnapshot } from "./accessibilityCssVars.ts";

function toAccessibilitySnapshot(): AccessibilitySnapshot {
    const state = useAccessibilityStore.getState();
    return {
        highContrast: state.highContrast,
        reducedMotion: state.reducedMotion,
        uiScale: state.uiScale,
        colorFilter: state.colorFilter,
    };
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
        const applySnapshot = (snapshot: AccessibilitySnapshot, force = false) => {
            if (!force && isSameSnapshot(lastApplied.current, snapshot)) return;
            lastApplied.current = snapshot;
            applyAccessibilityRootState({ snapshot });
        };

        const queueHighContrastOverlay = () => {
            // Theme and appearance writes happen synchronously, so reapply the
            // high-contrast overlay after those updates finish.
            queueMicrotask(() => {
                const snapshot = toAccessibilitySnapshot();
                if (!snapshot.highContrast) return;
                applySnapshot(snapshot, true);
            });
        };

        applySnapshot(toAccessibilitySnapshot(), true);
        const unsubscribeAccessibility = useAccessibilityStore.subscribe((state) => {
            applySnapshot({
                highContrast: state.highContrast,
                reducedMotion: state.reducedMotion,
                uiScale: state.uiScale,
                colorFilter: state.colorFilter,
            });
        });
        const unsubscribeAppearance = useAppearanceStore.subscribe(queueHighContrastOverlay);
        const unsubscribeTheme = useThemeStore.subscribe(queueHighContrastOverlay);

        return () => {
            unsubscribeAccessibility();
            unsubscribeAppearance();
            unsubscribeTheme();
        };
    }, []);
}
