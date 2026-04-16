import { languages } from "@codemirror/language-data";
import type { LanguageDescription } from "@codemirror/language";

export function getEnglishCodeLanguages(): readonly LanguageDescription[] {
    return languages;
}

