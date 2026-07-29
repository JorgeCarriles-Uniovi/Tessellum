import { describe, expect, test } from "vitest";
import { getMediaKind } from "./media-embed-plugin";

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
