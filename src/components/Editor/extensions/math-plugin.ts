import {
    DecorationSet,
    EditorView,
    WidgetType,
} from "@codemirror/view";
import { StateField, EditorState, Extension } from "@codemirror/state";
import katex from "katex";
import { findLatexExpressions } from "./shared-latex-utils";
import { markdownPreviewForceHideFacet } from "./markdown-preview-plugin";
import { buildPreviewDecorations, createPreviewClickHandler } from "./shared-preview-plugin";

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

    toDOM() {
        const dom = document.createElement(this.isBlock ? "div" : "span");
        dom.className = this.isBlock ? "cm-math-block" : "cm-math-inline";
        dom.classList.add(this.isBlock ? "latex" : "latex-inline");

        if (this.isBlock) {
            dom.style.display = "flex";
            dom.style.justifyContent = "center";
        }

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

        return wrapper;
    }

    ignoreEvent(): boolean {
        return true;
    }
}

type MathPreviewRange = {
    start: number;
    end: number;
    formula: string;
    isBlock: boolean;
    block: boolean;
};

function getMathPreviewRanges(docText: string): MathPreviewRange[] {
    return findLatexExpressions(docText).map((range) => ({
        ...range,
        block: range.isBlock,
    }));
}

// ─── Decoration Builder ───────────────────────────────────────────────────────

function buildMathDecorations(state: EditorState) {
    return buildPreviewDecorations(state, getMathPreviewRanges(state.doc.toString()), {
        createWidget: (range) => new MathWidget(range.formula, range.isBlock, range.start, range.end),
        createFocusedWidget: (range) => new MathWidget(range.formula, true, range.start, range.end),
    });
}

// ─── CM6 StateField + Click Handler ───────────────────────────────────────────

type MathDecorationsState = {
    decorations: DecorationSet;
    forceHide: boolean;
};

const mathStateField = StateField.define<MathDecorationsState>({
    create(state) {
        const forceHide = state.facet(markdownPreviewForceHideFacet);
        return { decorations: buildMathDecorations(state), forceHide };
    },
    update(oldState, transaction) {
        const nextForceHide = transaction.state.facet(markdownPreviewForceHideFacet);
        if (transaction.docChanged || transaction.selection || nextForceHide !== oldState.forceHide) {
            return { decorations: buildMathDecorations(transaction.state), forceHide: nextForceHide };
        }
        return oldState;
    },
    provide: (field) => EditorView.decorations.from(field, (value) => value.decorations),
});

const mathClickHandlerExtension = createPreviewClickHandler(
    ".cm-math-block, .cm-math-inline",
    (state) => findLatexExpressions(state.doc.toString())
);

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Creates a CM6 extension that renders LaTeX math expressions using KaTeX.
 * Supports both inline ($...$) and block ($$...$$) math.
 * Hides the raw syntax when the cursor is not on the expression.
 */
export function createMathPlugin(): Extension {
    return [mathStateField, mathClickHandlerExtension];
}
