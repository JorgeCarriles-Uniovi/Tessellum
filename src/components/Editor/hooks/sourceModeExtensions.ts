import type { EditorMode } from "../../../constants/editorModes";

const SOURCE_MODE_HIDDEN_PLUGIN_IDS = new Set([
    "markdown-preview",
    "divider",
    "math",
    "inline-code",
    "callout",
    "table",
    "wikilink",
    "code",
    "mermaid",
    "frontmatter",
    "inline-tags",
    "media-embed",
    "task-list",
]);

export function getEditorExtensionPluginIds(editorMode: EditorMode, pluginIds: string[]): string[] {
    if (editorMode !== "source") {
        return pluginIds;
    }

    return pluginIds.filter((pluginId) => !SOURCE_MODE_HIDDEN_PLUGIN_IDS.has(pluginId));
}

export function getInitialExtensionPluginIds(editorMode: EditorMode, pluginIds: string[]): string[] {
    return getEditorExtensionPluginIds(editorMode, pluginIds);
}

export function isSourceModeEnabled(config: { disabled?: boolean }): boolean {
    return !config.disabled;
}
