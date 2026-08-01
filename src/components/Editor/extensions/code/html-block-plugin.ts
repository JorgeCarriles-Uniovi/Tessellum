import {
    Decoration,
    DecorationSet,
    EditorView,
    WidgetType,
} from "@codemirror/view";
import { EditorState, Extension, RangeSetBuilder, StateField } from "@codemirror/state";
import { parseCodeBlocks } from "./code-parser";

const HTML_BLOCK_LANGUAGES = ["html", "htm"];

/**
 * Policy applied to every embedded-HTML surface (fenced ```html blocks, the
 * standalone .html viewer, and ![[page.html]] embeds).
 *
 * `sandbox=""` blocks script execution but NOT subresource fetches, so an
 * `<img src="https://tracker/<id>.png">` in an untrusted document still fires a
 * real request on open — leaking the reader's IP, the time of reading, and
 * which note, in an app that is otherwise fully offline. This confines embedded
 * documents to local subresources.
 *
 * Enforcement differs by engine and by surface:
 * - The `csp` attribute (CSP Embedded Enforcement) is implemented in Blink
 *   only. WKWebView (macOS) and WebKitGTK (Linux) ignore it entirely, so on
 *   those engines a frame relying solely on the attribute would silently fall
 *   back to inheriting the *embedder's* CSP (`app.security.csp` in
 *   `tauri.conf.json`), which is far more permissive than this policy.
 * - The `srcdoc` frame below closes that gap by also carrying this policy as
 *   an inline `<meta http-equiv="Content-Security-Policy">` in the document
 *   itself — a mechanism every engine honours — so that frame is confined on
 *   Blink, WebKitGTK, and WKWebView alike.
 * - The two `asset://`-loaded frames (`HtmlFilePreview.tsx`,
 *   `media-embed-plugin.ts`) load an existing document by URL rather than via
 *   `srcdoc`, so there is no equivalent meta-tag option: they still depend on
 *   the Blink-only `csp` attribute alone and remain defense-in-depth pending a
 *   Tauri-level response header, tracked separately.
 */
export const EMBEDDED_HTML_CSP =
    "default-src 'none'; img-src data: blob: asset: https://asset.localhost http://asset.localhost; style-src 'unsafe-inline' data: asset:; font-src data: asset:; media-src data: blob: asset:";

/**
 * Prepend the embedded-HTML policy as an inline meta tag so the `srcdoc`
 * frame is confined on every rendering engine, not just Blink (see
 * `EMBEDDED_HTML_CSP` above). Placed first so the parser sees it before any
 * of the user's own markup. `EMBEDDED_HTML_CSP` contains no `"` characters,
 * so it can be embedded directly into the `content` attribute without
 * escaping; the user's HTML is appended verbatim afterward, unmodified.
 *
 * Exported for testing.
 */
export function buildEmbeddedHtmlSrcDoc(html: string): string {
    return `<meta http-equiv="Content-Security-Policy" content="${EMBEDDED_HTML_CSP}">${html}`;
}

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
        // ...and no network reach, so a note-borne beacon cannot fire on open.
        // The `csp` attribute alone only takes effect on Blink; the srcdoc
        // string also carries the policy as a <meta> tag so WebKitGTK and
        // WKWebView enforce it too (see EMBEDDED_HTML_CSP's docstring).
        frame.setAttribute("csp", EMBEDDED_HTML_CSP);
        frame.srcdoc = buildEmbeddedHtmlSrcDoc(this.code);
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
