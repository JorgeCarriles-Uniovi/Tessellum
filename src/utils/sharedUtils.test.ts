import { describe, expect, test } from "vitest";
import { invokeMock } from "../test/tauriMocks";
import { ensureMarkdownExtension, getNameWithoutExtension, getParentFromTarget, getParentPath } from "./pathUtils";
import { buildNoteMetadata, createNoteFromTemplateInDir, createNoteInDir, getFilenameFromPath } from "./noteUtils";
import { getFileExtension, isImageFile, isMediaFile, isPdfFile } from "./fileType";
import { parseOutline } from "./outline";
import { getIgnoredTagLineNumbers, stripInlineCodeSpansForTagScan } from "./tagExtraction";

describe("shared utilities", () => {
    test("handles path and filename helpers across files and folders", () => {
        expect(getParentPath("Inbox/Note.md")).toBe("Inbox");
        expect(getParentPath("Inbox\\Note.md")).toBe("Inbox");
        expect(getParentPath("Note.md")).toBe("");

        expect(getParentFromTarget({
            path: "Inbox/Note.md",
            filename: "Note.md",
            is_dir: false,
            size: 1,
            last_modified: 1,
        })).toBe("Inbox");
        expect(getParentFromTarget({
            path: "Inbox",
            filename: "Inbox",
            is_dir: true,
            size: 0,
            last_modified: 1,
        })).toBe("Inbox");

        expect(getNameWithoutExtension("Note.md", false)).toBe("Note");
        expect(getNameWithoutExtension("Inbox", true)).toBe("Inbox");
        expect(ensureMarkdownExtension("note", false)).toBe("note.md");
        expect(ensureMarkdownExtension("note.MD", false)).toBe("note.MD");
        expect(ensureMarkdownExtension("Inbox", true)).toBe("Inbox");
    });

    test("builds note metadata from returned paths and supports tauri create helpers", async () => {
        expect(getFilenameFromPath("Inbox\\Nested\\Note.md")).toBe("Note.md");
        expect(getFilenameFromPath("")).toBeNull();

        const metadata = buildNoteMetadata("Inbox/Note.md", "Fallback.md");
        expect(metadata.path).toBe("Inbox/Note.md");
        expect(metadata.filename).toBe("Note.md");
        expect(metadata.is_dir).toBe(false);

        invokeMock.mockResolvedValueOnce("Inbox/New.md");
        await expect(createNoteInDir("Inbox", "New")).resolves.toMatchObject({
            path: "Inbox/New.md",
            filename: "New.md",
        });

        invokeMock.mockResolvedValueOnce("Inbox/Template.md");
        await expect(
            createNoteFromTemplateInDir("Vault", "Inbox", "Templates/base.md", "Template"),
        ).resolves.toMatchObject({
            path: "Inbox/Template.md",
            filename: "Template.md",
        });
    });

    test("detects image, pdf, and media file types", () => {
        expect(getFileExtension("Sketch.PNG")).toBe("png");
        expect(isImageFile("Sketch.PNG")).toBe(true);
        expect(isPdfFile("Manual.pdf")).toBe(true);
        expect(isMediaFile("Manual.pdf")).toBe(true);
        expect(isMediaFile("notes.md")).toBe(false);
    });

    test("parses markdown outline headings while ignoring fenced code headings", () => {
        expect(parseOutline([
            "# One",
            "```md",
            "## Hidden",
            "```",
            "## Two",
            "### Three ###",
        ].join("\n"))).toEqual([
            { title: "One", level: 1, kind: "markdown", lineNumber: 1 },
            { title: "Two", level: 2, kind: "markdown", lineNumber: 5 },
            { title: "Three", level: 3, kind: "markdown", lineNumber: 6 },
        ]);
    });

    test("strips inline code spans and ignores fenced or quoted tag lines", () => {
        expect(stripInlineCodeSpansForTagScan("Before `#tag` after")).toBe("Before        after");
        expect(stripInlineCodeSpansForTagScan("Use ``#tag`` literal")).toBe("Use          literal");

        expect([...getIgnoredTagLineNumbers([
            "# visible",
            "> # quoted",
            "```ts",
            "# hidden",
            "```",
            "final",
        ].join("\n"))]).toEqual([2, 3, 4, 5]);
    });
});
