const DISABLED_PLUGINS_KEY = "tessellum:plugins:disabled";

export function readDisabledPluginIds(): string[] {
    try {
        const raw = localStorage.getItem(DISABLED_PLUGINS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((id) => typeof id === "string");
    } catch (e) {
        console.error("[Plugins] Failed to read disabled plugins", e);
        return [];
    }
}

export function writeDisabledPluginIds(ids: string[]): void {
    try {
        const unique = Array.from(new Set(ids));
        localStorage.setItem(DISABLED_PLUGINS_KEY, JSON.stringify(unique));
    } catch (e) {
        console.error("[Plugins] Failed to write disabled plugins", e);
    }
}
