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
 * Policy applied to the fenced ```html block's `srcdoc` iframe only
 * (`HtmlBlockWidget` below). It is NOT applied to the other two
 * embedded-HTML surfaces — the standalone `.html`/`.htm` viewer
 * (`HtmlFilePreview.tsx`) or the `![[page.html]]` embed
 * (`media-embed-plugin.ts`) — see "Why not the other two surfaces" below.
 *
 * `sandbox=""` blocks script execution but NOT subresource fetches, so an
 * `<img src="https://tracker/<id>.png">` in an untrusted document still fires a
 * real request on open — leaking the reader's IP, the time of reading, and
 * which note, in an app that is otherwise fully offline. This confines embedded
 * documents to local subresources.
 *
 * This `srcdoc` frame is confined on every engine via two redundant paths:
 * - The `csp` attribute (CSP Embedded Enforcement), which Blink enforces
 *   natively.
 * - An inline `<meta http-equiv="Content-Security-Policy">` prepended to the
 *   document itself (`buildEmbeddedHtmlSrcDoc` below) — a mechanism every
 *   engine honours, including WKWebView (macOS) and WebKitGTK (Linux), which
 *   ignore the `csp` attribute entirely.
 * `srcdoc` is same-origin/local-scheme content, which CSPEE exempts from its
 * blocking behaviour, so carrying both is safe here.
 *
 * Why not the other two surfaces: `HtmlFilePreview.tsx` and
 * `media-embed-plugin.ts` load an existing document by `asset://` URL rather
 * than via `srcdoc`, so there is no meta-tag option available to them. The
 * `csp` attribute was tried there and had to be reverted — per the CSPEE
 * spec, when a framed response is not a local scheme and neither sends an
 * `Allow-CSP-From` header nor delivers a CSP at least as strong as the
 * required one, Blink (including WebView2 on Windows) blocks the response
 * outright rather than merely dropping enforcement. Tauri's asset protocol
 * sends neither header, so every `asset://` frame carrying the attribute was
 * refused with:
 *
 *   Refused to display '...' in a frame. The embedder requires it to enforce
 *   the following Content Security Policy: '...'. However, the frame neither
 *   accepts that policy using the Allow-CSP-From header nor delivers a
 *   Content Security Policy which is at least as strong as that one.
 *
 * So those two frames currently carry NO subresource confinement — they rely
 * on `sandbox=""` for script blocking only, and an embedded remote `<img>`
 * will still fire a request on open. The attribute must not be re-added to
 * them without also adding a real CSP response header on the asset protocol
 * (a Tauri-level change); dropping the attribute is not itself a fix for the
 * underlying leak, only for the regression it caused.
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
