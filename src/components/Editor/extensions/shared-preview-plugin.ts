import { EditorState, RangeSetBuilder } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import { markdownPreviewForceHideFacet } from "./markdown-preview-plugin";

export interface PreviewRange {
    start: number;
    end: number;
    block: boolean;
}

interface SelectableRange {
    start: number;
    end: number;
}

interface PreviewSelection {
    anchor: number;
    head: number;
}

export interface PreviewWidgetFactory<TRange extends PreviewRange> {
    createWidget: (range: TRange) => WidgetType;
    createFocusedWidget?: (range: TRange) => WidgetType;
    isFocused?: (state: EditorState, range: TRange) => boolean;
}

export function buildPreviewDecorations<TRange extends PreviewRange>(
    state: EditorState,
    ranges: readonly TRange[],
    factory: PreviewWidgetFactory<TRange>
): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const selection = state.selection.main;
    const forceHide = state.facet(markdownPreviewForceHideFacet);

    for (const range of ranges) {
        const startLine = state.doc.lineAt(range.start);
        const endLine = state.doc.lineAt(range.end);
        const isFocused = factory.isFocused
            ? factory.isFocused(state, range)
            : selection.from <= endLine.to && selection.to >= startLine.from;

        if (!isFocused || forceHide) {
            builder.add(
                range.start,
                range.end,
                Decoration.replace({
                    widget: factory.createWidget(range),
                    block: range.block,
                })
            );
            continue;
        }

        if (range.block && factory.createFocusedWidget) {
            builder.add(
                endLine.to,
                endLine.to,
                Decoration.widget({
                    widget: factory.createFocusedWidget(range),
                    block: true,
                    side: 1,
                })
            );
        }
    }

    return builder.finish();
}

export function createPreviewClickHandler<TRange extends SelectableRange>(
    selector: string,
    getRanges: (state: EditorState) => readonly TRange[],
    getSelection?: (range: TRange) => PreviewSelection
) {
    return EditorView.domEventHandlers({
        mousedown(event, view) {
            const target = event.target as HTMLElement;
            const previewElement = target.closest(selector);

            if (!previewElement) {
                return false;
            }

            event.preventDefault();
            event.stopPropagation();

            const wrapper = previewElement.parentElement;
            if (!wrapper) {
                return true;
            }

            const pos = view.posAtDOM(wrapper);
            if (pos === null) {
                return true;
            }

            const match = getRanges(view.state).find(
                (range) => pos >= range.start && pos < range.end
            );

            if (!match) {
                return true;
            }

            const selection = getSelection
                ? getSelection(match)
                : { anchor: match.start, head: match.end };

            view.dispatch({ selection });
            view.focus();
            return true;
        },
    });
}
