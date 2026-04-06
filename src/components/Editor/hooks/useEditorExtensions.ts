import { useMemo } from "react";
import { EditorView } from "@codemirror/view";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { TessellumApp } from "../../../plugins/TessellumApp";
import { markdownHeadingFoldExtension } from "../extensions/markdown-heading-fold";

const markdownCloseBracketsExtension = markdownLanguage.data.of({
    closeBrackets: {
        // Reuse CodeMirror's native bracket behavior for markdown markers too.
        brackets: ["(", "[", "{", "'", "\"", "`", "*", "$", "~"],
    },
});

/**
 * Assembles the full CodeMirror extension array by combining:
 * 1. Base markdown language support
 * 2. Plugin-registered extensions (via EditorAPI Compartments)
 *
 * The plugin extensions are wrapped in Compartments by EditorAPI,
 * allowing individual plugins to be reconfigured at runtime.
 */
export function useEditorExtensions() {
    return useMemo(() => {
        const app = TessellumApp.instance;
        return [
            markdown({ base: markdownLanguage, codeLanguages: languages }),
            markdownCloseBracketsExtension,
            markdownHeadingFoldExtension,
            EditorView.lineWrapping,
            ...app.editor.getInitialExtensions(),
        ];
    }, []);
}
