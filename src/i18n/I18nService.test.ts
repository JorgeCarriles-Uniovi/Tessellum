import { describe, expect, test } from "vitest";
import { I18nService } from "./I18nService";
import { resources } from "./resources";
import type { PluginTranslationBundles } from "./types";

describe("I18nService", () => {
    test("translates with the default locale and can switch locale", async () => {
        const service = new I18nService({
            defaultLocale: "en",
            resources,
            devMode: false,
        });

        await service.init();
        expect(service.getLocale()).toBe("en");
        expect(service.t("sidebar.openVault")).toBe("Open vault");

        await service.setLocale("es");
        expect(service.getLocale()).toBe("es");
        expect(service.t("sidebar.openVault")).toBe("Abrir vault");
    });

    test("throws in dev mode when a translation key is missing for the active locale", async () => {
        const service = new I18nService({
            defaultLocale: "en",
            resources,
            devMode: true,
        });

        await service.init();

        expect(() => service.t("missing.key")).toThrow(
            'Missing translation for locale "en" in namespace "core": missing.key',
        );
    });

    test("registers and unregisters plugin translation bundles", async () => {
        const service = new I18nService({
            defaultLocale: "en",
            resources,
            devMode: false,
        });
        const bundles: PluginTranslationBundles = {
            en: { greeting: "Hello plugin" },
            es: { greeting: "Hola plugin" },
        };

        await service.init();
        service.registerPluginTranslations("sample-plugin", bundles);

        expect(service.hasNamespace("plugin:sample-plugin", "en")).toBe(true);
        expect(service.t("greeting", { namespace: "plugin:sample-plugin" })).toBe("Hello plugin");

        await service.setLocale("es");
        expect(service.t("greeting", { namespace: "plugin:sample-plugin" })).toBe("Hola plugin");

        service.unregisterPluginTranslations("sample-plugin");
        expect(service.hasNamespace("plugin:sample-plugin", "es")).toBe(false);
    });

    test("requires english plugin translations", async () => {
        const service = new I18nService({
            defaultLocale: "en",
            resources,
            devMode: false,
        });

        await service.init();

        expect(() =>
            service.registerPluginTranslations("broken-plugin", {
                es: { greeting: "Hola" },
            } as PluginTranslationBundles),
        ).toThrow('Plugin "broken-plugin" must provide English translations');
    });
});
