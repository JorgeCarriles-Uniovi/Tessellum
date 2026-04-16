import type { LanguageDescription } from "@codemirror/language";
import type { AppLocale } from "../../../i18n/types.ts";

type SupportedCodeLocale = "en" | "es";

const promiseCache = new Map<SupportedCodeLocale, Promise<readonly LanguageDescription[]>>();
const resolvedCache = new Map<SupportedCodeLocale, readonly LanguageDescription[]>();

function toSupportedCodeLocale(locale: AppLocale): SupportedCodeLocale {
    return locale === "es" ? "es" : "en";
}

export function getCachedCodeLanguages(locale: AppLocale): readonly LanguageDescription[] | null {
    const key = toSupportedCodeLocale(locale);
    return resolvedCache.get(key) ?? null;
}

export async function loadCodeLanguagesForLocale(locale: AppLocale): Promise<readonly LanguageDescription[]> {
    const key = toSupportedCodeLocale(locale);
    const existing = promiseCache.get(key);
    if (existing) {
        return existing;
    }

    const pending = (async () => {
        const langs = key === "es"
            ? (await import("./codeLanguageBundles/es.ts")).getSpanishCodeLanguages()
            : (await import("./codeLanguageBundles/en.ts")).getEnglishCodeLanguages();
        resolvedCache.set(key, langs);
        return langs;
    })();

    promiseCache.set(key, pending);
    return pending;
}

