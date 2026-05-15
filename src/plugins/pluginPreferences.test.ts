import { afterEach, describe, expect, test, vi } from "vitest";

afterEach(() => {
    vi.restoreAllMocks();
});

async function importPreferencesModule() {
    vi.resetModules();
    return import("./pluginPreferences");
}

describe("pluginPreferences", () => {
    test("returns empty arrays for missing, invalid, or non-array storage values", async () => {
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const { readDisabledPluginIds } = await importPreferencesModule();

        expect(readDisabledPluginIds()).toEqual([]);

        localStorage.setItem("tessellum:plugins:disabled", "not-json");
        expect(readDisabledPluginIds()).toEqual([]);
        expect(consoleError).toHaveBeenCalledTimes(1);

        localStorage.setItem("tessellum:plugins:disabled", JSON.stringify({ value: true }));
        expect(readDisabledPluginIds()).toEqual([]);
    });

    test("filters invalid entries and writes unique plugin ids", async () => {
        const { readDisabledPluginIds, writeDisabledPluginIds } = await importPreferencesModule();

        localStorage.setItem(
            "tessellum:plugins:disabled",
            JSON.stringify(["daily-notes", 12, "daily-notes", "graph"]),
        );
        expect(readDisabledPluginIds()).toEqual(["daily-notes", "daily-notes", "graph"]);

        writeDisabledPluginIds(["graph", "daily-notes", "graph"]);
        expect(localStorage.getItem("tessellum:plugins:disabled")).toBe(
            JSON.stringify(["graph", "daily-notes"]),
        );
    });

    test("logs storage write failures without throwing", async () => {
        const { writeDisabledPluginIds } = await importPreferencesModule();
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("blocked");
        });

        expect(() => writeDisabledPluginIds(["graph"])).not.toThrow();
        expect(consoleError).toHaveBeenCalledTimes(1);

        setItem.mockRestore();
    });
});
