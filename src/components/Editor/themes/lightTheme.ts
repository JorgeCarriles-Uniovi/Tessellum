// theme.ts (or whatever your file is named)
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

// Import the CSS file directly here so it loads with the component
import './editor-theme.css';

// We map Lezer tags to the CSS classes we defined in step 1
const markdownHighlighting = HighlightStyle.define([
    { tag: tags.heading1, class: "cm-heading1" },
    { tag: tags.heading2, class: "cm-heading2" },
    { tag: tags.heading3, class: "cm-heading3" },
    { tag: tags.heading4, class: "cm-heading4" },
    { tag: tags.heading5, class: "cm-heading5" },
    { tag: tags.heading6, class: "cm-heading6" },
    { tag: tags.emphasis, class: "cm-emphasis" },
    { tag: tags.strong, class: "cm-strong" },
    { tag: tags.strikethrough, class: "cm-strikethrough" },
    { tag: tags.quote, class: "cm-quote-text" },
    { tag: tags.processingInstruction, class: "cm-proc-inst" },
    { tag: tags.link, class: "cm-link" },
]);

// We keep this wrapper to apply the class mapping
export const lightTheme = [
    // We don't need baseTheme anymore because it's in the CSS file
    // targeting .cm-editor and .cm-content directly
    syntaxHighlighting(markdownHighlighting)
];