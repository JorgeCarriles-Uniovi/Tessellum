import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

type RootStyle = {
    values: Map<string, string>;
    setProperty: (name: string, value: string) => void;
    getPropertyValue: (name: string) => string;
    removeProperty: (name: string) => void;
};

function createRoot(initialValues: Record<string, string> = {}) {
    const values = new Map(Object.entries(initialValues));
    const style: RootStyle = {
        values,
        setProperty: (name, value) => {
            values.set(name, value);
        },
        getPropertyValue: (name) => values.get(name) ?? "",
        removeProperty: (name) => {
            values.delete(name);
        },
    };
    const attributes = new Map<string, string>();

    return {
        style,
        attributes,
        setAttribute(name: string, value: string) {
            attributes.set(name, value);
        },
    };
}

async function importAccessibilityModule() {
    vi.resetModules();
    return import("./accessibilityCssVars");
}

describe("shared hooks", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test("applies and restores accessibility css root state", async () => {
        const {
            applyAccessibilityRootState,
            buildHighContrastCssVarOverrides,
        } = await importAccessibilityModule();
        const root = createRoot({
            "--color-bg-primary": "#ffffff",
            "--color-blue-500": "#448aff",
        });

        const overrides = buildHighContrastCssVarOverrides();
        overrides["--color-bg-primary"] = "tampered";
        expect(buildHighContrastCssVarOverrides()["--color-bg-primary"]).not.toBe("tampered");

        applyAccessibilityRootState({
            root,
            snapshot: {
                highContrast: true,
                reducedMotion: true,
                uiScale: 125,
                colorFilter: "protanopia",
            },
        });

        expect(root.style.getPropertyValue("--ui-scale")).toBe("1.25");
        expect(root.attributes.get("data-high-contrast")).toBe("true");
        expect(root.attributes.get("data-reduced-motion")).toBe("true");
        expect(root.attributes.get("data-color-filter")).toBe("protanopia");
        expect(root.style.getPropertyValue("--color-bg-primary")).toBe("var(--hc-color-bg-primary)");

        applyAccessibilityRootState({
            root,
            snapshot: {
                highContrast: false,
                reducedMotion: false,
                uiScale: 100,
                colorFilter: "none",
            },
        });

        expect(root.attributes.get("data-high-contrast")).toBe("false");
        expect(root.style.getPropertyValue("--color-bg-primary")).toBe("#ffffff");
    });

    test("debounces value updates until the delay elapses", async () => {
        const { useDebouncedValue } = await import("./useDebouncedValue");
        const { result, rerender } = renderHook(
            ({ value, delayMs }) => useDebouncedValue(value, delayMs),
            {
                initialProps: { value: "alpha", delayMs: 300 },
            },
        );

        expect(result.current).toBe("alpha");

        rerender({ value: "beta", delayMs: 300 });
        expect(result.current).toBe("alpha");

        act(() => {
            vi.advanceTimersByTime(299);
        });
        expect(result.current).toBe("alpha");

        rerender({ value: "gamma", delayMs: 300 });
        act(() => {
            vi.advanceTimersByTime(300);
        });
        expect(result.current).toBe("gamma");
    });
});
