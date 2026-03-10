import {
    Decoration,
    DecorationSet,
    EditorView,
    WidgetType,
} from "@codemirror/view";
import { StateField, Extension, RangeSetBuilder, EditorState } from "@codemirror/state";
import mermaid from "mermaid";
import { parseCodeBlocks } from "./code-parser";

let mermaidIdCounter = 0;

class MermaidWidget extends WidgetType {
    private id: string;

    constructor(
        readonly code: string,
        readonly startPos: number,
        readonly endPos: number
    ) {
        super();
        this.id = `mermaid-${++mermaidIdCounter}`;
    }

    eq(other: MermaidWidget) {
        return this.code === other.code && this.startPos === other.startPos;
    }

    toDOM(view: EditorView) {
        const wrapper = document.createElement("div");
        wrapper.className = "cm-mermaid-block";
        wrapper.style.display = "flex";
        wrapper.style.justifyContent = "center";
        wrapper.style.position = "relative";
        wrapper.style.margin = "1rem 0";
        wrapper.style.cursor = "pointer";

        // Determine theme based on html class (Tailwind dark mode typically uses .dark)
        const isDark = document.documentElement.classList.contains("dark");
        mermaid.initialize({
            startOnLoad: false,
            theme: isDark ? "dark" : "default",
        });

        // Click overlay to allow editing
        const clickOverlay = document.createElement("div");
        clickOverlay.style.position = "absolute";
        clickOverlay.style.inset = "0";
        clickOverlay.style.pointerEvents = "auto";
        clickOverlay.style.zIndex = "1";

        clickOverlay.addEventListener("mousedown", (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            view.dispatch({
                selection: { anchor: this.startPos, head: this.endPos },
            });
            view.focus();
        });

        const container = document.createElement("div");

        // Render mermaid
        mermaid.render(this.id, this.code).then(({ svg }) => {
            container.innerHTML = svg;
        }).catch((err) => {
            container.innerHTML = `<div style="color: red; border: 1px solid red; padding: 10px; border-radius: 4px; background: rgba(255,0,0,0.1);">Mermaid Error: ${err.message || err}</div>`;
        });

        wrapper.appendChild(container);
        wrapper.appendChild(clickOverlay);

        return wrapper;
    }

    ignoreEvent(): boolean {
        return true;
    }
}

function buildMermaidDecorations(state: EditorState) {
    const builder = new RangeSetBuilder<Decoration>();
    const selection = state.selection.main;
    const blocks = parseCodeBlocks(state);

    // CodeBlocks returned by parseCodeBlocks are sorted by `from` natively by the syntaxTree.
    for (const block of blocks) {
        if (block.language === "mermaid") {
            const cursorOverlap = selection.from >= block.from && selection.to <= block.to;
            if (!cursorOverlap) {
                const firstLine = state.doc.lineAt(block.from);
                const lastLine = state.doc.lineAt(block.to);
                const contentStart = firstLine.to + 1;
                const contentEnd = lastLine.from - 1;

                if (contentEnd > contentStart) {
                    const codeContent = state.doc.sliceString(contentStart, contentEnd).trim();
                    if (codeContent) {
                        builder.add(
                            block.from,
                            block.to,
                            Decoration.replace({
                                widget: new MermaidWidget(codeContent, block.from, block.to),
                                block: true,
                            })
                        );
                    }
                }
            }
        }
    }
    return builder.finish();
}

const mermaidStateField = StateField.define<DecorationSet>({
    create(state) {
        return buildMermaidDecorations(state);
    },
    update(oldState, transaction) {
        if (transaction.docChanged || transaction.selection) {
            return buildMermaidDecorations(transaction.state);
        }
        return oldState;
    },
    provide: (field) => EditorView.decorations.from(field),
});

export function createMermaidPlugin(): Extension {
    return [mermaidStateField];
}
