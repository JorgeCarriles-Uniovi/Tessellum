import { languages } from "@codemirror/language-data";
import type { LanguageDescription } from "@codemirror/language";

export function getSpanishCodeLanguages(): readonly LanguageDescription[] {
    return languages;
}

