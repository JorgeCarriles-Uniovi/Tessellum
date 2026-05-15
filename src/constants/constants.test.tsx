import { describe, expect, test } from "vitest";
import {
    CALLOUT_CATEGORIES,
    CALLOUT_TYPES,
    getCalloutType,
    getCalloutsByCategory,
} from "./callout-types";
import {
    DEFAULT_EDITOR_MODE,
    EDITOR_MODES,
    isEditorMode,
} from "./editorModes";
import { APP_SHORTCUTS } from "./shortcuts";

describe("constants", () => {
    test("resolves callout types case-insensitively and returns undefined for unknown ids", () => {
        expect(getCalloutType("NOTE")?.label).toBe("Note");
        expect(getCalloutType("terminal")?.category).toBe("Other");
        expect(getCalloutType("missing")).toBeUndefined();
    });

    test("groups all callout types by category without losing entries", () => {
        const grouped = getCalloutsByCategory();
        const groupedIds = Object.values(grouped).flat().map((item) => item.id).sort();
        const allIds = CALLOUT_TYPES.map((item) => item.id).sort();

        expect(CALLOUT_CATEGORIES).toEqual([
            "Informational",
            "Warning",
            "Status",
            "Other",
        ]);
        expect(groupedIds).toEqual(allIds);
        expect(grouped.Warning.every((item) => item.category === "Warning")).toBe(true);
    });

    test("accepts only supported editor modes", () => {
        expect(DEFAULT_EDITOR_MODE).toBe("live-preview");
        expect(Object.keys(EDITOR_MODES)).toEqual(["reading", "live-preview", "source"]);
        expect(isEditorMode("reading")).toBe(true);
        expect(isEditorMode("live-preview")).toBe(true);
        expect(isEditorMode("source")).toBe(true);
        expect(isEditorMode("preview")).toBe(false);
        expect(isEditorMode(null)).toBe(false);
        expect(isEditorMode(undefined)).toBe(false);
    });

    test("keeps application shortcuts unique and well formed", () => {
        const ids = APP_SHORTCUTS.map((item) => item.id);
        const shortcuts = APP_SHORTCUTS.map((item) => item.shortcut);

        expect(new Set(ids).size).toBe(ids.length);
        expect(new Set(shortcuts).size).toBe(shortcuts.length);
        expect(APP_SHORTCUTS.every((item) => item.labelKey.length > 0)).toBe(true);
    });
});
