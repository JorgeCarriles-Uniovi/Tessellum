import { useMemo } from "react";
import { EditorView } from "@codemirror/view";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { TessellumApp } from "../../../plugins/TessellumApp";

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
            EditorView.lineWrapping,
            ...app.editor.getInitialExtensions(),
        ];
    }, []);
}