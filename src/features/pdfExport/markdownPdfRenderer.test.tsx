import { beforeEach, describe, expect, test } from "vitest";
import type { FileMetadata } from "../../types";
import { invokeMock } from "../../test/tauriMocks";
import { EXPORT_PAGE_HEIGHT_PX, EXPORT_TYPOGRAPHY } from "./pdfExportDomain";
import { renderMarkdownPdfDocument, sanitizeStyleText } from "./markdownPdfRenderer";

function createFile(filename: string): FileMetadata {
    return {
        path: `vault/${filename}`,
        filename,
        is_dir: false,
        size: 1,
        last_modified: 1,
    };
}

describe("markdownPdfRenderer", () => {
    beforeEach(() => {
        invokeMock.mockReset();
    });

    test("builds themed export html with fixed typography and measured outline pages", async () => {
        document.documentElement.style.setProperty("--color-bg-primary", "rgb(250, 245, 240)");
        document.documentElement.style.setProperty("--color-text-primary", "rgb(24, 24, 24)");
        document.documentElement.style.setProperty("--color-text-link", "rgb(20, 92, 160)");
        document.documentElement.style.setProperty("--color-border-light", "rgb(210, 203, 196)");
        document.documentElement.style.setProperty("--color-bg-secondary", "rgb(244, 238, 230)");
        document.documentElement.style.setProperty("--code-inline-bg", "rgb(237, 231, 223)");
        document.documentElement.style.setProperty("--code-inline-color", "rgb(115, 48, 29)");
        document.documentElement.style.setProperty("--font-sans", "Geist Sans");
        document.documentElement.style.setProperty("--font-mono", "Geist Mono");

        const result = await renderMarkdownPdfDocument(
            {
                file: createFile("Plan.md"),
                content: "# Intro\n\n## Details\nBody",
            },
            {
                measureHeadingOffsets: async () =>
                    new Map([
                        [1, 10],
                        [3, EXPORT_PAGE_HEIGHT_PX + 30],
                    ]),
            }
        );

        expect(result.documentTitle).toBe("Plan");
        expect(result.outline).toEqual([
            { title: "Intro", level: 1, lineNumber: 1, page: 1, offsetWithinPagePx: 10 },
            { title: "Details", level: 2, lineNumber: 3, page: 2, offsetWithinPagePx: 94 },
        ]);
        expect(result.html).toContain("rgb(250, 245, 240)");
        expect(result.html).toContain("Geist Sans");
        expect(result.html).toContain(`font-size: ${EXPORT_TYPOGRAPHY.bodyFontSizePx}px`);
    });

    test("renders reading-view blocks, preserved line breaks, and math previews", async () => {
        const result = await renderMarkdownPdfDocument(
            {
                file: createFile("Console.md"),
                content: `---
tags: [cli, export]
status: draft
---
# Session

First line
Second line

> [!note] Keep in mind
> Reuse the live preview styling.
>
> Preserve spacing.

> [!terminal] npm test
> npm run dev
> npm test

$E=mc^2$

$$
\\int_0^1 x^2 dx
$$

| Name | Value |
| --- | --- |
| PDF | Styled |

\`\`\`ts
const value = 1;
\`\`\`

\`\`\`mermaid
graph LR
  A["Start"] --> B["End"]
\`\`\``,
            },
            {
                measureHeadingOffsets: async () => new Map([[1, 0]]),
            }
        );

        expect(result.html).toContain("cm-frontmatter-widget");
        expect(result.html).toContain("Properties");
        expect(result.html).toContain("cm-callout-header");
        expect(result.html).toContain("Keep in mind");
        expect(result.html).toContain("cm-terminal-header");
        expect(result.html).toContain("cm-terminal-dots");
        expect(result.html).toContain("cm-table");
        expect(result.html).toContain("white-space: pre-wrap");
        expect(result.html).toContain("cm-math-inline");
        expect(result.html).toContain("cm-math-block");
        expect(result.html).toContain("katex");
        expect(result.html).toContain("cm-codeblock-badge");
        expect(result.html).toContain(">ts<");
        expect(result.html).toContain("cm-mermaid-block");
        expect(result.html).toContain("<svg");
    });

    test("renders image embeds, replaces pdf embeds with placeholders, and omits missing assets", async () => {
        invokeMock.mockImplementation(async (command, payload) => {
            if (command !== "resolve_asset") {
                return undefined;
            }

            const target = (payload as { target: string }).target;
            if (target === "media/photo.png") {
                return "C:/vault/media/photo.png";
            }
            if (target === "docs/spec.pdf") {
                return "C:/vault/docs/spec.pdf";
            }
            return null;
        });

        const result = await renderMarkdownPdfDocument(
            {
                file: createFile("Exports.md"),
                vaultPath: "C:/vault",
                content: [
                    "# Export",
                    "",
                    "![[media/photo.png]]",
                    "",
                    "![[docs/spec.pdf]]",
                    "",
                    "![[media/missing.png]]",
                ].join("\n"),
            },
            {
                measureHeadingOffsets: async () => new Map([[1, 0]]),
            }
        );

        expect(invokeMock).toHaveBeenCalledWith("resolve_asset", {
            vaultPath: "C:/vault",
            target: "media/photo.png",
            sourcePath: "vault/Exports.md",
            mode: "obsidian",
        });
        expect(result.html).toContain('src="file:///C:/vault/media/photo.png"');
        expect(result.html).toContain(".pdf-export-content img {\n    display: block;");
        expect(result.html).toContain("margin: 1.5rem auto;");
        expect(result.html).toContain("Embedded PDF");
        expect(result.html).toContain("spec.pdf");
        expect(result.html).not.toContain("missing.png");
    });

    test("renders the terminal callout icon without a DOM-text-to-HTML round trip", async () => {
        const result = await renderMarkdownPdfDocument({
            file: createFile("Term.md"),
            content: "> [!terminal] Build\n> npm run build\n",
        });

        // The icon must still be present in the exported markup...
        const parsed = new DOMParser().parseFromString(result.html, "text/html");
        const terminalCallout = parsed.querySelector('.cm-callout[data-callout-type="terminal"]');
        expect(terminalCallout).not.toBeNull();
        expect(terminalCallout!.querySelector(".cm-callout-icon svg")).not.toBeNull();

        // ...and the source file must contain no dangerouslySetInnerHTML at all.
        // (Guards the fix from being reverted by a future refactor.)
    });

    test("the pdf renderer source contains no dangerouslySetInnerHTML sink", async () => {
        // `import.meta.url` is not a `file:` URL under this repo's Vitest
        // transform, so `new URL("./markdownPdfRenderer.tsx", import.meta.url)`
        // throws ("The URL must be of scheme file") rather than resolving.
        // Build the path from the repo root instead; the assertion itself
        // (no dangerouslySetInnerHTML / outerHTML sink in this file) is what
        // guards against the fix being reverted.
        const path = await import("node:path");
        const fs = await import("node:fs/promises");
        const filePath = path.join(process.cwd(), "src/features/pdfExport/markdownPdfRenderer.tsx");
        const source = await fs.readFile(filePath, "utf8");
        expect(source).not.toContain("dangerouslySetInnerHTML");
        expect(source).not.toContain(".outerHTML}");
    });

    test("style text cannot terminate its own <style> element", () => {
        expect(sanitizeStyleText(".a{}</style><script>alert(1)</script>")).toBe(
            ".a{}<\\/style><script>alert(1)<\\/script>"
        );
        // Case-insensitive and whitespace-tolerant, matching the HTML parser.
        expect(sanitizeStyleText("</STYLE >")).toBe("<\\/STYLE >");
        expect(sanitizeStyleText("</scRIpt>")).toBe("<\\/scRIpt>");
        // Ordinary CSS is untouched.
        expect(sanitizeStyleText(".x { color: red; }")).toBe(".x { color: red; }");
    });

    test("collected mermaid styles are neutralized before entering the document", async () => {
        const result = await renderMarkdownPdfDocument({
            file: createFile("Diagram.md"),
            content: "```mermaid\ngraph TD;A-->B;\n```\n",
        });

        // Whatever the mermaid version emits, the produced document must contain
        // exactly one <style> element — a smuggled `</style>` would create more.
        const parsed = new DOMParser().parseFromString(result.html, "text/html");
        expect(parsed.querySelectorAll("style").length).toBe(1);
        expect(parsed.querySelectorAll("script").length).toBe(0);
    });
});
