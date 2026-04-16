import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import type { Extension } from "@codemirror/state";
import { EditorView, lineNumbers as cmLineNumbers } from "@codemirror/view";
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
    lineNumbers: boolean;
    vimExtension?: Extension;
}

const TABLE_SEPARATOR_CELL_RE = /^\s*:?-{3,}:?\s*$/;

function isTableSeparatorLine(text: string): boolean {
    const stripped = text.trim();
    if (!stripped.includes("|")) return false;

    const inner = stripped.startsWith("|") ? stripped.slice(1) : stripped;
    const trimmed = inner.endsWith("|") ? inner.slice(0, -1) : inner;
    const cells = trimmed.split("|").map((cell) => cell.trim());
    return cells.length > 1 && cells.every((cell) => TABLE_SEPARATOR_CELL_RE.test(cell));
}

export function buildEditorExtensions({
                                          pluginExtensions,
                                          vimMode,
                                          lineNumbers,
                                          vimExtension = vim(),
                                      }: BuildEditorExtensionsOptions): Extension[] {
    const baseExtensions: Extension[] = [
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        markdownCloseBracketsExtension,
        markdownHeadingFoldExtension,
        EditorView.lineWrapping,
    ];

    if (lineNumbers) {
        baseExtensions.push(cmLineNumbers({
            formatNumber: (lineNo, state) => {
                try {
                    if (!Number.isInteger(lineNo) || lineNo < 1 || lineNo > state.doc.lines) {
                        return String(lineNo);
                    }

                    const lineText = state.doc.line(lineNo).text;
                    return isTableSeparatorLine(lineText) ? "" : String(lineNo);
                } catch {
                    // Never let line-number formatting break the entire gutter.
                    return String(lineNo);
                }
            },
        }));
    }

    return buildEditorExtensionOrder({
        baseExtensions,
        pluginExtensions,
        vimMode,
        vimExtension,
    });
}
