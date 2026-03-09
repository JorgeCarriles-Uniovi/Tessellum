import { DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { Extension } from "@codemirror/state";
import { HighlightStyle, syntaxHighlighting, syntaxTreeAvailable } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { parseCodeBlocks } from "./code-parser";
import { buildCodeDecorations } from "./code-decoration";

/**
 * Maps Lezer syntax tags to CSS classes for code highlighting.
 */
const codeHighlightStyle = HighlightStyle.define([
    { tag: tags.comment, class: "cm-comment" },
    { tag: tags.keyword, class: "cm-keyword" },
    { tag: tags.operator, class: "cm-operator" },
    { tag: tags.string, class: "cm-string" },
    { tag: tags.number, class: "cm-number" },
    { tag: tags.variableName, class: "cm-variable" },
    { tag: tags.typeName, class: "cm-typeName" },
    { tag: tags.standard(tags.typeName), class: "cm-typePrimitive" },
    { tag: tags.propertyName, class: "cm-propertyName" },
    { tag: tags.className, class: "cm-className" },
    { tag: tags.labelName, class: "cm-labelName" },
    { tag: tags.meta, class: "cm-meta" },
    { tag: tags.bracket, class: "cm-bracket" },
    { tag: tags.tagName, class: "cm-tagName" },
    { tag: tags.attributeName, class: "cm-attributeName" },
    { tag: tags.attributeValue, class: "cm-attributeValue" },
    { tag: tags.bool, class: "cm-bool" },
    { tag: tags.null, class: "cm-null" },
    { tag: tags.function(tags.variableName), class: "cm-functionName" },
    { tag: tags.url, class: "cm-link" },
    { tag: tags.deleted, class: "cm-deleted" },
    { tag: tags.inserted, class: "cm-inserted" },
    { tag: tags.regexp, class: "cm-regex" },
    { tag: tags.macroName, class: "cm-macro" },
    { tag: tags.constant(tags.variableName), class: "cm-variable2" },
    { tag: tags.literal, class: "cm-string" },
    { tag: tags.unit, class: "cm-number" },
    { tag: tags.escape, class: "cm-meta" },
    { tag: tags.special(tags.string), class: "cm-string" },
]);

/**
 * ViewPlugin responsible for applying code block container styling and visual guides.
 */
const codeBlockPlugin = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet;
        private treeAvailable: boolean;

        constructor(view: EditorView) {
            this.treeAvailable = syntaxTreeAvailable(view.state);
            const blocks = parseCodeBlocks(view.state);
            this.decorations = buildCodeDecorations(view, blocks);
        }

        update(update: ViewUpdate) {
            const nowAvailable = syntaxTreeAvailable(update.state);
            const treeJustReady = nowAvailable && !this.treeAvailable;
            this.treeAvailable = nowAvailable;

            if (
                update.docChanged ||
                update.viewportChanged ||
                update.selectionSet ||
                treeJustReady
            ) {
                const blocks = parseCodeBlocks(update.view.state);
                this.decorations = buildCodeDecorations(update.view, blocks);
            }
        }
    },
    {
        decorations: (v) => v.decorations,
    }
);

/**
 * Creates the CodeMirror extension for code block syntax highlighting and container styling.
 */
export function createCodePlugin(): Extension {
    return [
        codeBlockPlugin,
        syntaxHighlighting(codeHighlightStyle),
    ];
}
