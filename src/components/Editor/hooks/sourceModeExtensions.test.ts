import { describe, expect, test } from "vitest";
import { getEditorExtensionPluginIds } from "./sourceModeExtensions";

describe("getEditorExtensionPluginIds", () => {
    test("filters html-preview out of the plugin id list in source mode", () => {
        const pluginIds = ["html-preview", "mermaid", "some-other-plugin"];

        const result = getEditorExtensionPluginIds("source", pluginIds);

        expect(result).not.toContain("html-preview");
    });

    test("keeps html-preview in the plugin id list outside source mode", () => {
        const pluginIds = ["html-preview", "mermaid", "some-other-plugin"];

        expect(getEditorExtensionPluginIds("live-preview", pluginIds)).toContain("html-preview");
        expect(getEditorExtensionPluginIds("reading", pluginIds)).toContain("html-preview");
    });
});
