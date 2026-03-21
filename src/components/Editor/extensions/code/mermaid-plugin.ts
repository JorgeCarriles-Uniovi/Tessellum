import {
    Decoration,
    DecorationSet,
    EditorView,
    ViewPlugin,
    WidgetType,
} from "@codemirror/view";
import { StateField, Extension, RangeSetBuilder, EditorState, StateEffect } from "@codemirror/state";
import mermaid from "mermaid";
import panzoom from "panzoom";
import { parseCodeBlocks } from "./code-parser";

let mermaidIdCounter = 0;
const mermaidThemeEffect = StateEffect.define<null>();
const mermaidViews = new Set<EditorView>();

class MermaidWidget extends WidgetType {
    private id: string;
    private panzoomInstance?: any;

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
        wrapper.className = "cm-mermaid-block group relative flex justify-center my-4 border rounded-md overflow-visible";
        wrapper.style.minHeight = "150px";
        wrapper.style.backgroundColor = "var(--color-panel-footer)";
        wrapper.style.borderColor = "var(--color-panel-border)";

        const container = document.createElement("div");
        container.style.width = "100%";
        container.style.height = "100%";
        container.style.display = "flex";
        container.style.justifyContent = "center";
        container.style.alignItems = "center";
        container.style.overflow = "hidden";
        container.style.borderRadius = "inherit";

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
                this.panzoomInstance = panzoom(svgElement, {
                    maxZoom: 15,
                    minZoom: 0.1,
                    bounds: true,
                    boundsPadding: 0.1,
                });
            }
        }).catch((err) => {
            container.innerHTML = "";
            const errorDiv = document.createElement("div");
            errorDiv.style.color = "var(--color-alert-text)";
            errorDiv.style.border = "1px solid var(--color-alert-border)";
            errorDiv.style.padding = "10px";
            errorDiv.style.borderRadius = "4px";
            errorDiv.style.background = "var(--color-alert-bg)";
            errorDiv.textContent = `Mermaid Error: ${err.message || err}`;
            container.appendChild(errorDiv);
        });

        return wrapper;
    }

    destroy(_dom: HTMLElement) {
        if (this.panzoomInstance) {
            this.panzoomInstance.dispose();
            this.panzoomInstance = undefined;
        }

        // Mermaid injects a style block with id `<mermaidId>`
        const styleElement = document.getElementById(this.id);
        if (styleElement && styleElement.tagName.toLowerCase() === 'style') {
            styleElement.remove();
        }
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
        const themeChanged = transaction.effects.some((effect) => effect.is(mermaidThemeEffect));
        if (transaction.docChanged || transaction.selection || themeChanged) {
            return buildMermaidDecorations(transaction.state);
        }
        return oldState;
    },
    provide: (field) => EditorView.decorations.from(field),
});

let mermaidInitialized = false;
let mermaidObserverInitialized = false;

const mermaidViewPlugin = ViewPlugin.fromClass(class {
    private view: EditorView;

    constructor(view: EditorView) {
        this.view = view;
        mermaidViews.add(view);
    }

    destroy() {
        mermaidViews.delete(this.view);
    }
});

function notifyMermaidThemeChanged() {
    mermaidViews.forEach((view) => {
        view.dispatch({ effects: mermaidThemeEffect.of(null) });
    });
}

export function createMermaidPlugin(): Extension {
    if (!mermaidInitialized && typeof document !== "undefined") {
        mermaidInitialized = true;

        const updateMermaidTheme = () => {
            const isDark = document.documentElement.classList.contains("dark");
            mermaid.initialize({
                startOnLoad: false,
                theme: isDark ? "dark" : "default",
            });
            notifyMermaidThemeChanged();
        };

        updateMermaidTheme();

        if (!mermaidObserverInitialized) {
            mermaidObserverInitialized = true;
            const observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    if (mutation.attributeName === "class" || mutation.attributeName === "data-theme-name") {
                        updateMermaidTheme();
                    }
                }
            });

            observer.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ["class", "data-theme-name"],
            });
        }
    }

    return [mermaidStateField, mermaidViewPlugin];
}
