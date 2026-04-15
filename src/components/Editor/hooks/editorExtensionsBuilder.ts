import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { vim } from "@replit/codemirror-vim";
import { markdownHeadingFoldExtension } from "../extensions/markdown-heading-fold.ts";
import { buildEditorExtensionOrder } from "./editorExtensionOrder.ts";

const markdownCloseBracketsExtension = markdownLanguage.data.of({
    closeBrackets: {
        // Reuse CodeMirror's native bracket behavior for markdown markers too.
        brackets: ["(", "[", "{", "'", "\"", "`", "*", "$", "~"],
    },
});
interface BuildEditorExtensionsOptions {
    pluginExtensions: Extension[];
    vimMode: boolean;
    vimExtension?: Extension;
}

export function buildEditorExtensions({
                                          pluginExtensions,
                                          vimMode,
                                          vimExtension = vim(),
                                      }: BuildEditorExtensionsOptions): Extension[] {
    const baseExtensions: Extension[] = [
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        markdownCloseBracketsExtension,
        markdownHeadingFoldExtension,
        EditorView.lineWrapping,
    ];

    return buildEditorExtensionOrder({
        baseExtensions,
        pluginExtensions,
        vimMode,
        vimExtension,
    });
}
