/**
 * Enabled-state for the `html-preview` plugin, kept outside the plugin class so
 * editor extensions (e.g. media-embed-plugin) can gate HTML support without
 * importing the plugin or querying PluginRegistry.
 *
 * PluginRegistry.disable() runs onunload() BEFORE marking the plugin disabled,
 * so querying the registry during teardown returns a stale value. The plugin
 * sets this flag explicitly in onload()/onunload() instead.
 */
let htmlPreviewEnabled = false;

export function setHtmlPreviewEnabled(enabled: boolean): void {
    htmlPreviewEnabled = enabled;
}

export function isHtmlPreviewEnabled(): boolean {
    return htmlPreviewEnabled;
}
