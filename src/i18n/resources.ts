import type { LocaleResources } from "./types.ts";
import enCore from "./locales/en/core.ts";
import enSettings from "./locales/en/settings.ts";
import esCore from "./locales/es/core.ts";
import esSettings from "./locales/es/settings.ts";

export const resources: LocaleResources = {
    en: {
        core: enCore,
        settings: enSettings,
    },
    es: {
        core: esCore,
        settings: esSettings,
    },
};
