import { createInstance, type i18n as I18nInstance } from "i18next";
import { SUPPORTED_LOCALES, getPluginNamespace, isSupportedLocale, type AppLocale, type I18nServiceOptions, type LocaleResources, type PluginTranslationBundles, type TranslateOptions, type TranslationDictionary } from "./types.ts";

function toI18nextResources(resources: LocaleResources) {
    return Object.fromEntries(
        Object.entries(resources).map(([locale, namespaces]) => [
            locale,
            { ...namespaces },
        ])
    );
}

function collectNamespaces(resources: LocaleResources): string[] {
    const namespaces = new Set<string>();
    for (const localeResources of Object.values(resources)) {
        for (const namespace of Object.keys(localeResources)) {
            namespaces.add(namespace);
        }
    }
    return [...namespaces];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateBundleShape(pluginId: string, locale: string, bundle: TranslationDictionary | undefined): asserts bundle is TranslationDictionary {
    if (!bundle || !isPlainObject(bundle)) {
        throw new Error(`Invalid translation bundle for plugin "${pluginId}" and locale "${locale}"`);
    }
}

function hasNestedKey(dictionary: TranslationDictionary | undefined, key: string): boolean {
    if (!dictionary) {
        return false;
    }

    let current: unknown = dictionary;
    for (const segment of key.split(".")) {
        if (!isPlainObject(current) || !(segment in current)) {
            return false;
        }
        current = current[segment];
    }

    return typeof current === "string";
}

export class I18nService {
    private readonly instance: I18nInstance;
    private readonly defaultLocale: AppLocale;
    private readonly devMode: boolean;
    private readonly initPromise: Promise<void>;

    constructor(options: I18nServiceOptions) {
        this.defaultLocale = options.defaultLocale;
        this.devMode = options.devMode;
        this.instance = createInstance();
        this.initPromise = this.instance.init({
            lng: options.defaultLocale,
            fallbackLng: "en",
            supportedLngs: [...SUPPORTED_LOCALES],
            resources: toI18nextResources(options.resources),
            ns: collectNamespaces(options.resources),
            defaultNS: "core",
            interpolation: {
                escapeValue: false,
            },
        }).then(() => undefined);
    }

    async init(): Promise<void> {
        await this.initPromise;
    }

    getI18nInstance(): I18nInstance {
        return this.instance;
    }

    getLocale(): AppLocale {
        const language = this.instance.language ?? this.instance.resolvedLanguage ?? this.defaultLocale;
        return isSupportedLocale(language) ? language : this.defaultLocale;
    }

    async setLocale(locale: AppLocale): Promise<void> {
        await this.init();
        await this.instance.changeLanguage(locale);
    }

    t(key: string, options: TranslateOptions = {}): string {
        const namespace = options.namespace ?? "core";
        const locale = this.getLocale();
        const hasActiveLocaleKey = hasNestedKey(
            this.instance.store.data[locale]?.[namespace] as TranslationDictionary | undefined,
            key
        );

        if (this.devMode && !hasActiveLocaleKey) {
            throw new Error(`Missing translation for locale "${locale}" in namespace "${namespace}": ${key}`);
        }

        return this.instance.t(key, {
            ns: namespace,
            ...options.values,
            defaultValue: options.defaultValue ?? key,
        });
    }

    hasNamespace(namespace: string, locale = this.getLocale()): boolean {
        const bundle = this.instance.getResourceBundle(locale, namespace);
        return Boolean(bundle && Object.keys(bundle).length > 0);
    }

    registerPluginTranslations(pluginId: string, bundles: PluginTranslationBundles): void {
        if (!bundles.en) {
            throw new Error(`Plugin "${pluginId}" must provide English translations`);
        }

        const namespace = getPluginNamespace(pluginId);

        for (const locale of SUPPORTED_LOCALES) {
            const bundle = bundles[locale];
            if (!bundle) {
                continue;
            }

            validateBundleShape(pluginId, locale, bundle);
            this.instance.addResourceBundle(locale, namespace, bundle, true, true);
        }
    }

    unregisterPluginTranslations(pluginId: string): void {
        const namespace = getPluginNamespace(pluginId);
        for (const locale of SUPPORTED_LOCALES) {
            this.instance.removeResourceBundle(locale, namespace);
        }
    }
}

export { getPluginNamespace };
