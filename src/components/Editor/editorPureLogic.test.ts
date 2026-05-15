import { markdown } from "@codemirror/lang-markdown";
import { EditorState, Text } from "@codemirror/state";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { parseCalloutBlocks } from "./extensions/callout/callout-parser";
import { parseCodeBlocks } from "./extensions/code/code-parser";
import { parseFrontmatter, stringifyFrontmatter } from "./extensions/frontmatter/frontmatter-parser";
import { findLatexExpressions } from "./extensions/shared-latex-utils";
import { splitRow, parseInlineMarkdown, parseTables } from "./extensions/table/table-parser";
import { findTaskListItems, getToggledTaskMarker } from "./extensions/task-list/task-list-parser";
import { findWikiLinks, parseWikiLink } from "./extensions/wikilink/wikiLink-parser";
import { loadCodeLanguagesForLocale, getCachedCodeLanguages } from "./hooks/codeLanguagesLoader";
import { buildEditorExtensionOrder } from "./hooks/editorExtensionOrder";
import { buildEditorExtensions } from "./hooks/editorExtensionsBuilder";
import {
    getEditorExtensionPluginIds,
    getInitialExtensionPluginIds,
    isSourceModeEnabled,
} from "./hooks/sourceModeExtensions";
import {
    applyListFormatting,
    applyMarkdownShortcut,
    getInlineMarkdownActions,
    getMarkdownMarker,
    matchesMarkdownShortcut,
    matchesTabNavigationShortcut,
    toggleMarkdownWrap,
} from "./utils/markdownShortcuts";

function createTextView(text: string) {
    const doc = Text.of(text.split("\n"));
    return {
        state: { doc },
        visibleRanges: [{ from: 0, to: doc.length }],
    } as never;
}

function createTableDoc(text: string) {
    const doc = Text.of(text.split("\n"));
    return {
        lines: doc.lines,
        line: (lineNumber: number) => doc.line(lineNumber),
        lineAt: (pos: number) => doc.lineAt(pos),
    };
}

function createListView(text: string, from = 0, to = text.length) {
    const doc = Text.of(text.split("\n"));
    return {
        state: {
            doc,
            selection: {
                main: {
                    from,
                    to,
                },
            },
        },
        dispatch: vi.fn(),
    } as never;
}

describe("editor pure logic", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    test("filters source mode plugin ids and keeps non-source modes untouched", () => {
        const pluginIds = ["markdown-preview", "custom", "wikilink", "table"];

        expect(getEditorExtensionPluginIds("live", pluginIds)).toEqual(pluginIds);
        expect(getEditorExtensionPluginIds("source", pluginIds)).toEqual(["custom"]);
        expect(getInitialExtensionPluginIds("source", pluginIds)).toEqual(["custom"]);
        expect(isSourceModeEnabled({})).toBe(true);
        expect(isSourceModeEnabled({ disabled: true })).toBe(false);
    });

    test("orders vim and plugin extensions after the base editor stack", () => {
        const ordered = buildEditorExtensionOrder({
            baseExtensions: ["base-a" as never, "base-b" as never],
            pluginExtensions: ["plugin-a" as never, "plugin-b" as never],
            vimMode: true,
            vimExtension: "vim" as never,
        });
        const noVim = buildEditorExtensionOrder({
            baseExtensions: ["base-a" as never],
            pluginExtensions: ["plugin-a" as never],
            vimMode: false,
            vimExtension: "vim" as never,
        });

        expect(ordered).toEqual(["base-a", "base-b", "vim", "plugin-a", "plugin-b"]);
        expect(noVim).toEqual(["base-a", "plugin-a"]);
    });

    test("builds editor extensions with optional line numbers and vim support", () => {
        const noExtras = buildEditorExtensions({
            pluginExtensions: ["plugin" as never],
            vimMode: false,
            lineNumbers: false,
            codeLanguages: [],
            vimExtension: "vim" as never,
        });
        const withExtras = buildEditorExtensions({
            pluginExtensions: ["plugin" as never],
            vimMode: true,
            lineNumbers: true,
            codeLanguages: [],
            vimExtension: "vim" as never,
        });

        expect(noExtras.at(-1)).toBe("plugin");
        expect(withExtras.at(-2)).toBe("vim");
        expect(withExtras.at(-1)).toBe("plugin");
        expect(withExtras.length).toBe(noExtras.length + 2);
    });

    test("caches code language bundles per locale and resolves English as the default branch", async () => {
        expect(getCachedCodeLanguages("en")).toBeNull();
        expect(getCachedCodeLanguages("es")).toBeNull();

        const firstEnglishLoad = loadCodeLanguagesForLocale("en");
        const secondEnglishLoad = loadCodeLanguagesForLocale("en");
        const firstSpanishLoad = loadCodeLanguagesForLocale("es");
        const [english, englishAgain, spanish] = await Promise.all([
            firstEnglishLoad,
            secondEnglishLoad,
            firstSpanishLoad,
        ]);

        expect(english.length).toBeGreaterThan(0);
        expect(englishAgain).toBe(english);
        expect(spanish.length).toBeGreaterThan(0);
        expect(getCachedCodeLanguages("en")).toBe(english);
        expect(getCachedCodeLanguages("es")).toBe(spanish);
    });

    test("wraps, unwraps, and collapses markdown selections correctly", () => {
        expect(getMarkdownMarker("bold")).toBe("**");
        expect(getInlineMarkdownActions()).toEqual([
            { id: "bold", label: "Bold" },
            { id: "italic", label: "Italic" },
            { id: "strikethrough", label: "Strike" },
        ]);

        expect(toggleMarkdownWrap("hello", { from: 1, to: 4 }, "**")).toEqual({
            text: "h**ell**o",
            selection: { anchor: 3, head: 6 },
        });
        expect(toggleMarkdownWrap("h**ell**o", { from: 3, to: 6 }, "**")).toEqual({
            text: "hello",
            selection: { anchor: 1, head: 4 },
        });
        expect(toggleMarkdownWrap("hello", { from: 2, to: 2 }, "*")).toEqual({
            text: "he**llo",
            selection: { anchor: 3, head: 3 },
        });
    });

    test("matches markdown and tab shortcuts only for valid modifier combinations", () => {
        expect(matchesTabNavigationShortcut({ key: "Tab", ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, "next")).toBe(true);
        expect(matchesTabNavigationShortcut({ key: "Tab", ctrlKey: false, metaKey: true, shiftKey: true, altKey: false }, "previous")).toBe(true);
        expect(matchesTabNavigationShortcut({ key: "Tab", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }, "next")).toBe(false);
        expect(matchesMarkdownShortcut({ key: "b", ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, "bold")).toBe(true);
        expect(matchesMarkdownShortcut({ key: "I", ctrlKey: false, metaKey: true, shiftKey: false, altKey: false }, "italic")).toBe(true);
        expect(matchesMarkdownShortcut({ key: "b", ctrlKey: true, metaKey: false, shiftKey: true, altKey: false }, "bold")).toBe(false);
    });

    test("applies markdown shortcuts and list formatting through the editor view contract", () => {
        const shortcutView = {
            state: {
                doc: {
                    toString: () => "hello",
                    length: 5,
                },
                selection: {
                    main: {
                        from: 1,
                        to: 4,
                    },
                },
            },
            dispatch: vi.fn(),
        } as never;

        expect(applyMarkdownShortcut(null, "**")).toBe(false);
        expect(applyMarkdownShortcut(shortcutView, "**")).toBe(true);
        expect(shortcutView.dispatch).toHaveBeenCalledWith({
            changes: {
                from: 0,
                to: 5,
                insert: "h**ell**o",
            },
            selection: {
                anchor: 3,
                head: 6,
            },
        });

        const numberedListView = createListView("one\ntwo", 0, 7);
        expect(applyListFormatting(numberedListView, "numbered")).toBe(true);
        expect(numberedListView.dispatch).toHaveBeenCalledWith({
            changes: [
                { from: 0, to: 0, insert: "1. " },
                { from: 4, to: 4, insert: "2. " },
            ],
        });

        const removeTodoView = createListView("- [ ] first\n- [x] second", 0, 24);
        expect(applyListFormatting(removeTodoView, "todo")).toBe(true);
        expect(removeTodoView.dispatch).toHaveBeenCalledWith({
            changes: [
                { from: 0, to: 6, insert: "" },
                { from: 12, to: 18, insert: "" },
            ],
        });
    });

    test("parses callout blocks across headers and continuation lines", () => {
        const view = createTextView("> [!warning]- Custom title\n> line one\n>\nplain\n> [!note]");
        const blocks = parseCalloutBlocks(view);

        expect(blocks).toHaveLength(2);
        expect(blocks[0]).toMatchObject({
            type: "warning",
            title: "Custom title",
            foldChar: "-",
            contentLines: ["line one", ""],
            hasContent: true,
        });
        expect(blocks[1]).toMatchObject({
            type: "note",
            title: expect.any(String),
            hasContent: false,
        });
    });

    test("finds task list markers with normalized offsets and toggles compact markers", () => {
        const items = findTaskListItems("  - [ ] first\r\n- [x] second\n- [ ]");

        expect(items).toEqual([
            expect.objectContaining({
                markerStart: 2,
                markerEnd: 7,
                checked: false,
                lineText: "  - [ ] first",
            }),
            expect.objectContaining({
                markerStart: 14,
                markerEnd: 19,
                checked: true,
                lineText: "- [x] second",
            }),
            expect.objectContaining({
                checked: false,
                lineText: "- [ ]",
            }),
        ]);
        expect(getToggledTaskMarker("- [x]", true)).toBe("- [ ]");
        expect(getToggledTaskMarker("- [ ]", false)).toBe("- [x]");
    });

    test("parses tables, escaped cells, and inline markdown tokens", () => {
        expect(splitRow("| one | two\\|three |")).toEqual(["one", "two|three"]);

        const tableDoc = createTableDoc("| H1 | H2 |\n| :--- | ---: |\n| a | b |\n| bad |\n");
        const tables = parseTables(tableDoc, 0, 38);

        expect(tables).toEqual([
            expect.objectContaining({
                columnCount: 2,
                alignments: ["left", "right"],
                dataRows: ["| a | b |"],
            }),
        ]);

        const fragment = parseInlineMarkdown("Hi **bold _inner_** and [link](https://example.com) with `code`");
        const wrapper = document.createElement("div");
        wrapper.appendChild(fragment);

        expect(wrapper.querySelector("strong")?.textContent).toBe("bold inner");
        expect(wrapper.querySelector("em")?.textContent).toBe("inner");
        expect(wrapper.querySelector("a")?.getAttribute("href")).toBe("https://example.com");
        expect(wrapper.querySelector("code")?.textContent).toBe("code");
    });

    test("parses wikilinks and ignores escaped, embedded, and inline-code variants", () => {
        expect(parseWikiLink("[[Folder/Note| Alias ]]")).toEqual({
            target: "Folder/Note",
            alias: "Alias",
            aliasOffset: 15,
        });

        const view = createTextView(String.raw`[[A]] \[[B]] ![[C]] \`[[D]]\` [[Folder/E| Alias ]]`);
        const matches = findWikiLinks(view);

        expect(matches).toEqual([
            expect.objectContaining({
                target: "A",
                fullText: "[[A]]",
            }),
            expect.objectContaining({
                target: "Folder/E",
                alias: "Alias",
            }),
        ]);
    });

    test("parses and stringifies frontmatter while rejecting incomplete blocks", () => {
        const parsed = parseFrontmatter(Text.of([
            "---",
            "title: \"Hello\"",
            "tags: [one, 'two']",
            "---",
            "body",
        ]));

        expect(parsed).toMatchObject({
            yaml: "title: \"Hello\"\ntags: [one, 'two']",
            properties: {
                title: "Hello",
                tags: ["one", "two"],
            },
        });
        expect(parseFrontmatter(Text.of(["---", "title: missing"]))).toBeNull();
        expect(stringifyFrontmatter({
            title: "Hello",
            published: true,
            tags: ["one", "two"],
        })).toBe('---\ntitle: "Hello"\npublished: true\ntags: ["one", "two"]\n---');
    });

    test("parses fenced code blocks and latex expressions across inline and block forms", () => {
        const state = EditorState.create({
            doc: "```ts\nconst a = 1;\n```\n\n```\nplain\n```",
            extensions: [markdown()],
        });

        expect(parseCodeBlocks(state)).toEqual([
            { from: 0, to: 22, language: "ts" },
            { from: 24, to: 37, language: "" },
        ]);
        expect(findLatexExpressions("Inline $x^2$ and $$y^2$$ plus $unterminated\nline").map((match) => ({
            formula: match.formula,
            isBlock: match.isBlock,
        }))).toEqual([
            { formula: "x^2", isBlock: false },
            { formula: "y^2", isBlock: true },
        ]);
    });
});
