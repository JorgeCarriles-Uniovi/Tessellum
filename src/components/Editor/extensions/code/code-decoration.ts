import { Decoration, DecorationSet, EditorView } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { CodeBlock } from "./code-parser";

/**
 * Builds decorations for code block containers, indent guides, and marker hiding.
 */
export function buildCodeDecorations(view: EditorView, blocks: CodeBlock[]): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const selection = view.state.selection.main;

    for (const block of blocks) {
        const { from, to, language } = block;
        const firstLine = view.state.doc.lineAt(from);
        const lastLine = view.state.doc.lineAt(to);
        const isSolo = firstLine.number === lastLine.number;

        // Check if cursor is inside the block
        const cursorInside = selection.from >= from && selection.to <= to;

        // Apply background class to all lines within the code block
        let pos = from;
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

            let attrs: Record<string, string> = {};
            if (language && line.number === firstLine.number) {
                attrs["data-lang"] = language;
            }

            // Add Indentation width as a CSS variable for the vertical continuous lines
            let indentStyle = "--indent-width: 0ch";
            if (line.number !== firstLine.number && line.number !== lastLine.number) {
                const text = line.text;
                const match = text.match(/^(\s+)/);
                if (match) {
                    const whitespace = match[1];
                    // Count with tab-size awareness (assuming 2 for this project)
                    let width = 0;
                    for (const char of whitespace) {
                        width += char === "\t" ? 2 : 1;
                    }
                    indentStyle = `--indent-width: ${width}ch`;
                }
            }
            attrs["style"] = indentStyle;

            // Apply line decoration for background/border/language indicator/indent guides
            builder.add(line.from, line.from, Decoration.line({
                class: cls,
                attributes: attrs
            }));

            // Hide the marker lines (first and last) when the cursor is not inside
            if (!cursorInside) {
                if (line.number === firstLine.number || line.number === lastLine.number) {
                    builder.add(line.from, line.to, Decoration.replace({}));
                }
            }

            if (pos >= line.to && pos >= to) break;
            pos = line.to + 1;
        }
    }

    return builder.finish();
}
