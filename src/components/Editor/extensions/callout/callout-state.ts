const STORAGE_KEY = "tessellum-callout-collapse-state";

export function getCollapseStore(): Record<string, boolean> {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
        return {};
    }
}

export function setCollapseState(key: string, collapsed: boolean): void {
    const store = getCollapseStore();
    store[key] = collapsed;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function isCollapsed(key: string, defaultCollapsed: boolean): boolean {
    const store = getCollapseStore();
    if (key in store) return store[key];
    return defaultCollapsed;
}

/** Build a stable key for a callout using its content hash. */
export function calloutKey(filePath: string, headerText: string, lineOffset: number): string {
    return `${filePath}::${lineOffset}::${headerText}`;
}
