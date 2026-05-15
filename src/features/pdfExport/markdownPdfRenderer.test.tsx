import { describe, expect, test } from "vitest";
import type { FileMetadata } from "../../types";
import { EXPORT_PAGE_HEIGHT_PX, EXPORT_TYPOGRAPHY } from "./pdfExportDomain";
import { renderMarkdownPdfDocument } from "./markdownPdfRenderer";

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
});
