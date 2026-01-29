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
    "&": {
        backgroundColor: "transparent",
        height: "100%",
    },
    "&.cm-focused": {
        outline: "none !important",
    },
    ".cm-content": {
        fontFamily: "'Inter', sans-serif",
        fontSize: "16px",
        lineHeight: "1.6",
        maxWidth: "800px",
        margin: "0 auto",
        padding: "2rem",
        minHeight: "100%",
        paddingBottom: "50vh",
    },
    ".cm-scroller": {
        height: "100%",
        overflow: "auto",
    },
    ".cm-cursor": {
        borderLeftColor: "black"
    },
    ".cm-quote": {
        borderLeft: "4px solid #e5e7eb",
        display: "block", // Forces block layout so the quote bar spans all wrapped lines
        paddingLeft: "10px", // This helps with block layout
        marginLeft: "0px"
    },
    ".cm-wikilink": {
        color: "#1d4ed8",
        textDecoration: "underline",
        cursor: "pointer"
    },
    ".cm-divider-widget": {
        height: "1px",
        backgroundColor: "#9ca3af",
        margin: "1.5rem 0",         // Vertical spacing
        width: "100%",
        display: "block"
    },
    ".cm-math-block .katex table": {
        borderCollapse: "separate !important",
        borderSpacing: "0",
        lineHeight: "normal !important",
        width: "auto !important",
        marginBottom: "0 !important"
    },

    // Ensure the container centers the matrix
    ".cm-math-block": {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
        margin: "1.5rem 0",
        cursor: "default",
        userSelect: "none",
        fontSize: "1.1em",       // Slight bump for readability
    },
    ".cm-math-block .katex tr": {
        border: "none !important",
    },
    ".cm-math-block .katex td": {
        padding: "0 !important",
        border: "none !important",
        lineHeight: "normal !important",
    },
    ".cm-math-inline": {
        display: "inline",
        padding: "0",
        border: "none",
        fontSize: "1.05em",
        lineHeight: "normal",
    }
});

export const lightTheme = [
    baseTheme,
    syntaxHighlighting(markdownHighlighting)
];