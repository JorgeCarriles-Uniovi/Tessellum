import {
    Decoration,
    DecorationSet,
    EditorView,
    WidgetType,
} from "@codemirror/view";
import { StateField, EditorState, RangeSetBuilder } from "@codemirror/state";
import katex from "katex";

// 1. The Math Widget (Visual Render)
class MathWidget extends WidgetType {
    constructor(
        readonly formula: string,
        readonly isBlock: boolean,
        readonly pos: number // Add position parameter
    ) {
        super();
    }

    eq(other: MathWidget) {
        return (
            this.formula === other.formula &&
            this.isBlock === other.isBlock &&
            this.pos === other.pos
        );
    }

    toDOM() {
        const dom = document.createElement(this.isBlock ? "div" : "span");
        dom.className = this.isBlock ? "cm-math-block" : "cm-math-inline";

        // Add the latex class for the click handler to detect
        dom.classList.add(this.isBlock ? "latex" : "latex-inline");

        // CRITICAL: Store the position for the click handler
        dom.setAttribute("data-pos", this.pos.toString());

        if (this.isBlock) {
            dom.style.display = "flex";
            dom.style.justifyContent = "center";
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
        return dom;
    }

    ignoreEvent() {
        return false;
    }
}

// 2. The Logic
function buildMathDecorations(state: EditorState) {
    const builder = new RangeSetBuilder<Decoration>();
    const selection = state.selection.main;
    const docText = state.doc.toString();

    // We need to collect ALL matches first, then sort them.
    const matches: { start: number, end: number, formula: string, isBlock: boolean }[] = [];

    // Regex Definitions
    const blockRegex = /\$\$([\s\S]*?)\$\$/g;
    const inlineRegex = /\$((?:[^\$\n]|\\[\s\S])+)\$/g;

    let match;

    // 1. Find all Block Math
    while ((match = blockRegex.exec(docText)) !== null) {
        matches.push({
            start: match.index,
            end: match.index + match[0].length,
            formula: match[1],
            isBlock: true
        });
    }

    // 2. Find all Inline Math
    while ((match = inlineRegex.exec(docText)) !== null) {
        matches.push({
            start: match.index,
            end: match.index + match[0].length,
            formula: match[1],
            isBlock: false
        });
    }

    // 3. SORT matches by position (Crucial Step to fix the crash)
    matches.sort((a, b) => a.start - b.start);

    // 4. Add to builder (filtering overlaps)
    let lastIndex = 0;

    for (const m of matches) {
        // Skip if this match overlaps with a previous one (e.g. inline inside block)
        if (m.start < lastIndex) continue;

        // Check if cursor is inside this specific match
        const cursorOverlap = selection.from >= m.start && selection.to <= m.end;

        if (!cursorOverlap) {
            builder.add(
                m.start,
                m.end,
                Decoration.replace({
                    widget: new MathWidget(m.formula, m.isBlock, m.start), // Pass position
                    block: m.isBlock, // Important for layout
                })
            );
        }

        lastIndex = m.end;
    }

    return builder.finish();
}

// 3. The StateField Definition
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