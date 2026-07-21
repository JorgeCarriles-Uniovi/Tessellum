# Markdown PDF Export Implementation Notes

## 1. Context Menu Entry

I extended the sidebar context-menu item builder so markdown notes can expose a dedicated `Export to PDF` action without adding file-type branching directly inside the menu component.

## 2. Frontend Export Domain

I created a small `pdfExportDomain` module to keep the pure rules isolated:

- detect whether a file is exportable
- build the default output filename
- define fixed export typography and page geometry
- convert measured heading offsets into bookmark page numbers

This keeps the sidebar and export hook free of document math.

## 3. Off-Screen HTML Renderer

I added a dedicated renderer that:

1. strips frontmatter from the markdown body
2. reconstructs the frontmatter as a read-only `Properties` block so the PDF matches the live preview instead of flattening metadata into generic tags
3. splits the markdown body into export blocks, separating normal markdown chunks from callout blocks
4. renders regular callouts with Tessellum-style callout chrome and terminal callouts with the terminal header, traffic-light dots, and monospace body rows
5. snapshots the active theme CSS variables from the live application, including terminal and callout colors
6. renders the note into a hidden DOM container with fixed export sizing
7. post-processes the rendered DOM to replace LaTeX expressions with KaTeX HTML so inline and block math match the reading view
8. inlines the KaTeX stylesheet into the standalone export document so the math survives outside the app shell
9. post-processes code fences into export widgets with the same language badge treatment used by the editor
10. renders Mermaid code fences into SVG diagrams before the HTML is printed, and carries Mermaid’s generated stylesheet into the export document
11. replaces simplified callout placeholders with the same SVG header icons the application uses
12. applies `break-inside: avoid` guards to frontmatter, callouts, code blocks, Mermaid diagrams, tables, and math blocks so the browser is less likely to split them across pages
13. preserves user-authored line breaks in reading-view paragraphs with PDF-safe `white-space: pre-wrap`
14. measures heading offsets from `data-outline-line` attributes
15. generates the final standalone HTML document string from the already-enhanced DOM

The same renderer uses `parseOutline` so the PDF bookmarks match the right-sidebar outline logic.

## 4. Asset URL Handling

Because the exported HTML is written to a temporary location before printing, local markdown links and image paths are rewritten to absolute `file:///` URLs relative to the note path. This keeps vault assets reachable during browser-based PDF generation.

## 5. Export Orchestration

I separated orchestration into a service and a hook:

- the service coordinates save dialog, file read, render, backend export, and notifications
- the hook wires the service to Tauri `save`, `invoke`, the vault API, and toast notifications

That split keeps most behavior unit-testable without mounting the full app shell.

## 6. Backend PDF Generation

The backend command:

1. validates the export request
2. writes the generated HTML to a temporary file
3. launches a compatible browser in headless print-to-PDF mode on Windows
4. writes the PDF to the user-selected destination
5. reloads the PDF with `lopdf`
6. injects hierarchical bookmarks based on the frontend-provided heading pages

The browser invocation now explicitly disables print headers and footers so the exported PDF does not include the browser-generated date, time, URL, or page metadata around the note content.

The frontend owns page measurement so the backend does not need to re-implement markdown layout.

## 7. Verification

I added targeted tests for:

- export eligibility and bookmark page mapping
- export orchestration behavior
- themed HTML rendering
- reading-view frontmatter, callout, terminal, table, and line-break rendering
- reading-view code block badges and Mermaid rendering
- hook wiring to Tauri and the vault API
- sidebar menu visibility
- backend request validation and bookmark hierarchy normalization
