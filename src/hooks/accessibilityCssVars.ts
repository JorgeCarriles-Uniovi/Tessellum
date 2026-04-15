export type AccessibilitySnapshot = {
    highContrast: boolean;
    reducedMotion: boolean;
    uiScale: number;
    colorFilter: string;
};

type RootLike = {
    style: {
        setProperty: (name: string, value: string) => void;
        getPropertyValue: (name: string) => string;
        removeProperty: (name: string) => void;
    };
    setAttribute: (name: string, value: string) => void;
};

const GRAYSCALE_OVERRIDE_KEYS = [
    "--color-gray-50",
    "--color-gray-100",
    "--color-gray-200",
    "--color-gray-300",
    "--color-gray-400",
    "--color-gray-500",
    "--color-gray-600",
    "--color-gray-700",
    "--color-gray-800",
    "--color-gray-900",
] as const;

const ACCENT_OVERRIDE_KEYS = [
    "--color-blue-50",
    "--color-blue-100",
    "--color-blue-200",
    "--color-blue-300",
    "--color-blue-400",
    "--color-blue-500",
    "--color-blue-600",
    "--color-blue-700",
    "--color-blue-800",
    "--color-blue-900",
] as const;

const SEMANTIC_OVERRIDE_KEYS = [
    "--color-bg-primary",
    "--color-bg-secondary",
    "--color-bg-tertiary",
    "--color-text-primary",
    "--color-text-secondary",
    "--color-text-tertiary",
    "--color-text-muted",
    "--color-text-link",
    "--color-border-light",
    "--color-border-medium",
    "--color-border-dark",
    "--background",
    "--foreground",
    "--card",
    "--card-foreground",
    "--popover",
    "--popover-foreground",
    "--primary",
    "--primary-foreground",
    "--secondary",
    "--secondary-foreground",
    "--muted",
    "--muted-foreground",
    "--accent",
    "--accent-foreground",
    "--destructive",
    "--destructive-foreground",
    "--border",
    "--input",
    "--ring",
] as const;

const SIDEBAR_OVERRIDE_KEYS = [
    "--sidebar",
    "--sidebar-foreground",
    "--sidebar-primary",
    "--sidebar-primary-foreground",
    "--sidebar-accent",
    "--sidebar-accent-foreground",
    "--sidebar-border",
    "--sidebar-ring",
] as const;

const GRAPH_OVERRIDE_KEYS = [
    "--graph-bg",
    "--graph-node",
    "--graph-node-orphan",
    "--graph-node-missing",
    "--graph-node-label",
    "--graph-edge",
    "--graph-edge-broken",
    "--graph-node-active",
] as const;

const EDITOR_OVERRIDE_KEYS = [
    "--terminal-header-bg",
    "--terminal-line-bg",
    "--terminal-border",
    "--terminal-text",
    "--terminal-muted",
    "--syntax-comment",
    "--syntax-keyword",
    "--syntax-operator",
    "--syntax-string",
    "--syntax-number",
    "--syntax-variable",
    "--syntax-function",
    "--code-inline-color",
    "--code-inline-bg",
    "--code-inline-border",
    "--cm-hashtag",
    "--cm-hashtag-bg",
] as const;

const PANEL_OVERRIDE_KEYS = [
    "--color-panel-bg",
    "--color-panel-border",
    "--color-panel-header",
    "--color-panel-footer",
    "--color-panel-hover",
    "--color-panel-active",
    "--color-overlay-scrim",
    "--color-highlight-bg",
    "--color-highlight-text",
    "--color-kbd-bg",
    "--color-kbd-border",
    "--color-kbd-text",
    "--color-alert-bg",
    "--color-alert-border",
    "--color-alert-text",
] as const;

const CALLOUT_OVERRIDE_KEYS = [
    "--callout-color",
    "--callout-info",
    "--callout-tip",
    "--callout-warning",
    "--callout-danger",
    "--callout-success",
    "--callout-example",
    "--callout-quote",
    "--callout-terminal",
] as const;

const HIGH_CONTRAST_OVERRIDE_KEYS = [
    ...GRAYSCALE_OVERRIDE_KEYS,
    ...ACCENT_OVERRIDE_KEYS,
    ...SEMANTIC_OVERRIDE_KEYS,
    ...SIDEBAR_OVERRIDE_KEYS,
    ...GRAPH_OVERRIDE_KEYS,
    ...EDITOR_OVERRIDE_KEYS,
    ...PANEL_OVERRIDE_KEYS,
    ...CALLOUT_OVERRIDE_KEYS,
] as const;

const HIGH_CONTRAST_OVERRIDES = Object.freeze(
    Object.fromEntries(
        HIGH_CONTRAST_OVERRIDE_KEYS.map((key) => [key, `var(--hc-${key.slice(2)})`]),
    ) as Record<string, string>,
);

// High contrast temporarily replaces inline theme/appearance values, so we
// keep the previous inline state and restore it when the mode is turned off.
const previousInlineValues = new Map<string, string>();

export function buildHighContrastCssVarOverrides(): Record<string, string> {
    return { ...HIGH_CONTRAST_OVERRIDES };
}

function applyHighContrastOverrides(root: RootLike, enabled: boolean) {
    Object.entries(HIGH_CONTRAST_OVERRIDES).forEach(([key, value]) => {
        if (enabled) {
            const currentValue = root.style.getPropertyValue(key);
            if (currentValue !== value) {
                previousInlineValues.set(key, currentValue);
            }
            root.style.setProperty(key, value);
            return;
        }

        const previousValue = previousInlineValues.get(key);
        if (previousValue) {
            root.style.setProperty(key, previousValue);
        } else {
            root.style.removeProperty(key);
        }
    });

    if (!enabled) {
        previousInlineValues.clear();
    }
}

export function applyAccessibilityRootState({
                                                root = document.documentElement,
                                                snapshot,
                                            }: {
    root?: RootLike;
    snapshot: AccessibilitySnapshot;
}) {
    root.style.setProperty("--ui-scale", String(snapshot.uiScale / 100));
    root.setAttribute("data-high-contrast", snapshot.highContrast ? "true" : "false");
    root.setAttribute("data-reduced-motion", snapshot.reducedMotion ? "true" : "false");
    root.setAttribute("data-color-filter", snapshot.colorFilter);
    applyHighContrastOverrides(root, snapshot.highContrast);
}
