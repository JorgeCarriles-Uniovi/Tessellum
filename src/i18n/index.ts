import { I18nService } from "./I18nService.ts";
import { resources } from "./resources.ts";
import { readStoredLocale } from "../stores/settingsStore.ts";

export const appI18n = new I18nService({
    defaultLocale: readStoredLocale(),
    resources,
    devMode: import.meta.env.DEV,
});

export const i18nReady = appI18n.init();

export { getPluginNamespace } from "./I18nService.ts";
export * from "./types.ts";
export * from "./formatters.ts";
