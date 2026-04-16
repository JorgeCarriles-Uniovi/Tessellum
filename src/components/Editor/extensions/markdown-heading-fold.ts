import { EditorState, RangeSetBuilder, type Extension } from "@codemirror/state";
import {
    codeFolding,
    foldState,
    foldService,
    syntaxTree,
    unfoldEffect,
    foldEffect,
} from "@codemirror/language";
import {
    Decoration,
    EditorView,
    ViewPlugin,
    type DecorationSet,
    type ViewUpdate,
    WidgetType,
} from "@codemirror/view";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ChevronRight } from "lucide-react";

const HEADING_NODE_RE = /^ATXHeading([1-6])$/;
const HEADING_FOLD_COLUMN_WIDTH = "1.5rem";
const HEADING_FOLD_MARKER_OFFSET = `-${HEADING_FOLD_COLUMN_WIDTH}`;

function getTopLevelMarkdownHeadingLevel(state: EditorState, lineNumber: number): number | null {
    const line = state.doc.line(lineNumber);
    let node: ReturnType<typeof syntaxTree>["topNode"] | null = syntaxTree(state).resolveInner(line.from, 1);

    while (node) {
        const match = node.name.match(HEADING_NODE_RE);
        if (match) {
            return node.parent?.name === "Document" ? Number(match[1]) : null;
        }
        node = node.parent;
    }

    return null;
}

function getFoldEndLineNumber(state: EditorState, startLineNumber: number, startLevel: number): number {
    for (let lineNumber = startLineNumber + 1; lineNumber <= state.doc.lines; lineNumber++) {
        const level = getTopLevelMarkdownHeadingLevel(state, lineNumber);
        if (level !== null && level <= startLevel) {
            return lineNumber - 1;
        }
    }

    return state.doc.lines;
}

function getMarkdownHeadingFoldRange(state: EditorState, lineStart: number) {
    const line = state.doc.lineAt(lineStart);
    const level = getTopLevelMarkdownHeadingLevel(state, line.number);

    if (level === null) {
        return null;
    }

    const endLineNumber = getFoldEndLineNumber(state, line.number, level);
    const endLine = state.doc.line(endLineNumber);

    if (endLine.to <= line.to) {
        return null;
    }

    return {
        from: line.to,
        to: endLine.to,
    };
}

function isHeadingFolded(state: EditorState, foldRange: { from: number; to: number }): boolean {
    let folded = false;

    state.field(foldState, false)?.between(foldRange.from, foldRange.to, (from, to) => {
        if (from === foldRange.from && to === foldRange.to) {
            folded = true;
        }
    });

    return folded;
}

class HeadingFoldWidget extends WidgetType {
    private iconRoot: Root | null = null;

    constructor(
        private readonly foldRange: { from: number; to: number },
        private readonly isFolded: boolean
    ) {
        super();
    }

    eq(other: HeadingFoldWidget): boolean {
        return (
            other.foldRange.from === this.foldRange.from &&
            other.foldRange.to === this.foldRange.to &&
            other.isFolded === this.isFolded
        );
    }

    private applyButtonState(button: HTMLButtonElement): void {
        button.classList.toggle("is-expanded", !this.isFolded);
        button.setAttribute("aria-expanded", (!this.isFolded).toString());
        button.setAttribute("aria-label", this.isFolded ? "Expand heading" : "Collapse heading");
    }

    private attachToggleHandler(button: HTMLButtonElement, view: EditorView): void {
        button.onclick = (event) => {
            event.preventDefault();

            // Toggle visual state immediately so the chevron transition is perceptible.
            const isExpanded = button.classList.contains("is-expanded");
            const nextExpanded = !isExpanded;
            button.classList.toggle("is-expanded", nextExpanded);
            button.setAttribute("aria-expanded", String(nextExpanded));
            button.setAttribute("aria-label", nextExpanded ? "Collapse heading" : "Expand heading");

            const effect = isExpanded ? foldEffect.of(this.foldRange) : unfoldEffect.of(this.foldRange);
            view.dispatch({ effects: effect });
        };
    }

    toDOM(view: EditorView): HTMLElement {
        const marker = document.createElement("span");
        marker.className = "cm-heading-fold-marker";
        marker.style.left = HEADING_FOLD_MARKER_OFFSET;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "cm-heading-fold-toggle";
        this.applyButtonState(button);

        const iconContainer = document.createElement("span");
        iconContainer.className = "cm-heading-fold-icon";
        this.iconRoot = createRoot(iconContainer);
        this.iconRoot.render(
            createElement(ChevronRight, {
                size: 14,
                strokeWidth: 2,
                "aria-hidden": true,
            })
        );
        button.appendChild(iconContainer);

        this.attachToggleHandler(button, view);
        marker.appendChild(button);
        return marker;
    }

    updateDOM(dom: HTMLElement, view: EditorView): boolean {
        const button = dom.querySelector(".cm-heading-fold-toggle");
        if (!(button instanceof HTMLButtonElement)) {
            return false;
        }

        this.applyButtonState(button);
        this.attachToggleHandler(button, view);
        return true;
    }

    destroy(): void {
        const iconRoot = this.iconRoot;
        this.iconRoot = null;
        if (iconRoot) {
            // Defer unmount to avoid React warning when CodeMirror tears down during a render pass.
            setTimeout(() => iconRoot.unmount(), 0);
        }
    }

    ignoreEvent(): boolean {
        return false;
    }
}

function buildHeadingFoldDecorations(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();

    for (let lineNumber = 1; lineNumber <= view.state.doc.lines; lineNumber++) {
        const line = view.state.doc.line(lineNumber);
        const foldRange = getMarkdownHeadingFoldRange(view.state, line.from);

        if (!foldRange) {
            continue;
        }

        const isFolded = isHeadingFolded(view.state, foldRange);
        builder.add(
            line.from,
            line.from,
            Decoration.line({ class: "cm-heading-fold-line" })
        );
        builder.add(
            line.from,
            line.from,
            Decoration.widget({
                widget: new HeadingFoldWidget(foldRange, isFolded),
                side: 0,
            })
        );
    }

    return builder.finish();
}

const headingFoldWidgetTheme = EditorView.baseTheme({
    ".cm-heading-fold-line": {
        position: "relative",
        overflow: "visible",
    },
    ".cm-heading-fold-marker": {
        position: "absolute",
        top: "50%",
        transform: "translateY(-50%)",
        pointerEvents: "none",
    },
    ".cm-heading-fold-toggle": {
        border: "none",
        background: "transparent",
        color: "var(--color-text-muted)",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "1rem",
        height: "1rem",
        margin: "0",
        padding: "0",
        pointerEvents: "auto",
        transition: "color 200ms ease-in-out",
    },
    ".cm-heading-fold-icon": {
        display: "inline-flex",
        lineHeight: 0,
        transition: "transform 200ms ease-in-out",
        transform: "rotate(-90deg)",
        willChange: "transform",
    },
    ".cm-heading-fold-toggle.is-expanded .cm-heading-fold-icon": {
        transform: "rotate(0deg)",
    },
    ".cm-heading-fold-icon svg": {
        width: "0.875rem",
        height: "0.875rem",
    },
    ".cm-heading-fold-toggle:hover": {
        color: "var(--color-text-primary)",
    },
    ":root[data-reduced-motion='true'] .cm-heading-fold-toggle": {
        transition: "none",
    },
    ":root[data-reduced-motion='true'] .cm-heading-fold-icon": {
        transition: "none",
    },
    "@media (prefers-reduced-motion: reduce)": {
        ".cm-heading-fold-toggle": {
            transition: "none",
        },
        ".cm-heading-fold-icon": {
            transition: "none",
        },
    },
});

const headingFoldWidgetPlugin = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
            this.decorations = buildHeadingFoldDecorations(view);
        }

        update(update: ViewUpdate) {
            if (update.docChanged || update.viewportChanged || update.selectionSet || update.transactions.length > 0) {
                this.decorations = buildHeadingFoldDecorations(update.view);
            }
        }
    },
    {
        decorations: (value) => value.decorations,
    }
);

export const markdownHeadingFoldExtension: Extension = [
    codeFolding(),
    foldService.of((state, lineStart) => getMarkdownHeadingFoldRange(state, lineStart)),
    headingFoldWidgetTheme,
    headingFoldWidgetPlugin,
];