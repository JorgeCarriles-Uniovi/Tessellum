import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { describe, expect, test } from "vitest";
import { buildHtmlBlockDecorations } from "./html-block-plugin";

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
});
