import type { AppLocale } from "./types";

const SPELLCHECK_LANG_BY_LOCALE: Record<AppLocale, string> = {
    en: "en-US",
    es: "es-ES",
};

export function toSpellcheckLang(locale: AppLocale): string {
    return SPELLCHECK_LANG_BY_LOCALE[locale] ?? "en-US";
}

