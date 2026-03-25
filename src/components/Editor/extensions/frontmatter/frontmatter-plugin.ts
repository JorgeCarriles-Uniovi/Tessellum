import { Decoration, DecorationSet, EditorView } from "@codemirror/view";
import { Extension, RangeSetBuilder, StateField, Transaction, Text } from "@codemirror/state";
import { parseFrontmatter } from "./frontmatter-parser";
import { FrontmatterWidget } from "./frontmatter-widget";
import { markdownPreviewForceHideFacet } from "../markdown-preview-plugin";

type FrontmatterDecorationsState = {
    decorations: DecorationSet;
    forceHide: boolean;
};

function buildDecorations(doc: Text, forceHide: boolean): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const block = parseFrontmatter(doc);

    if (block) {
        const widget = new FrontmatterWidget(block, forceHide);

        builder.add(
            block.from,
            block.to,
            Decoration.replace({
                widget,
                block: true, // This allows the decoration to span line breaks
                inclusive: false
            })
        );
    }

    return builder.finish();
}

const frontmatterDecorations = StateField.define<FrontmatterDecorationsState>({
    create(state) {
        const forceHide = state.facet(markdownPreviewForceHideFacet);
        return { decorations: buildDecorations(state.doc, forceHide), forceHide };
    },
    update(decorations, tr: Transaction) {
        const nextForceHide = tr.state.facet(markdownPreviewForceHideFacet);
        if (tr.docChanged || nextForceHide !== decorations.forceHide) {
            return { decorations: buildDecorations(tr.state.doc, nextForceHide), forceHide: nextForceHide };
        }
        return decorations;
    },
    provide: (f) => EditorView.decorations.from(f, (value) => value.decorations)
});

export function createFrontmatterPlugin(): Extension {
    return [
        frontmatterDecorations
    ];
}
