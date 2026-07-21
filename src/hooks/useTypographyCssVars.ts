import { useEffect } from "react";
import { useEditorContentStore, useSettingsStore } from "../stores";
import { toSpellcheckLang } from "../i18n/spellcheck";

const FONT_FALLBACK =
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Helvetica Neue', sans-serif";

/** Mirrors editor typography settings and locale onto the document root. */
export function useTypographyCssVars() {
    const editorFontSizePx = useEditorContentStore((state) => state.editorFontSizePx);
    const { fontFamily, editorLineHeight, editorLetterSpacing, locale } = useSettingsStore();

    useEffect(() => {
        document.documentElement.style.setProperty("--editor-font-size", `${editorFontSizePx}px`);
    }, [editorFontSizePx]);

    useEffect(() => {
        const root = document.documentElement;
        const hasComma = fontFamily.includes(",");
        const needsQuotes = fontFamily.includes(" ");
        const family = hasComma ? fontFamily : `${needsQuotes ? `"${fontFamily}"` : fontFamily}, ${FONT_FALLBACK}`;
        root.style.setProperty("--font-sans", family);
        root.style.setProperty("--editor-line-height", String(editorLineHeight));
        root.style.setProperty("--editor-letter-spacing", `${editorLetterSpacing}em`);
    }, [fontFamily, editorLineHeight, editorLetterSpacing]);

    useEffect(() => {
        document.documentElement.lang = toSpellcheckLang(locale);
    }, [locale]);
}
