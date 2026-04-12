import type { I18nService } from "../../i18n/I18nService.ts";
import { getPluginNamespace, type AppLocale, type PluginTranslationBundles, type TranslateOptions } from "../../i18n/types.ts";

export class I18nAPI {
    constructor(private readonly service: I18nService) {}

    getLocale(): AppLocale {
        return this.service.getLocale();
    }

    setLocale(locale: AppLocale): Promise<void> {
        return this.service.setLocale(locale);
    }

    t(key: string, options?: TranslateOptions): string {
        return this.service.t(key, options);
    }

    registerTranslations(pluginId: string, bundles: PluginTranslationBundles): void {
        this.service.registerPluginTranslations(pluginId, bundles);
    }

    unregisterTranslations(pluginId: string): void {
        this.service.unregisterPluginTranslations(pluginId);
    }

    getPluginNamespace(pluginId: string): string {
        return getPluginNamespace(pluginId);
    }
}
