import { useEffect } from "react";
import { useEditorContentStore, useSettingsStore } from "../stores";
import { toSpellcheckLang } from "../i18n/spellcheck";

const FONT_FALLBACK =
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Helvetica Neue', sans-serif";
const READING_FONT_FALLBACK = "Georgia, 'Times New Roman', serif";

function quoteFontFamily(fontFamily: string, fallback: string): string {
    if (fontFamily.includes(",")) return fontFamily;
    const needsQuotes = fontFamily.includes(" ");
    return `${needsQuotes ? `"${fontFamily}"` : fontFamily}, ${fallback}`;
}

/** Mirrors editor typography settings and locale onto the document root. */
export function useTypographyCssVars() {
    const editorFontSizePx = useEditorContentStore((state) => state.editorFontSizePx);
    const { fontFamily, readingFont, editorLineHeight, editorLetterSpacing, locale } = useSettingsStore();

    useEffect(() => {
        document.documentElement.style.setProperty("--editor-font-size", `${editorFontSizePx}px`);
    }, [editorFontSizePx]);

    useEffect(() => {
        const root = document.documentElement;
        root.style.setProperty("--font-sans", quoteFontFamily(fontFamily, FONT_FALLBACK));
        root.style.setProperty("--editor-line-height", String(editorLineHeight));
        root.style.setProperty("--editor-letter-spacing", `${editorLetterSpacing}em`);
    }, [fontFamily, editorLineHeight, editorLetterSpacing]);

    useEffect(() => {
        document.documentElement.style.setProperty("--font-editor", quoteFontFamily(readingFont, READING_FONT_FALLBACK));
    }, [readingFont]);

    useEffect(() => {
        document.documentElement.lang = toSpellcheckLang(locale);
    }, [locale]);
}
