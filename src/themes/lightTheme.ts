import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

const markdownHighlighting = HighlightStyle.define([
    { tag: tags.heading1, fontSize: "2.5em", fontWeight: "bold", color: "#111827" },
    { tag: tags.heading2, fontSize: "2.2em", fontWeight: "bold", color: "#1f2937" },
    { tag: tags.heading3, fontSize: "1.9em", fontWeight: "bold", color: "#2d3748" },
    { tag: tags.heading4, fontSize: "1.6em", fontWeight: "bold", color: "#3a4151" },
    { tag: tags.heading5, fontSize: "1.4em", fontWeight: "bold", color: "#474c58" },
    { tag: tags.heading6, fontSize: "1.2em", fontWeight: "bold", color: "#545860" },
    { tag: tags.emphasis, fontStyle: "italic" },
    { tag: tags.strong, fontWeight: "bold" },
    { tag: tags.strikethrough, textDecoration: "line-through", color: "#6b7280" },
    { tag: tags.quote, color: "#4b5563", fontStyle: "italic" },
    { tag: tags.processingInstruction, color: "#9ca3af" },
    { tag: tags.link, color: "#2563eb", textDecoration: "underline"},
]);

const baseTheme = EditorView.theme({
    ".cm-content": {
        fontFamily: "'Inter', sans-serif",
        fontSize: "16px",
        lineHeight: "1.6",
        padding: "20px",
        maxWidth: "800px",
        margin: "0 auto",
    },
    ".cm-cursor": {
        borderLeftColor: "black"
    },
    // Fix for the quote vertical bar
    ".cm-quote": {
        borderLeft: "4px solid #e5e7eb",
        paddingLeft: "10px",
        display: "block", // This helps with block layout
        marginLeft: "0px"
    }
});

export const lightTheme = [
    baseTheme,
    syntaxHighlighting(markdownHighlighting)
];