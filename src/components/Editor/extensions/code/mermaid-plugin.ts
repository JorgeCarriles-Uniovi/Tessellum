import {
    Decoration,
    DecorationSet,
    EditorView,
    WidgetType,
} from "@codemirror/view";
import { StateField, Extension, RangeSetBuilder, EditorState } from "@codemirror/state";
import mermaid from "mermaid";
import panzoom from "panzoom";
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
        wrapper.className = "cm-mermaid-block group relative flex justify-center my-4 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 rounded-md overflow-visible bg-gray-50 dark:bg-gray-800/50";
        wrapper.style.minHeight = "150px";

        // Determine theme based on html class (Tailwind dark mode typically uses .dark)
        const isDark = document.documentElement.classList.contains("dark");
        mermaid.initialize({
            startOnLoad: false,
            theme: isDark ? "dark" : "default",
        });

        const container = document.createElement("div");
        container.style.width = "100%";
        container.style.height = "100%";
        container.style.display = "flex";
        container.style.justifyContent = "center";
        container.style.alignItems = "center";
        container.style.overflow = "hidden"; // To restrict panzoom to container bounds
        container.style.borderRadius = "inherit"; // Respect wrapper's rounded corners

        // Edit button
        const editButton = document.createElement("div");
        editButton.className = "cm-codeblock-badge opacity-0 group-hover:opacity-100 z-10";
        editButton.textContent = "mermaid";

        const tooltip = document.createElement("div");
        tooltip.className = "cm-codeblock-tooltip";
        tooltip.textContent = "Edit Source";
        editButton.appendChild(tooltip);

        editButton.addEventListener("mousedown", (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            view.dispatch({
                selection: { anchor: this.startPos, head: this.endPos },
            });
            view.focus();
        });

        // Fallback double click to edit
        wrapper.addEventListener("dblclick", (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            view.dispatch({
                selection: { anchor: this.startPos, head: this.endPos },
            });
            view.focus();
        });

        wrapper.appendChild(editButton);
        wrapper.appendChild(container);

        // Render mermaid
        mermaid.render(this.id, this.code).then(({ svg }) => {
            container.innerHTML = svg;
            const svgElement = container.querySelector("svg");
            if (svgElement) {
                // Initialize panzoom
                panzoom(svgElement, {
                    maxZoom: 15,
                    minZoom: 0.1,
                    bounds: true,
                    boundsPadding: 0.1,
                });
            }
        }).catch((err) => {
            container.innerHTML = `<div style="color: red; border: 1px solid red; padding: 10px; border-radius: 4px; background: rgba(255,0,0,0.1);">Mermaid Error: ${err.message || err}</div>`;
        });

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
