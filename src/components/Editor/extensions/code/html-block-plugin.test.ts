import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { describe, expect, test } from "vitest";
import { buildHtmlBlockDecorations, buildEmbeddedHtmlSrcDoc, EMBEDDED_HTML_CSP } from "./html-block-plugin";

/** Minimal stand-in for EditorView: toDOM only touches it inside event handlers. */
const stubView = { dispatch: () => {}, focus: () => {} } as never;

interface WidgetLike {
    toDOM: (view: never) => HTMLElement;
}

function firstWidget(doc: string, cursor: number): WidgetLike {
    const decorations = buildHtmlBlockDecorations(stateWith(doc, cursor));
    let widget: WidgetLike | null = null;
    decorations.between(0, doc.length, (_from, _to, value) => {
        widget = (value.spec as { widget?: WidgetLike }).widget ?? null;
    });
    if (!widget) throw new Error("no html block widget was produced");
    return widget;
}

function stateWith(doc: string, cursor: number) {
    return EditorState.create({
        doc,
        extensions: [markdown()],
        selection: { anchor: cursor },
    });
}

// Block occupies positions 0..21; "After" starts at 23.
const DOC = "```html\n<p>hi</p>\n```\n\nAfter";

describe("html block plugin", () => {
    test("replaces an html fenced block with a widget when the cursor is outside it", () => {
        const decorations = buildHtmlBlockDecorations(stateWith(DOC, 26));

        expect(decorations.size).toBe(1);
    });

    test("leaves the raw source visible while the cursor is inside the block", () => {
        const decorations = buildHtmlBlockDecorations(stateWith(DOC, 10));

        expect(decorations.size).toBe(0);
    });

    test("ignores fenced blocks in other languages", () => {
        const decorations = buildHtmlBlockDecorations(
            stateWith("```ts\nconst a = 1;\n```\n\nAfter", 26),
        );

        expect(decorations.size).toBe(0);
    });

    test("ignores an html block with no content", () => {
        const decorations = buildHtmlBlockDecorations(stateWith("```html\n\n```\n\nAfter", 17));

        expect(decorations.size).toBe(0);
    });

    test("the rendered iframe is fully sandboxed and confined to local subresources", () => {
        const dom = firstWidget(DOC, 26).toDOM(stubView);
        const frame = dom.querySelector("iframe")!;

        // Empty sandbox === every restriction on, notably no script execution.
        expect(frame.getAttribute("sandbox")).toBe("");
        // And no network reach for subresources, so a note-borne beacon such as
        // <img src="https://tracker/<id>.png"> cannot fire when the note opens.
        expect(frame.getAttribute("csp")).toBe(EMBEDDED_HTML_CSP);
    });

    test("the srcdoc carries the policy as a meta tag for engines that ignore the csp attribute", () => {
        const dom = firstWidget(DOC, 26).toDOM(stubView);
        const frame = dom.querySelector("iframe")!;

        expect(frame.srcdoc).toContain(
            `<meta http-equiv="Content-Security-Policy" content="${EMBEDDED_HTML_CSP}">`
        );
        // The meta tag must come first, before any of the user's own markup.
        expect(frame.srcdoc.indexOf("<meta")).toBe(0);
        // The user's HTML must survive untouched, appended right after it.
        expect(frame.srcdoc).toContain("<p>hi</p>");
    });

    test("buildEmbeddedHtmlSrcDoc does not corrupt the user's html", () => {
        const html = "<p>hi &amp; bye</p>";
        expect(buildEmbeddedHtmlSrcDoc(html)).toBe(
            `<meta http-equiv="Content-Security-Policy" content="${EMBEDDED_HTML_CSP}">${html}`
        );
    });

    test("the embedded-html policy denies everything by default and allows no remote origin", () => {
        expect(EMBEDDED_HTML_CSP).toContain("default-src 'none'");
        expect(EMBEDDED_HTML_CSP).not.toMatch(/(^|[\s;])https:(\s|;|$)/);
        expect(EMBEDDED_HTML_CSP).not.toMatch(/(^|[\s;])http:(\s|;|$)/);
        expect(EMBEDDED_HTML_CSP).not.toContain("'unsafe-eval'");
        expect(EMBEDDED_HTML_CSP).not.toContain("script-src");
    });
});
