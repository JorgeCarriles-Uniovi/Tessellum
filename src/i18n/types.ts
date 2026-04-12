export const SUPPORTED_LOCALES = ["en", "es"] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export type TranslationValue = string | TranslationDictionary;

export interface TranslationDictionary {
    [key: string]: TranslationValue;
}

export type NamespacedResources = Record<string, TranslationDictionary>;

export type LocaleResources = Record<AppLocale, NamespacedResources>;

export type PluginTranslationBundles = Partial<Record<AppLocale, TranslationDictionary>> & {
    en: TranslationDictionary;
};

export interface TranslateOptions {
    namespace?: string;
    values?: Record<string, unknown>;
    defaultValue?: string;
}

export interface I18nServiceOptions {
    defaultLocale: AppLocale;
    resources: LocaleResources;
    devMode: boolean;
}

export function isSupportedLocale(value: string): value is AppLocale {
    return SUPPORTED_LOCALES.includes(value as AppLocale);
}

export function getPluginNamespace(pluginId: string): string {
    return `plugin:${pluginId}`;
}
