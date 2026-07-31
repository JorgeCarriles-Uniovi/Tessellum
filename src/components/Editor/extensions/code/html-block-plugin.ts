import {
    Decoration,
    DecorationSet,
    EditorView,
    WidgetType,
} from "@codemirror/view";
import { EditorState, Extension, RangeSetBuilder, StateField } from "@codemirror/state";
import { parseCodeBlocks } from "./code-parser";

const HTML_BLOCK_LANGUAGES = ["html", "htm"];

function renderHtmlBlockError(container: HTMLElement): void {
    container.innerHTML = "";
    const errorDiv = document.createElement("div");
    errorDiv.style.color = "var(--color-alert-text)";
    errorDiv.style.border = "1px solid var(--color-alert-border)";
    errorDiv.style.padding = "10px";
    errorDiv.style.borderRadius = "4px";
    errorDiv.style.background = "var(--color-alert-bg)";
    errorDiv.textContent = "Couldn't render HTML";
    container.appendChild(errorDiv);
}

class HtmlBlockWidget extends WidgetType {
    constructor(
        readonly code: string,
        readonly startPos: number,
        readonly endPos: number,
    ) {
        super();
    }

    eq(other: HtmlBlockWidget) {
        return this.code === other.code && this.startPos === other.startPos;
    }

    toDOM(view: EditorView) {
        const wrapper = document.createElement("div");
        wrapper.className = "cm-html-block group relative my-4 border rounded-md overflow-hidden";
        wrapper.style.backgroundColor = "var(--color-panel-footer)";
        wrapper.style.borderColor = "var(--color-panel-border)";

        const container = document.createElement("div");
        container.style.width = "100%";

        const badge = document.createElement("div");
        badge.className = "cm-codeblock-badge opacity-0 group-hover:opacity-100 z-10";
        badge.textContent = "html";

        const tooltip = document.createElement("div");
        tooltip.className = "cm-codeblock-tooltip";
        tooltip.textContent = "Edit Source";
        badge.appendChild(tooltip);

        const selectSource = (event: Event) => {
            event.preventDefault();
            event.stopPropagation();
            view.dispatch({ selection: { anchor: this.startPos, head: this.endPos } });
            view.focus();
        };
        badge.addEventListener("mousedown", selectSource);
        wrapper.addEventListener("dblclick", selectSource);

        const frame = document.createElement("iframe");
        frame.className = "cm-html-frame";
        // Empty sandbox: all restrictions on, so inline <script> never runs.
        frame.setAttribute("sandbox", "");
        frame.srcdoc = this.code;
        frame.title = "HTML preview";
        frame.style.width = "100%";
        frame.style.height = "320px";
        frame.style.border = "none";
        frame.addEventListener("error", () => renderHtmlBlockError(container));

        container.appendChild(frame);
        wrapper.appendChild(badge);
        wrapper.appendChild(container);
        return wrapper;
    }

    ignoreEvent(): boolean {
        return true;
    }
}

/** Exported for testing. */
export function buildHtmlBlockDecorations(state: EditorState): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const selection = state.selection.main;

    for (const block of parseCodeBlocks(state)) {
        if (!HTML_BLOCK_LANGUAGES.includes(block.language)) continue;

        // Cursor inside the block -> keep raw source visible for editing.
        const cursorOverlap = selection.from >= block.from && selection.to <= block.to;
        if (cursorOverlap) continue;

        const firstLine = state.doc.lineAt(block.from);
        const lastLine = state.doc.lineAt(block.to);
        const contentStart = firstLine.to + 1;
        const contentEnd = lastLine.from - 1;
        if (contentEnd <= contentStart) continue;

        const code = state.doc.sliceString(contentStart, contentEnd).trim();
        if (!code) continue;

        builder.add(
            block.from,
            block.to,
            Decoration.replace({
                widget: new HtmlBlockWidget(code, block.from, block.to),
                block: true,
            }),
        );
    }

    return builder.finish();
}

const htmlBlockStateField = StateField.define<DecorationSet>({
    create(state) {
        return buildHtmlBlockDecorations(state);
    },
    update(oldState, transaction) {
        if (transaction.docChanged || transaction.selection) {
            return buildHtmlBlockDecorations(transaction.state);
        }
        return oldState;
    },
    provide: (field) => EditorView.decorations.from(field),
});

export function createHtmlBlockPlugin(): Extension {
    return [htmlBlockStateField];
}
