import { Decoration, DecorationSet, EditorView } from "@codemirror/view";
import { Extension, RangeSetBuilder, StateField, Transaction, Text } from "@codemirror/state";
import { parseFrontmatter } from "./frontmatter-parser";
import { FrontmatterWidget } from "./frontmatter-widget";

function buildDecorations(doc: Text): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const block = parseFrontmatter(doc);

    if (block) {
        const widget = new FrontmatterWidget(block);

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

const frontmatterDecorations = StateField.define<DecorationSet>({
    create(state) {
        return buildDecorations(state.doc);
    },
    update(decorations, tr: Transaction) {
        if (tr.docChanged) {
            return buildDecorations(tr.state.doc);
        }
        return decorations;
    },
    provide: (f) => EditorView.decorations.from(f)
});

export function createFrontmatterPlugin(): Extension {
    return [
        frontmatterDecorations
    ];
}
