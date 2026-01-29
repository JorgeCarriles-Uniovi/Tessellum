// math-plugin.ts
import {
    Decoration,
    DecorationSet,
    EditorView,
    WidgetType,
} from "@codemirror/view";
import { StateField, EditorState, RangeSetBuilder } from "@codemirror/state";
import katex from "katex";
import { findLatexExpressions } from "../utils/shared-latex-utils";

class MathWidget extends WidgetType {
    constructor(
        readonly formula: string,
        readonly isBlock: boolean,
        readonly startPos: number,
        readonly endPos: number
    ) {
        super();
    }

    eq(other: MathWidget) {
        return (
            this.formula === other.formula &&
            this.isBlock === other.isBlock &&
            this.startPos === other.startPos
        );
    }

    toDOM(view: EditorView) {
        const dom = document.createElement(this.isBlock ? "div" : "span");
        dom.className = this.isBlock ? "cm-math-block" : "cm-math-inline";
        dom.classList.add(this.isBlock ? "latex" : "latex-inline");

        if (this.isBlock) {
            dom.style.display = "flex";
            dom.style.justifyContent = "center";
        }

        // Make the widget non-clickable at the CSS level
        dom.style.pointerEvents = "none";

        // Create an overlay that captures clicks
        const clickOverlay = document.createElement("div");
        clickOverlay.style.position = "absolute";
        clickOverlay.style.inset = "0";
        clickOverlay.style.pointerEvents = "auto";
        clickOverlay.style.cursor = "pointer";
        clickOverlay.style.zIndex = "1";

        clickOverlay.addEventListener('mousedown', (e: Event) => {
            e.preventDefault();
            e.stopPropagation();

            // Select the entire LaTeX block
            view.dispatch({
                selection: { anchor: this.startPos, head: this.endPos },
            });
            view.focus();
        });

        // Wrapper for positioning
        const wrapper = document.createElement(this.isBlock ? "div" : "span");
        wrapper.style.position = "relative";
        if (this.isBlock) {
            wrapper.style.display = "flex";
            wrapper.style.justifyContent = "center";
        }

        try {
            katex.render(this.formula, dom, {
                displayMode: this.isBlock,
                throwOnError: false,
                macros: { "\\f": "#1f(#2)" },
                output: "html"
            });
        } catch (e) {
            dom.innerText = this.formula;
        }

        wrapper.appendChild(dom);
        wrapper.appendChild(clickOverlay);

        return wrapper;
    }

    ignoreEvent(): boolean {
        return true;
    }
}

function buildMathDecorations(state: EditorState) {
    const builder = new RangeSetBuilder<Decoration>();
    const selection = state.selection.main;
    const docText = state.doc.toString();

    const matches = findLatexExpressions(docText);

    for (const m of matches) {
        const cursorOverlap = selection.from >= m.start && selection.to <= m.end;

        if (!cursorOverlap) {
            builder.add(
                m.start,
                m.end,
                Decoration.replace({
                    widget: new MathWidget(m.formula, m.isBlock, m.start, m.end),
                    block: m.isBlock,
                })
            );
        }
    }

    return builder.finish();
}

export const mathPlugin = StateField.define<DecorationSet>({
    create(state) {
        return buildMathDecorations(state);
    },
    update(oldState, transaction) {
        if (transaction.docChanged || transaction.selection) {
            return buildMathDecorations(transaction.state);
        }
        return oldState;
    },
    provide: (field) => EditorView.decorations.from(field),
});

export const mathClickHandler = EditorView.domEventHandlers({
    mousedown(event, view) {
        const target = event.target as HTMLElement;

        // Check if we clicked on or inside a LaTeX widget
        const latexElement = target.closest('.cm-math-block, .cm-math-inline');

        if (latexElement) {
            // Prevent CodeMirror from handling this click
            event.preventDefault();
            event.stopPropagation();

            // Get the position from the widget
            const wrapper = latexElement.parentElement;
            if (wrapper) {
                // Find which decoration this corresponds to
                const pos = view.posAtDOM(wrapper);
                if (pos !== null) {
                    const docText = view.state.doc.toString();
                    const matches = findLatexExpressions(docText);
                    const match = matches.find(m => pos >= m.start && pos < m.end);

                    if (match) {
                        view.dispatch({
                            selection: { anchor: match.start, head: match.end },
                        });
                        view.focus();
                    }
                }
            }

            return true; // Prevent CodeMirror from processing
        }

        return false; // Let CodeMirror handle other clicks
    }
});