import { ViewPlugin, Decoration, DecorationSet, EditorView, ViewUpdate } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

const tagDecoration = Decoration.mark({ class: "cm-hashtag" });

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

            for (let { from, to } of view.visibleRanges) {
                const text = view.state.doc.sliceString(from, to);
                // Regex matches tags like #tag, #complex-tag_123, avoiding inside URLs
                const regex = /(?:^|\s)(#[a-zA-Z0-9_\-]+)/g;
                let match;

                while ((match = regex.exec(text)) !== null) {
                    const offset = match[0].indexOf(match[1]);
                    const matchStart = from + match.index + offset;
                    const matchEnd = matchStart + match[1].length;
                    builder.add(matchStart, matchEnd, tagDecoration);
                }
            }

            return builder.finish();
        }
    }, {
        decorations: v => v.decorations
    });
};
