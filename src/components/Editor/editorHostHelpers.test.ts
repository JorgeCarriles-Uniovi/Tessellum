import { EditorState } from "@codemirror/state";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
    buildContentPreview,
    buildShortPath,
    buildTabsFromPaths,
    createTableMarkdown,
    formatRelativeTime,
    getPrimaryAction,
    normalizeTimestampSeconds,
    parseFrontmatterTags,
} from "./editorViewHelpers";
import { canTriggerSlash, getSlashContext } from "./hooks/slashCommandLogic";
import { getWikiLinkContext } from "./hooks/wikiLinkSuggestionsLogic";

function createWikiState(lineText: string) {
    return {
        doc: {
            lineAt: () => ({ from: 0, text: lineText }),
        },
        selection: {
            main: { from: lineText.length },
        },
    };
}

describe("editor host helpers", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-04-29T12:00:00Z"));
    });

    test("builds previews from frontmatter tags and stripped markdown content", () => {
        const preview = buildContentPreview(
            [
                "---",
                "tags:",
                "  - alpha",
                "  - beta",
                "---",
                "# Heading",
                "",
                "- item",
                "Paragraph with **bold** and [link](https://example.com).",
            ].join("\n"),
            "Empty preview",
        );

        expect(preview.tags).toEqual(["alpha", "beta"]);
        expect(preview.contentPreview).toBe("Heading item Paragraph with bold and link.");
    });

    test("falls back to the empty preview text when markdown collapses to nothing", () => {
        const preview = buildContentPreview("> \n***\n", "Empty preview");

        expect(preview).toEqual({
            contentPreview: "Empty preview",
            tags: [],
        });
    });

    test("parses inline, scalar, and block tag formats", () => {
        expect(parseFrontmatterTags('tags: ["one", "two"]')).toEqual(["one", "two"]);
        expect(parseFrontmatterTags("tags: single")).toEqual(["single"]);
        expect(parseFrontmatterTags("tags:\n  - first\n  - second")).toEqual(["first", "second"]);
    });

    test("shortens long paths and keeps short ones intact", () => {
        expect(buildShortPath("Vault/Projects/2026/Q2/Plan.md")).toBe("2026 / Q2 / Plan.md");
        expect(buildShortPath("Vault/Note.md")).toBe("Vault / Note.md");
    });

    test("normalizes timestamp precision and formats relative time boundaries", () => {
        const nowMs = new Date("2026-04-29T12:00:00Z").getTime();
        const fiveMinutesAgo = Math.floor((nowMs - 5 * 60 * 1000) / 1000);

        expect(normalizeTimestampSeconds(nowMs)).toBe(Math.floor(nowMs / 1000));
        expect(formatRelativeTime(Math.floor(nowMs / 1000), "en")).toBe("this minute");
        expect(formatRelativeTime(fiveMinutesAgo, "en")).toBe("5 minutes ago");
    });

    test("creates table markdown and chooses the correct empty-state primary action", () => {
        const table = createTableMarkdown(2, 3);

        expect(table.insertText).toContain("| Header 1 | Header 2 | Header 3 |");
        expect(table.insertText.trim().split("\n")).toHaveLength(4);
        expect(table.selectionOffset).toBeGreaterThan(0);

        const newNote = { id: "new-note" } as never;
        const openVault = { id: "open-vault" } as never;

        expect(getPrimaryAction("vault", newNote, openVault)).toBe(newNote);
        expect(getPrimaryAction(null, newNote, openVault)).toBe(openVault);
    });

    test("builds tab objects from open paths and preserves fallback names", () => {
        expect(
            buildTabsFromPaths(
                ["vault/Note.md", "vault/missing/Loose.md"],
                [{ path: "vault/Note.md", filename: "Note.md", is_dir: false, size: 1, last_modified: 1 }],
            ),
        ).toEqual([
            { id: "vault/Note.md", title: "Note.md", path: "vault/Note.md" },
            { id: "vault/missing/Loose.md", title: "Loose.md", path: "vault/missing/Loose.md" },
        ]);
    });

    test("finds slash command context only for valid trigger positions", () => {
        const state = EditorState.create({ doc: "Alpha /head" });
        const slashContext = getSlashContext(state, state.doc.length);

        expect(slashContext).toEqual({
            queryText: "head",
            absoluteSlashPos: 6,
        });

        const invalidState = EditorState.create({ doc: "Alpha /two words" });
        expect(getSlashContext(invalidState, invalidState.doc.length)).toBeNull();

        expect(canTriggerSlash(EditorState.create({ doc: "" }), 0)).toBe(true);
        expect(canTriggerSlash(EditorState.create({ doc: "a/" }), 2)).toBe(false);
        expect(canTriggerSlash(EditorState.create({ doc: " /\n" }), 1)).toBe(true);
    });

    test("extracts wikilink context for simple, aliased, and invalid branches", () => {
        expect(getWikiLinkContext(createWikiState("[[Target"), 8)).toEqual({
            queryText: "Target",
            aliasText: "",
            hasAlias: false,
            bracketPos: 0,
        });

        expect(getWikiLinkContext(createWikiState("[[Target|Alias"), 14)).toEqual({
            queryText: "Target",
            aliasText: "Alias",
            hasAlias: true,
            bracketPos: 0,
        });

        expect(getWikiLinkContext(createWikiState("\\[[Escaped"), 10)).toBeNull();
        expect(getWikiLinkContext(createWikiState("[[Closed]] tail"), 14)).toBeNull();
    });
});
