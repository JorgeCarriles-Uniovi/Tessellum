import { describe, expect, test } from "vitest";
import { getMediaKind, MediaEmbedWidget } from "./media-embed-plugin";

/** Minimal stand-in for EditorView: toDOM only touches it inside event handlers. */
const stubView = { dispatch: () => {}, focus: () => {} } as never;

describe("getMediaKind", () => {
    test("detects pdf regardless of the html gate", () => {
        expect(getMediaKind("note/doc.pdf", false)).toBe("pdf");
    });

    test("detects image regardless of the html gate", () => {
        expect(getMediaKind("note/photo.png", false)).toBe("image");
    });

    test("detects html when the gate is on", () => {
        expect(getMediaKind("note/page.html", true)).toBe("html");
    });

    test("recognizes the htm extension when the gate is on", () => {
        expect(getMediaKind("note/page.htm", true)).toBe("html");
    });

    test("falls back to unknown for html when the gate is off", () => {
        expect(getMediaKind("note/page.html", false)).toBe("unknown");
    });

    test("leaves unrelated extensions unaffected by the gate", () => {
        expect(getMediaKind("note/unknown.xyz", true)).toBe("unknown");
    });
});

describe("MediaEmbedWidget html rendering", () => {
    test("an html embed renders a fully sandboxed, network-confined iframe", () => {
        const widget = new MediaEmbedWidget(
            "html",
            "asset://vault/page.html",
            undefined,
            "page.html",
            "ok",
        );

        const frame = widget.toDOM(stubView).querySelector("iframe")!;

        expect(frame).not.toBeNull();
        expect(frame.getAttribute("src")).toBe("asset://vault/page.html");
        // Empty sandbox === every restriction on, notably no script execution.
        expect(frame.getAttribute("sandbox")).toBe("");
        // Regression guard: the `csp` attribute must NOT be set on this
        // asset://-loaded frame. CSPEE causes Blink (WebView2) to block the
        // response outright when neither an Allow-CSP-From header nor a
        // subsuming CSP is present, which Tauri's asset protocol never sends.
        expect(frame.getAttribute("csp")).toBeNull();
    });

    test("a pdf embed is not treated as html and carries no sandbox claim", () => {
        const widget = new MediaEmbedWidget(
            "pdf",
            "asset://vault/spec.pdf",
            undefined,
            "spec.pdf",
            "ok",
        );

        const frame = widget.toDOM(stubView).querySelector("iframe")!;

        expect(frame.className).toBe("cm-media-pdf");
        expect(frame.getAttribute("sandbox")).toBeNull();
    });
});
