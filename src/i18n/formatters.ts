import type { AppLocale } from "./types.ts";

export function formatDateValue(locale: AppLocale, value: Date | number | string, options?: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat(locale, options).format(new Date(value));
}

export function formatNumberValue(locale: AppLocale, value: number, options?: Intl.NumberFormatOptions): string {
    return new Intl.NumberFormat(locale, options).format(value);
}

export function formatRelativeTimeValue(
    locale: AppLocale,
    value: number,
    unit: Intl.RelativeTimeFormatUnit,
    options?: Intl.RelativeTimeFormatOptions
): string {
    return new Intl.RelativeTimeFormat(locale, options).format(value, unit);
}
