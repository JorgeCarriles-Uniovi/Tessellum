import {
    Decoration,
    DecorationSet,
    EditorView,
    WidgetType,
} from "@codemirror/view";
import { StateField, EditorState, Extension, RangeSetBuilder } from "@codemirror/state";
import katex from "katex";
import { findLatexExpressions } from "./shared-latex-utils";

// ─── Widget ───────────────────────────────────────────────────────────────────

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

        dom.style.pointerEvents = "none";

        const clickOverlay = document.createElement("div");
        clickOverlay.style.position = "absolute";
        clickOverlay.style.inset = "0";
        clickOverlay.style.pointerEvents = "auto";
        clickOverlay.style.cursor = "pointer";
        clickOverlay.style.zIndex = "1";

        clickOverlay.addEventListener("mousedown", (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            view.dispatch({
                selection: { anchor: this.startPos, head: this.endPos },
            });
            view.focus();
        });

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
                output: "html",
            });
        } catch {
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

// ─── Decoration Builder ───────────────────────────────────────────────────────

function buildMathDecorations(state: EditorState) {
    const builder = new RangeSetBuilder<Decoration>();
    const selection = state.selection.main;
    const docText = state.doc.toString();

    const matches = findLatexExpressions(docText);

    for (const m of matches) {
        const cursorOverlap =
            selection.from >= m.start && selection.to <= m.end;

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

// ─── CM6 StateField + Click Handler ───────────────────────────────────────────

const mathStateField = StateField.define<DecorationSet>({
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

const mathClickHandlerExtension = EditorView.domEventHandlers({
    mousedown(event, view) {
        const target = event.target as HTMLElement;
        const latexElement = target.closest(".cm-math-block, .cm-math-inline");

        if (latexElement) {
            event.preventDefault();
            event.stopPropagation();

            const wrapper = latexElement.parentElement;
            if (wrapper) {
                const pos = view.posAtDOM(wrapper);
                if (pos !== null) {
                    const docText = view.state.doc.toString();
                    const matches = findLatexExpressions(docText);
                    const match = matches.find(
                        (m) => pos >= m.start && pos < m.end
                    );

                    if (match) {
                        view.dispatch({
                            selection: {
                                anchor: match.start,
                                head: match.end,
                            },
                        });
                        view.focus();
                    }
                }
            }

            return true;
        }

        return false;
    },
});

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Creates a CM6 extension that renders LaTeX math expressions using KaTeX.
 * Supports both inline ($...$) and block ($$...$$) math.
 * Hides the raw syntax when the cursor is not on the expression.
 */
export function createMathPlugin(): Extension {
    return [mathStateField, mathClickHandlerExtension];
}