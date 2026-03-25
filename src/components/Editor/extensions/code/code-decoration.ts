import { Decoration, DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { CodeBlock } from "./code-parser";
import { toast } from "sonner";
import { markdownPreviewForceHideFacet } from "../markdown-preview-plugin";

/**
 * Widget for the interactive language badge in code blocks.
 */
class CodeBlockBadgeWidget extends WidgetType {
    constructor(
        readonly language: string,
        readonly code: string
    ) {
        super();
    }

    eq(other: CodeBlockBadgeWidget): boolean {
        return this.language === other.language && this.code === other.code;
    }

    toDOM(): HTMLElement {
        const badge = document.createElement("div");
        badge.className = "cm-codeblock-badge";
        badge.textContent = this.language || "code";

        // Tooltip
        const tooltip = document.createElement("div");
        tooltip.className = "cm-codeblock-tooltip";
        tooltip.textContent = "Copy";
        badge.appendChild(tooltip);

        // Use mousedown to stop propagation early and prevent editor focus
        badge.onmousedown = (e) => {
            e.stopPropagation();
        };

        badge.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();

            navigator.clipboard.writeText(this.code).then(() => {
                toast.success("Code copied to clipboard!", {
                    duration: 2000,
                    position: "bottom-right"
                });
            }).catch(err => {
                console.error("Failed to copy:", err);
                toast.error("Failed to copy code");
            });
        };

        return badge;
    }

    ignoreEvent(): boolean {
        return true;
    }
}

/**
 * Builds decorations for code block containers, indent guides, and marker hiding.
 */
export function buildCodeDecorations(view: EditorView, blocks: CodeBlock[]): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const selection = view.state.selection.main;
    const forceHide = view.state.facet(markdownPreviewForceHideFacet);

    for (const block of blocks) {
        const { from, to, language } = block;
        const firstLine = view.state.doc.lineAt(from);
        const lastLine = view.state.doc.lineAt(to);
        const isSolo = firstLine.number === lastLine.number;

        // Check if cursor is inside the block
        const cursorInside = selection.from >= from && selection.to <= to;
        const hideDelimiters = forceHide || !cursorInside;

        // 1. Find the range of lines with non-whitespace text
        let firstTextLine = -1;
        let lastTextLine = -1;

        let scanPos = from;
        while (scanPos <= to) {
            const line = view.state.doc.lineAt(scanPos);
            if (line.text.trim().length > 0) {
                if (firstTextLine === -1) firstTextLine = line.number;
                lastTextLine = line.number;
            }
            if (scanPos >= line.to && scanPos >= to) break;
            scanPos = line.to + 1;
        }

        // Apply decorations to all lines within the code block
        let pos = from;
        let currentIndentWidth = 0; // Carry over width for empty lines

        while (pos <= to) {
            const line = view.state.doc.lineAt(pos);
            let cls = "cm-codeblock";

            if (isSolo) {
                cls += " cm-codeblock-solo";
            } else if (line.number === firstLine.number) {
                cls += " cm-codeblock-first";
            } else if (line.number === lastLine.number) {
                cls += " cm-codeblock-last";
            }

            // If not inside, add a class to delimiters
            if (hideDelimiters && (line.number === firstLine.number || line.number === lastLine.number)) {
                cls += " cm-codeblock-hidden-delimiter";
            }

            let attrs: Record<string, string> = {};
            if (language && line.number === firstLine.number) {
                attrs["data-lang"] = language;
            }

            // Indentation guides - only show if within the "text-bearing" range
            let indentStyle = "--indent-width: 0ch";
            if (!isSolo && line.number !== firstLine.number && line.number !== lastLine.number) {
                const text = line.text;

                // Update width if there's text, otherwise use the carried-over width
                // ONLY if we are within the continuous first -> last text range
                if (text.trim().length > 0) {
                    const match = text.match(/^(\s+)/);
                    if (match) {
                        currentIndentWidth = match[1].length - 1;
                    } else {
                        currentIndentWidth = 0;
                    }
                }

                if (firstTextLine !== -1 && line.number >= firstTextLine && line.number <= lastTextLine) {
                    indentStyle = `--indent-width: ${currentIndentWidth}ch`;
                }
            }
            attrs["style"] = indentStyle;

            // Apply line decoration
            builder.add(line.from, line.from, Decoration.line({
                class: cls,
                attributes: attrs
            }));

            // Hide the actual Markdown characters when not editing
            if (hideDelimiters) {
                if (line.number === firstLine.number) {
                    // Calculate code content (all rows between delimiters)
                    const contentStart = firstLine.to + 1;
                    const contentEnd = lastLine.from - 1;
                    const codeContent = contentEnd > contentStart
                        ? view.state.doc.sliceString(contentStart, contentEnd)
                        : "";

                    // Replace delimiter with the interactive badge widget
                    builder.add(line.from, line.to, Decoration.replace({
                        widget: new CodeBlockBadgeWidget(language, codeContent)
                    }));
                } else if (line.number === lastLine.number) {
                    builder.add(line.from, line.to, Decoration.replace({}));
                }
            }

            if (pos >= line.to && pos >= to) break;
            pos = line.to + 1;
        }
    }

    return builder.finish();
}
