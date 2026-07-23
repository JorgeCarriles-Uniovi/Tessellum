import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TessellumApp } from "../../plugins/TessellumApp";
import { EditorHeader } from "./Editor";
import type { FileMetadata } from "../../types";

function resetAppSingleton() {
    (TessellumApp as unknown as { _instance: TessellumApp | null })._instance = null;
}

function createFile(path: string): FileMetadata {
    return {
        path,
        filename: path.split("/").at(-1) ?? path,
        is_dir: false,
        size: 1,
        last_modified: 1_700_000_000,
    };
}

const noop = () => {};

function baseProps(
    app: TessellumApp,
    overrides: Partial<{ activeNote: FileMetadata; activeNoteContent: string }> = {}
) {
    return {
        title: "Note",
        onTitleChange: noop,
        onTitleBlur: noop,
        editedAt: "",
        lastModified: 1_700_000_000,
        titleFontSizePx: 28,
        readOnly: false,
        spellCheck: false,
        spellCheckLanguage: "en",
        t: (key: string) => key,
        locale: "en",
        isHistoryOpen: false,
        onHistoryToggle: noop,
        activeNote: createFile("vault/Note.md"),
        activeNoteContent: "Body content here",
        app,
        ...overrides,
    };
}

describe("EditorHeader v2 additions", () => {
    beforeEach(() => {
        resetAppSingleton();
    });

    test("renders no kicker when frontmatter has no type field", () => {
        const app = TessellumApp.create();
        vi.spyOn(app.workspace, "getBacklinks").mockResolvedValue([]);

        render(<EditorHeader {...baseProps(app, { activeNoteContent: "# Title\nJust a body, no frontmatter." })} />);

        expect(screen.queryByTestId("editor-header-kicker")).not.toBeInTheDocument();
    });

    test("renders a kicker from frontmatter type", () => {
        const app = TessellumApp.create();
        vi.spyOn(app.workspace, "getBacklinks").mockResolvedValue([]);

        render(
            <EditorHeader
                {...baseProps(app, {
                    activeNoteContent: "---\ntype: Literature note\n---\n# Body",
                })}
            />
        );

        expect(screen.getByTestId("editor-header-kicker")).toHaveTextContent("Literature note");
    });

    test("shows reading time computed from the active note content", () => {
        const app = TessellumApp.create();
        vi.spyOn(app.workspace, "getBacklinks").mockResolvedValue([]);
        const words = Array(400).fill("word").join(" ");

        render(<EditorHeader {...baseProps(app, { activeNoteContent: words })} />);

        expect(screen.getByText("2 min read")).toBeInTheDocument();
    });

    test("shows the backlink count once the lookup resolves", async () => {
        const app = TessellumApp.create();
        vi.spyOn(app.workspace, "getBacklinks").mockResolvedValue(["a.md", "b.md"]);

        render(<EditorHeader {...baseProps(app)} />);

        await waitFor(() => expect(screen.getByText("2 backlinks")).toBeInTheDocument());
    });

    test("omits the backlink count while the lookup is still pending", () => {
        const app = TessellumApp.create();
        vi.spyOn(app.workspace, "getBacklinks").mockReturnValue(new Promise(() => {}));

        render(<EditorHeader {...baseProps(app)} />);

        expect(screen.queryByText(/backlinks/)).not.toBeInTheDocument();
    });
});
