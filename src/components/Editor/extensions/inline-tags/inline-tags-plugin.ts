import { ViewPlugin, Decoration, DecorationSet, EditorView, ViewUpdate } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { stringToColor } from "../../../../utils/graphUtils";
import { getIgnoredTagLineNumbers, stripInlineCodeSpansForTagScan } from "../../../../utils/tagExtraction";

export const inlineTagsPlugin = () => {
    return ViewPlugin.fromClass(class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
            this.decorations = this.buildDecorations(view);
        }

        update(update: ViewUpdate) {
            if (update.docChanged || update.viewportChanged) {
                this.decorations = this.buildDecorations(update.view);
            }
        }

        buildDecorations(view: EditorView): DecorationSet {
            const builder = new RangeSetBuilder<Decoration>();
            const ignoredLines = getIgnoredTagLineNumbers(view.state.doc.toString());

            for (const { from, to } of view.visibleRanges) {
                let line = view.state.doc.lineAt(from);

                while (line.from <= to) {
                    if (!ignoredLines.has(line.number)) {
                        // Regex matches tags like #tag and #parent/child.
                        const regex = /(?:^|\s)(#[a-zA-Z0-9_\-/]+)/g;
                        const scanLine = stripInlineCodeSpansForTagScan(line.text);
                        let match: RegExpExecArray | null;

                        while ((match = regex.exec(scanLine)) !== null) {
                            const offset = match[0].indexOf(match[1]);
                            const matchStart = line.from + match.index + offset;
                            const matchEnd = matchStart + match[1].length;

                            const tagName = match[1].substring(1); // remove '#'
                            const { h } = stringToColor(tagName);
                            const deco = Decoration.mark({
                                class: "cm-hashtag",
                                attributes: {
                                    style: `background-color: hsla(${h}, 70%, 60%, 0.15) !important; color: hsl(${h}, 70%, 50%) !important; border: 1px solid hsla(${h}, 70%, 60%, 0.3) !important;`
                                }
                            });

                            builder.add(matchStart, matchEnd, deco);
                        }
                    }

                    if (line.to >= to) {
                        break;
                    }
                    line = view.state.doc.line(line.number + 1);
                }
            }

            return builder.finish();
        }
    }, {
        decorations: v => v.decorations
    });
};
