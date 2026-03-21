import { THEME_TOKEN_KEYS, type ThemeTokenKey, type ThemeTokenMap } from "./themeTokens";
import type { ThemeDefinition, ThemeVariant } from "./builtinThemes";

const RESERVED_FIELDS = new Set(["name", "variant", "isDark", "author", "description"]);

export function normalizeThemeName(name: string): string {
    return name.trim().toLowerCase();
}

export function coerceVariant(value: unknown, fallback: ThemeVariant): ThemeVariant {
    if (value === "light" || value === "dark") return value;
    if (value === true) return "dark";
    if (value === false) return "light";
    return fallback;
}

function flattenTokens(input: unknown, prefix: string, output: Record<string, string>) {
    if (!input || typeof input !== "object") return;
    const entries = Object.entries(input as Record<string, unknown>);
    entries.forEach(([key, value]) => {
        const nextKey = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === "object" && !Array.isArray(value)) {
            flattenTokens(value, nextKey, output);
            return;
        }
        if (value === null || value === undefined) return;
        output[nextKey] = String(value);
    });
}

export function extractTokens(raw: Record<string, unknown>): ThemeTokenMap {
    const flattened: Record<string, string> = {};
    Object.entries(raw).forEach(([key, value]) => {
        if (RESERVED_FIELDS.has(key)) return;
        if (value && typeof value === "object" && !Array.isArray(value)) {
            flattenTokens(value, key, flattened);
            return;
        }
        if (value === null || value === undefined) return;
        flattened[key] = String(value);
    });

    const tokens: ThemeTokenMap = {};
    THEME_TOKEN_KEYS.forEach((tokenKey: ThemeTokenKey) => {
        if (Object.prototype.hasOwnProperty.call(flattened, tokenKey)) {
            tokens[tokenKey] = flattened[tokenKey];
        }
    });
    return tokens;
}

export function parseJsonTheme(text: string): Record<string, unknown> | null {
    try {
        const raw = JSON.parse(text);
        if (!raw || typeof raw !== "object") return null;
        return raw as Record<string, unknown>;
    } catch {
        return null;
    }
}

export function parseFlatYaml(text: string): Record<string, unknown> | null {
    const lines = text.split(/\r?\n/);
    const result: Record<string, unknown> = {};

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const match = trimmed.match(/^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/);
        if (!match) continue;
        const [, key, rawValue] = match;
        const value = rawValue.trim();
        if (!value) {
            result[key] = "";
            continue;
        }
        if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
            const unquoted = value.slice(1, -1);
            result[key] = unquoted;
            continue;
        }
        result[key] = value;
    }

    return Object.keys(result).length > 0 ? result : null;
}

export function parseThemeDefinition(
    raw: Record<string, unknown>,
    source: ThemeDefinition["source"],
    fallbackVariant: ThemeVariant
): ThemeDefinition | null {
    const nameValue = raw.name;
    const name = typeof nameValue === "string" ? nameValue.trim() : "";
    if (!name) return null;
    const variant = coerceVariant(raw.variant ?? raw.isDark, fallbackVariant);
    const tokens = extractTokens(raw);
    return {
        name,
        variant,
        tokens,
        source,
    };
}
