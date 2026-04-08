import { Extension, RangeSetBuilder, StateField } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { Decoration, DecorationSet, EditorView } from "@codemirror/view";
import { markdownPreviewForceHideFacet } from "../markdown-preview-plugin";

interface InlineCodeRange {
    start: number;
    end: number;
}

function findInlineCodeRanges(state: EditorView["state"]): InlineCodeRange[] {
    const ranges: InlineCodeRange[] = [];

    syntaxTree(state).iterate({
        enter(node) {
            if (node.name !== "InlineCode") {
                return;
            }

            ranges.push({
                start: node.from,
                end: node.to,
            });
        },
    });

    return ranges;
}

function isInlineCodeFocused(state: EditorView["state"], range: InlineCodeRange): boolean {
    const selection = state.selection.main;
    return selection.from < range.end && selection.to > range.start;
}

function buildInlineCodeDecorations(state: EditorView["state"]): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const forceHide = state.facet(markdownPreviewForceHideFacet);

    for (const range of findInlineCodeRanges(state)) {
        // Keep inline code editable by styling the real text instead of replacing it.
        if (forceHide || !isInlineCodeFocused(state, range)) {
            builder.add(
                range.start,
                range.end,
                Decoration.mark({
                    class: "cm-inline-code-render",
                })
            );
        }
    }

    return builder.finish();
}

const inlineCodeStateField = StateField.define<DecorationSet>({
    create(state) {
        return buildInlineCodeDecorations(state);
    },
    update(decorations, transaction) {
        const forceHideChanged =
            transaction.startState.facet(markdownPreviewForceHideFacet) !==
            transaction.state.facet(markdownPreviewForceHideFacet);

        if (transaction.docChanged || transaction.selection || forceHideChanged) {
            return buildInlineCodeDecorations(transaction.state);
        }

        return decorations;
    },
    provide: (field) => EditorView.decorations.from(field),
});

export function createInlineCodePlugin(): Extension {
    return [inlineCodeStateField];
}