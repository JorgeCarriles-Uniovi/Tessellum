import { describe, expect, test } from "vitest";
import { formatDateValue, formatNumberValue, formatRelativeTimeValue } from "./formatters";
import { resources } from "./resources";
import { toSpellcheckLang } from "./spellcheck";
import { getPluginNamespace, isSupportedLocale, SUPPORTED_LOCALES } from "./types";

describe("i18n core helpers", () => {
    test("recognizes supported locales and plugin namespaces", () => {
        expect(SUPPORTED_LOCALES).toEqual(["en", "es"]);
        expect(isSupportedLocale("en")).toBe(true);
        expect(isSupportedLocale("es")).toBe(true);
        expect(isSupportedLocale("fr")).toBe(false);
        expect(getPluginNamespace("daily-notes")).toBe("plugin:daily-notes");
    });

    test("maps locales to spellcheck languages", () => {
        expect(toSpellcheckLang("en")).toBe("en-US");
        expect(toSpellcheckLang("es")).toBe("es-ES");
    });

    test("exposes both core namespaces for every bundled locale", () => {
        expect(Object.keys(resources.en)).toEqual(["core", "settings"]);
        expect(Object.keys(resources.es)).toEqual(["core", "settings"]);
        expect(resources.en.core.appName).toBe("Tessellum");
        expect(resources.es.settings.title).toBe("Configuración");
    });

    test("formats dates, numbers, and relative times using the locale wrappers", () => {
        const date = new Date(Date.UTC(2026, 3, 28, 0, 0, 0));
        const dateOptions = { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" } as const;
        const numberOptions = { maximumFractionDigits: 1 } as const;
        const relativeOptions = { numeric: "auto" } as const;

        expect(formatDateValue("en", date, dateOptions)).toBe(
            new Intl.DateTimeFormat("en", dateOptions).format(date),
        );
        expect(formatNumberValue("es", 1234.56, numberOptions)).toBe(
            new Intl.NumberFormat("es", numberOptions).format(1234.56),
        );
        expect(formatRelativeTimeValue("en", -1, "day", relativeOptions)).toBe(
            new Intl.RelativeTimeFormat("en", relativeOptions).format(-1, "day"),
        );
    });
});
