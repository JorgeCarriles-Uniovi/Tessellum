# HTML File Rendering Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a builtin `html-preview` plugin that renders HTML three ways — standalone `.html`/`.htm` files opened from the file tree, `![[page.html]]` embeds inside notes, and ` ```html ` fenced code blocks — all inside script-blocking sandboxed iframes.

**Architecture:** A new generic **file-viewer registry** is added to `UIAPI` so any plugin can claim a file extension for a whole-file view; `Editor.tsx` consults it before falling back to today's hardcoded image/PDF `MediaPreview`. The plugin registers a React viewer component for standalone files plus a CodeMirror extension for fenced blocks. The `![[...]]` embed case extends the *existing* `media-embed-plugin.ts` kind-dispatch rather than adding a second parser for the same syntax (two `StateField`s decorating the same range would collide). A tiny shared module holds the plugin's enabled flag so `media-embed-plugin.ts` can gate HTML support without depending on the plugin class.

**Tech Stack:** React 18 + TypeScript, CodeMirror 6 (`@codemirror/state`, `@codemirror/view`), Zustand, Vitest + Testing Library, Tauri v2 (`convertFileSrc`).

## Global Constraints

- **Sandbox:** every iframe created by this feature uses `sandbox=""` (attribute present, zero allow-flags). Never add `allow-scripts` or `allow-same-origin`. This blocks JS execution, form submission, popups, and top-level navigation while still allowing `<img>`/`<link rel=stylesheet>` subresources to load.
- **Asset URLs:** always use `convertFileSrc(path)` from `@tauri-apps/api/core` for file-backed HTML — never read bytes into a blob. Blob URLs break relative references (sibling `.css`, images) inside the HTML.
- **Supported extensions:** `html` and `htm` only. Compared lowercase.
- **View-only:** standalone `.html` files are never editable in-app. No source/preview toggle.
- **Fallback copy:** standalone viewer says exactly `Couldn't render this HTML file`; the two CodeMirror widgets say exactly `Couldn't render HTML`. No error details, no retry buttons.
- **Existing behavior untouched:** images and PDFs keep going through the hardcoded `isMediaFile()` → `MediaPreview` path. Do not migrate them to the new registry.
- **Test commands:** `npx vitest run <path>` for a single file; `npm test` for the full suite.
- **Do not** run `npm run tauri dev` or drive the GUI as part of these tasks (Task 9 is the single exception).

## File Structure

**New files** — each owns exactly one responsibility:

| File | Responsibility | Task |
|---|---|---|
| `src/plugins/builtin/htmlPreviewState.ts` | Module-level enabled flag, so editor extensions can gate HTML without importing the plugin | 3 |
| `src/components/Editor/HtmlFilePreview.tsx` | React whole-file viewer for `.html`/`.htm`, incl. its fallback state | 4 |
| `src/components/Editor/extensions/code/html-block-plugin.ts` | CodeMirror extension rendering fenced `html` blocks | 5 |
| `src/plugins/builtin/HtmlPreviewPlugin.ts` | Plugin shell: registers the viewer + extension, owns the enabled flag and change event | 6 |

**Modified files** — scope of each change:

| File | Change | Task |
|---|---|---|
| `src/utils/fileType.ts` | `+HTML_EXTENSIONS`, `+isHtmlFile` (does not touch `isMediaFile`) | 1 |
| `src/plugins/api/UIAPI.ts` | `+FileViewer` type and its register/unregister/get trio | 2 |
| `src/plugins/Plugin.ts` | One line in `[PLUGIN_CLEANUP]()` to tear down file viewers | 2 |
| `src/plugins/builtin/index.ts` | Import + register the new plugin | 6 |
| `src/components/Editor/Editor.tsx` | Consult the viewer registry before falling back to `MediaPreview`; subscribe to plugin toggles | 7 |
| `src/components/Editor/extensions/media-embed-plugin.ts` | `+"html"` media kind, gated, rendered as an iframe | 8 |
| `src/plugins/builtin/MediaEmbedPlugin.ts` | Inject the gate; re-register on the change event | 8 |

The plugin shell (Task 6) is deliberately kept separate from the two rendering units (Tasks 4, 5) so each can be understood and tested on its own — matching how every existing builtin plugin is a thin registration wrapper over logic living in `components/Editor/extensions/`.

---

### Task 1: HTML file-type detection

**Files:**
- Modify: `src/utils/fileType.ts`
- Test: `src/utils/sharedUtils.test.ts:61-67` (extend the existing `detects image, pdf, and media file types` test)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `HTML_EXTENSIONS: string[]`, `isHtmlFile(path: string): boolean` — exported from `src/utils/fileType.ts`. Used by Tasks 6 and 7.

`isHtmlFile` is kept deliberately **separate** from `isMediaFile()`/`MEDIA_EXTENSIONS`. Those are consumed elsewhere with no notion of plugin-enabled state, and HTML support must be gateable by the plugin toggle. Do not add `html` to `MEDIA_EXTENSIONS`.

- [ ] **Step 1: Write the failing test**

In `src/utils/sharedUtils.test.ts`, change the import on line 5 to add `isHtmlFile`:

```ts
import { getFileExtension, isHtmlFile, isImageFile, isMediaFile, isPdfFile } from "./fileType";
```

Then append these assertions inside the existing `detects image, pdf, and media file types` test (after the `isMediaFile("notes.md")` line):

```ts
        expect(isHtmlFile("Report.html")).toBe(true);
        expect(isHtmlFile("Legacy.HTM")).toBe(true);
        expect(isHtmlFile("notes.md")).toBe(false);
        // HTML is deliberately NOT part of the media set — it is plugin-gated.
        expect(isMediaFile("Report.html")).toBe(false);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/sharedUtils.test.ts`
Expected: FAIL — `isHtmlFile is not a function` (or a TS/import resolution error).

- [ ] **Step 3: Write minimal implementation**

In `src/utils/fileType.ts`, add after the `PDF_EXTENSIONS` line:

```ts
export const HTML_EXTENSIONS = ["html", "htm"];
```

and add at the end of the file:

```ts
export function isHtmlFile(path: string): boolean {
    return HTML_EXTENSIONS.includes(getFileExtension(path));
}
```

Leave `MEDIA_EXTENSIONS` and `isMediaFile` exactly as they are.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/sharedUtils.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/fileType.ts src/utils/sharedUtils.test.ts
git commit -m "feat(filetype): add isHtmlFile detection helper"
```

---

### Task 2: Generic file-viewer registry in UIAPI

**Files:**
- Modify: `src/plugins/api/UIAPI.ts` (add types + registry alongside the existing `settingsTabs` registry)
- Modify: `src/plugins/Plugin.ts:58-70` (add unregister call inside `[PLUGIN_CLEANUP]()`)
- Test: `src/plugins/pluginRuntime.test.ts` (new test in the existing `plugin runtime` describe block)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `export interface FileViewer { id: string; test: (path: string) => boolean; component: ComponentType<{ path: string }>; order?: number; }`
  - `UIAPI.registerFileViewer(pluginId: string, viewer: FileViewer): void`
  - `UIAPI.unregisterFileViewers(pluginId: string): void`
  - `UIAPI.getFileViewer(path: string): FileViewer | undefined`
  - Used by Tasks 6 (register) and 7 (query).

This mirrors the existing `Map<pluginId, T[]>` shape used by `sidebarActions`/`paletteCommands`/`settingsTabs`, so cleanup rides on the same `[PLUGIN_CLEANUP]()` mechanism — no new lifecycle machinery.

- [ ] **Step 1: Write the failing test**

Add this test to `src/plugins/pluginRuntime.test.ts`, immediately after the existing `UIAPI resolves text lazily, sorts sidebar and region actions, and unregisters per plugin` test (which ends at line 190):

```ts
    test("UIAPI resolves file viewers by test predicate, respects order, and unregisters per plugin", () => {
        const api = new UIAPI();
        const alphaComponent = () => null;
        const betaComponent = () => null;

        api.registerFileViewer("plugin.alpha", {
            id: "alpha-html",
            test: (path: string) => path.endsWith(".html"),
            component: alphaComponent,
            order: 10,
        });
        api.registerFileViewer("plugin.beta", {
            id: "beta-html",
            test: (path: string) => path.endsWith(".html"),
            component: betaComponent,
            order: 1,
        });

        // Lowest order wins when several viewers claim the same path.
        expect(api.getFileViewer("page.html")?.id).toBe("beta-html");
        // No viewer claims an unrelated extension.
        expect(api.getFileViewer("note.md")).toBeUndefined();

        api.unregisterFileViewers("plugin.beta");
        expect(api.getFileViewer("page.html")?.id).toBe("alpha-html");

        api.unregisterFileViewers("plugin.alpha");
        expect(api.getFileViewer("page.html")).toBeUndefined();
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/plugins/pluginRuntime.test.ts`
Expected: FAIL — `api.registerFileViewer is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `src/plugins/api/UIAPI.ts`, change the first import line (line 1) to:

```ts
import type { ComponentType, ReactNode } from "react";
```

Add this interface after the existing `SettingsTab` type (after line 52):

```ts
/**
 * A whole-file view contributed by a plugin. When a file is opened, the first
 * registered viewer whose `test` returns true renders the main editor pane
 * instead of the markdown editor.
 */
export interface FileViewer {
    id: string;
    /** Returns true when this viewer should own the given file path. */
    test: (path: string) => boolean;
    component: ComponentType<{ path: string }>;
    order?: number;
}
```

Add the backing map next to the other private maps (after line 94, `private settingsTabs = ...`):

```ts
    private fileViewers = new Map<string, FileViewer[]>();
```

Add the methods at the end of the class, just before the closing brace (after `getSettingsTabs()` ends at line 223):

```ts
    // --- File viewers ---

    registerFileViewer(pluginId: string, viewer: FileViewer): void {
        if (!this.fileViewers.has(pluginId)) {
            this.fileViewers.set(pluginId, []);
        }
        this.fileViewers.get(pluginId)!.push(viewer);
    }

    unregisterFileViewers(pluginId: string): void {
        this.fileViewers.delete(pluginId);
    }

    /** First viewer (by ascending `order`, then registration order) claiming this path. */
    getFileViewer(path: string): FileViewer | undefined {
        const candidates: FileViewer[] = [];
        for (const viewers of this.fileViewers.values()) {
            for (const viewer of viewers) {
                if (viewer.test(path)) {
                    candidates.push(viewer);
                }
            }
        }
        return candidates.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
    }
```

In `src/plugins/Plugin.ts`, inside `[PLUGIN_CLEANUP]()`, add one line after the existing `this.app.ui.unregisterSettingsTab(this.manifest.id);` (line 66):

```ts
        this.app.ui.unregisterFileViewers(this.manifest.id);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/plugins/pluginRuntime.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/plugins/api/UIAPI.ts src/plugins/Plugin.ts src/plugins/pluginRuntime.test.ts
git commit -m "feat(plugins): add generic file-viewer registry to UIAPI"
```

---

### Task 3: Shared enabled-state module

**Files:**
- Create: `src/plugins/builtin/htmlPreviewState.ts`
- Test: `src/plugins/builtin/htmlPreviewState.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `setHtmlPreviewEnabled(enabled: boolean): void`, `isHtmlPreviewEnabled(): boolean` — used by Tasks 6 (plugin sets it) and 8 (media-embed reads it).

**Why a module-level flag instead of querying the registry:** `PluginRegistry.disable()` calls `plugin[PLUGIN_CLEANUP]()` (which runs `onunload()`) *before* `this.disabled.add(id)`. So anything reacting during `onunload()` that asked `plugins.isDisabled("html-preview")` would still get `false` — stale. An explicitly-set flag is order-independent and directly testable. (The design spec described the registry-query approach; this is a deliberate correction for that ordering bug.)

- [ ] **Step 1: Write the failing test**

Create `src/plugins/builtin/htmlPreviewState.test.ts`:

```ts
import { beforeEach, describe, expect, test } from "vitest";
import { isHtmlPreviewEnabled, setHtmlPreviewEnabled } from "./htmlPreviewState";

describe("html preview state", () => {
    beforeEach(() => {
        setHtmlPreviewEnabled(false);
    });

    test("defaults to disabled until a plugin enables it", () => {
        expect(isHtmlPreviewEnabled()).toBe(false);
    });

    test("reflects the most recently set value", () => {
        setHtmlPreviewEnabled(true);
        expect(isHtmlPreviewEnabled()).toBe(true);

        setHtmlPreviewEnabled(false);
        expect(isHtmlPreviewEnabled()).toBe(false);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/plugins/builtin/htmlPreviewState.test.ts`
Expected: FAIL — cannot resolve module `./htmlPreviewState`.

- [ ] **Step 3: Write minimal implementation**

Create `src/plugins/builtin/htmlPreviewState.ts`:

```ts
/**
 * Enabled-state for the `html-preview` plugin, kept outside the plugin class so
 * editor extensions (e.g. media-embed-plugin) can gate HTML support without
 * importing the plugin or querying PluginRegistry.
 *
 * PluginRegistry.disable() runs onunload() BEFORE marking the plugin disabled,
 * so querying the registry during teardown returns a stale value. The plugin
 * sets this flag explicitly in onload()/onunload() instead.
 */
let htmlPreviewEnabled = false;

export function setHtmlPreviewEnabled(enabled: boolean): void {
    htmlPreviewEnabled = enabled;
}

export function isHtmlPreviewEnabled(): boolean {
    return htmlPreviewEnabled;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/plugins/builtin/htmlPreviewState.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/plugins/builtin/htmlPreviewState.ts src/plugins/builtin/htmlPreviewState.test.ts
git commit -m "feat(plugins): add shared html-preview enabled-state module"
```

---

### Task 4: Standalone HTML file viewer component

**Files:**
- Create: `src/components/Editor/HtmlFilePreview.tsx`
- Test: `src/components/Editor/HtmlFilePreview.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks (the `path` prop shape must match `FileViewer["component"]` from Task 2: `ComponentType<{ path: string }>`).
- Produces: `HtmlFilePreview({ path }: { path: string })` — a default-exportless named React component. Used by Task 6.

The fallback markup deliberately copies the structure and classes of `MediaPreview.tsx`'s existing "Preview not available for this file type" branch (`src/components/Editor/MediaPreview.tsx:37-51`) so the two error states look identical, only the copy differs.

`convertFileSrc` is already mocked globally by `src/test/tauriMocks.ts` (loaded via `src/test/setup.ts`) to return `asset://<path>`, so the test asserts against that.

- [ ] **Step 1: Write the failing test**

Create `src/components/Editor/HtmlFilePreview.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { HtmlFilePreview } from "./HtmlFilePreview";

describe("HtmlFilePreview", () => {
    test("renders a script-blocking sandboxed iframe pointed at the converted asset url", () => {
        const { container } = render(<HtmlFilePreview path="vault/Report.html" />);

        const frame = container.querySelector("iframe");
        expect(frame).not.toBeNull();
        expect(frame!.getAttribute("src")).toBe("asset://vault/Report.html");
        // Empty sandbox === all restrictions on, notably no script execution.
        expect(frame!.getAttribute("sandbox")).toBe("");
    });

    test("swaps to the fallback message when the iframe fails to load", () => {
        const { container } = render(<HtmlFilePreview path="vault/Report.html" />);

        fireEvent.error(container.querySelector("iframe")!);

        expect(screen.getByText("Couldn't render this HTML file")).toBeTruthy();
        expect(screen.getByText("Report.html")).toBeTruthy();
        expect(container.querySelector("iframe")).toBeNull();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Editor/HtmlFilePreview.test.tsx`
Expected: FAIL — cannot resolve module `./HtmlFilePreview`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/Editor/HtmlFilePreview.tsx`:

```tsx
import { useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { theme } from "../../styles/theme";

interface HtmlFilePreviewProps {
    path: string;
}

/**
 * Whole-file viewer for .html/.htm files, registered by HtmlPreviewPlugin.
 *
 * Renders through `convertFileSrc` rather than a blob URL so relative
 * references inside the document (sibling stylesheets, images) still resolve.
 * The empty `sandbox` attribute blocks script execution entirely.
 */
export function HtmlFilePreview({ path }: HtmlFilePreviewProps) {
    const [failed, setFailed] = useState(false);

    if (failed) {
        return (
            <div className="h-full w-full flex items-center justify-center select-none">
                <div
                    className="text-center space-y-3"
                    style={{ color: theme.colors.text.muted, maxWidth: "720px", margin: "0 auto" }}
                >
                    <div className="text-lg font-semibold" style={{ color: theme.colors.text.secondary }}>
                        Couldn't render this HTML file
                    </div>
                    <div className="text-sm">{path.split(/[\\/]/).pop()}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full w-full" style={{ backgroundColor: "var(--color-panel-footer)" }}>
            <iframe
                src={convertFileSrc(path)}
                sandbox=""
                title="HTML Preview"
                className="w-full h-full border-none"
                onError={() => setFailed(true)}
            />
        </div>
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Editor/HtmlFilePreview.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/Editor/HtmlFilePreview.tsx src/components/Editor/HtmlFilePreview.test.tsx
git commit -m "feat(editor): add sandboxed standalone HTML file viewer"
```

---

### Task 5: Fenced `html` code block extension

**Files:**
- Create: `src/components/Editor/extensions/code/html-block-plugin.ts`
- Test: `src/components/Editor/extensions/code/html-block-plugin.test.ts`

**Interfaces:**
- Consumes: `parseCodeBlocks(state: EditorState): CodeBlock[]` from `./code-parser` (existing; `CodeBlock` is `{ from: number; to: number; language: string }`, language already lowercased).
- Produces: `createHtmlBlockPlugin(): Extension` (used by Task 6) and `buildHtmlBlockDecorations(state: EditorState): DecorationSet` (exported for testing only).

Structurally mirrors `src/components/Editor/extensions/code/mermaid-plugin.ts` — same "replace the block with a widget unless the cursor is inside it" rule, same edit-badge/dblclick-to-select-source affordance, same error-box styling as its `renderMermaidError`. It is simpler: no theme observer and no panzoom.

- [ ] **Step 1: Write the failing test**

Create `src/components/Editor/extensions/code/html-block-plugin.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Editor/extensions/code/html-block-plugin.test.ts`
Expected: FAIL — cannot resolve module `./html-block-plugin`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/Editor/extensions/code/html-block-plugin.ts`:

```ts
import {
    Decoration,
    DecorationSet,
    EditorView,
    WidgetType,
} from "@codemirror/view";
import { EditorState, Extension, RangeSetBuilder, StateField } from "@codemirror/state";
import { parseCodeBlocks } from "./code-parser";

const HTML_BLOCK_LANGUAGES = ["html", "htm"];

function renderHtmlBlockError(container: HTMLElement): void {
    container.innerHTML = "";
    const errorDiv = document.createElement("div");
    errorDiv.style.color = "var(--color-alert-text)";
    errorDiv.style.border = "1px solid var(--color-alert-border)";
    errorDiv.style.padding = "10px";
    errorDiv.style.borderRadius = "4px";
    errorDiv.style.background = "var(--color-alert-bg)";
    errorDiv.textContent = "Couldn't render HTML";
    container.appendChild(errorDiv);
}

class HtmlBlockWidget extends WidgetType {
    constructor(
        readonly code: string,
        readonly startPos: number,
        readonly endPos: number,
    ) {
        super();
    }

    eq(other: HtmlBlockWidget) {
        return this.code === other.code && this.startPos === other.startPos;
    }

    toDOM(view: EditorView) {
        const wrapper = document.createElement("div");
        wrapper.className = "cm-html-block group relative my-4 border rounded-md overflow-hidden";
        wrapper.style.backgroundColor = "var(--color-panel-footer)";
        wrapper.style.borderColor = "var(--color-panel-border)";

        const container = document.createElement("div");
        container.style.width = "100%";

        const badge = document.createElement("div");
        badge.className = "cm-codeblock-badge opacity-0 group-hover:opacity-100 z-10";
        badge.textContent = "html";

        const tooltip = document.createElement("div");
        tooltip.className = "cm-codeblock-tooltip";
        tooltip.textContent = "Edit Source";
        badge.appendChild(tooltip);

        const selectSource = (event: Event) => {
            event.preventDefault();
            event.stopPropagation();
            view.dispatch({ selection: { anchor: this.startPos, head: this.endPos } });
            view.focus();
        };
        badge.addEventListener("mousedown", selectSource);
        wrapper.addEventListener("dblclick", selectSource);

        const frame = document.createElement("iframe");
        frame.className = "cm-html-frame";
        // Empty sandbox: all restrictions on, so inline <script> never runs.
        frame.setAttribute("sandbox", "");
        frame.srcdoc = this.code;
        frame.title = "HTML preview";
        frame.style.width = "100%";
        frame.style.height = "320px";
        frame.style.border = "none";
        frame.addEventListener("error", () => renderHtmlBlockError(container));

        container.appendChild(frame);
        wrapper.appendChild(badge);
        wrapper.appendChild(container);
        return wrapper;
    }

    ignoreEvent(): boolean {
        return true;
    }
}

/** Exported for testing. */
export function buildHtmlBlockDecorations(state: EditorState): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const selection = state.selection.main;

    for (const block of parseCodeBlocks(state)) {
        if (!HTML_BLOCK_LANGUAGES.includes(block.language)) continue;

        // Cursor inside the block -> keep raw source visible for editing.
        const cursorOverlap = selection.from >= block.from && selection.to <= block.to;
        if (cursorOverlap) continue;

        const firstLine = state.doc.lineAt(block.from);
        const lastLine = state.doc.lineAt(block.to);
        const contentStart = firstLine.to + 1;
        const contentEnd = lastLine.from - 1;
        if (contentEnd <= contentStart) continue;

        const code = state.doc.sliceString(contentStart, contentEnd).trim();
        if (!code) continue;

        builder.add(
            block.from,
            block.to,
            Decoration.replace({
                widget: new HtmlBlockWidget(code, block.from, block.to),
                block: true,
            }),
        );
    }

    return builder.finish();
}

const htmlBlockStateField = StateField.define<DecorationSet>({
    create(state) {
        return buildHtmlBlockDecorations(state);
    },
    update(oldState, transaction) {
        if (transaction.docChanged || transaction.selection) {
            return buildHtmlBlockDecorations(transaction.state);
        }
        return oldState;
    },
    provide: (field) => EditorView.decorations.from(field),
});

export function createHtmlBlockPlugin(): Extension {
    return [htmlBlockStateField];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Editor/extensions/code/html-block-plugin.test.ts`
Expected: PASS (4 tests)

If the first test reports `0` instead of `1`, the position arithmetic in `DOC` is off — print `parseCodeBlocks(stateWith(DOC, 26))` and move the cursor past the block's `to`.

- [ ] **Step 5: Commit**

```bash
git add src/components/Editor/extensions/code/html-block-plugin.ts src/components/Editor/extensions/code/html-block-plugin.test.ts
git commit -m "feat(editor): render fenced html code blocks in a sandboxed iframe"
```

---

### Task 6: HtmlPreviewPlugin

**Files:**
- Create: `src/plugins/builtin/HtmlPreviewPlugin.ts`
- Modify: `src/plugins/builtin/index.ts` (import + register + doc comment)
- Test: `src/plugins/builtin/HtmlPreviewPlugin.test.ts`

**Interfaces:**
- Consumes: `isHtmlFile` (Task 1), `UIAPI.registerFileViewer` (Task 2), `setHtmlPreviewEnabled` (Task 3), `HtmlFilePreview` (Task 4), `createHtmlBlockPlugin` (Task 5).
- Produces: `HtmlPreviewPlugin` class with `static manifest: PluginManifest` (`id: "html-preview"`). Emits the app event `"html-preview:changed"` on both load and unload — Task 8 subscribes to it.

`onunload()` must set the flag to `false` and emit, so the embed path in Task 8 refreshes. Register the plugin **before** `MarkdownPreviewPlugin` in `index.ts` (next to the other media plugins) so its block widgets aren't hidden by the syntax-hiding preview plugin — the same reason `MediaEmbedPlugin` is registered first today.

- [ ] **Step 1: Write the failing test**

Create `src/plugins/builtin/HtmlPreviewPlugin.test.ts`:

```ts
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TessellumApp } from "../TessellumApp";
import { HtmlPreviewPlugin } from "./HtmlPreviewPlugin";
import { isHtmlPreviewEnabled, setHtmlPreviewEnabled } from "./htmlPreviewState";

function resetAppSingleton() {
    (TessellumApp as unknown as { _instance: TessellumApp | null })._instance = null;
}

function createPlugin() {
    const app = TessellumApp.create();
    const plugin = new HtmlPreviewPlugin();
    plugin.app = app;
    plugin.manifest = HtmlPreviewPlugin.manifest;
    return { app, plugin };
}

describe("HtmlPreviewPlugin", () => {
    beforeEach(() => {
        resetAppSingleton();
        setHtmlPreviewEnabled(false);
        vi.clearAllMocks();
    });

    test("registers a file viewer that claims html files only", () => {
        const { app, plugin } = createPlugin();

        plugin.onload();

        const viewer = app.ui.getFileViewer("vault/Report.html");
        expect(viewer).toBeDefined();
        expect(viewer!.id).toBe("html-file");
        expect(app.ui.getFileViewer("vault/note.md")).toBeUndefined();
    });

    test("registers the fenced html block editor extension", () => {
        const { plugin } = createPlugin();
        const registerExtension = vi.spyOn(plugin, "registerEditorExtension");

        plugin.onload();

        expect(registerExtension).toHaveBeenCalledTimes(1);
    });

    test("flips the shared enabled flag and announces the change on load and unload", () => {
        const { app, plugin } = createPlugin();
        const changed = vi.fn();
        app.events.on("html-preview:changed", changed);

        plugin.onload();
        expect(isHtmlPreviewEnabled()).toBe(true);
        expect(changed).toHaveBeenCalledTimes(1);

        plugin.onunload();
        expect(isHtmlPreviewEnabled()).toBe(false);
        expect(changed).toHaveBeenCalledTimes(2);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/plugins/builtin/HtmlPreviewPlugin.test.ts`
Expected: FAIL — cannot resolve module `./HtmlPreviewPlugin`.

- [ ] **Step 3: Write minimal implementation**

Create `src/plugins/builtin/HtmlPreviewPlugin.ts`:

```ts
import { Plugin } from "../Plugin";
import type { PluginManifest } from "../types";
import { HtmlFilePreview } from "../../components/Editor/HtmlFilePreview";
import { createHtmlBlockPlugin } from "../../components/Editor/extensions/code/html-block-plugin";
import { isHtmlFile } from "../../utils/fileType";
import { setHtmlPreviewEnabled } from "./htmlPreviewState";

/** Emitted whenever HTML rendering is switched on or off. */
export const HTML_PREVIEW_CHANGED_EVENT = "html-preview:changed";

/**
 * HTML Preview Plugin — renders HTML three ways, always script-free:
 *  - standalone .html/.htm files opened from the file tree
 *  - ```html fenced code blocks inside notes
 *  - ![[page.html]] embeds (handled by media-embed-plugin, gated on this plugin)
 */
export class HtmlPreviewPlugin extends Plugin {
    static manifest: PluginManifest = {
        id: "html-preview",
        name: "HTML Files",
        description:
            "Renders .html files as sandboxed previews — standalone, embedded via ![[file.html]], and in html code blocks",
        version: "1.0.0",
        source: "builtin",
    };

    onload() {
        this.app.ui.registerFileViewer(this.manifest.id, {
            id: "html-file",
            test: isHtmlFile,
            component: HtmlFilePreview,
        });
        this.registerEditorExtension(createHtmlBlockPlugin());

        setHtmlPreviewEnabled(true);
        this.app.events.emit(HTML_PREVIEW_CHANGED_EVENT);
    }

    override onunload() {
        setHtmlPreviewEnabled(false);
        this.app.events.emit(HTML_PREVIEW_CHANGED_EVENT);
    }
}
```

In `src/plugins/builtin/index.ts`, add the import after the `MediaPastePlugin` import (line 18):

```ts
import { HtmlPreviewPlugin } from "./HtmlPreviewPlugin";
```

Add the registration inside `registerBuiltinPlugins`, right after the `MediaPastePlugin` line (line 50):

```ts
    app.plugins.register(HtmlPreviewPlugin.manifest, HtmlPreviewPlugin);
```

Add a line to the numbered doc comment list (after the `14. media-embed` line):

```
 *  15. html-preview - renders .html files, html embeds, and html code blocks
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/plugins/builtin/HtmlPreviewPlugin.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/plugins/builtin/HtmlPreviewPlugin.ts src/plugins/builtin/HtmlPreviewPlugin.test.ts src/plugins/builtin/index.ts
git commit -m "feat(plugins): add html-preview builtin plugin"
```

---

### Task 7: Route opened files through the file-viewer registry

**Files:**
- Modify: `src/components/Editor/Editor.tsx` (imports; line 654; line 863; lines 1110-1114)

**Interfaces:**
- Consumes: `UIAPI.getFileViewer` (Task 2), `isHtmlFile` (Task 1), `usePluginsStore` from `../../stores` (existing).
- Produces: nothing consumed by later tasks.

Images and PDFs keep flowing through `isMediaFile` → `MediaPreview` untouched; only registry-claimed types take the new branch.

**Reactivity — read carefully.** The `usePluginsStore((state) => state.plugins)` call is intentionally a bare expression whose value is unused. Its only job is to re-render `Editor.tsx` whenever a plugin is toggled, so a newly registered/unregistered file viewer applies to the already-open file immediately. This works because `pluginsStore.togglePlugin` mutates the registry (via `setEnabled`) **before** calling `set({ plugins })`. Do not "clean this up" by deleting it or assigning it to an unused variable.

This task has no automated test: `Editor.tsx` is a large integration component with no existing render test to extend, and adding a harness for it is disproportionate here. The behavior is covered by the unit tests in Tasks 2/4/6 plus the manual verification in Task 9.

**Do NOT add `isHtmlFile` to `src/components/Editor/hooks/useEditorActions.ts:56.`** That `isMediaFile` check skips `read_file` for images/PDFs. Because `isHtmlFile` is deliberately excluded from `isMediaFile` (Task 1), `.html` files always get their text content loaded — which is exactly what makes the disabled-plugin fallback a *working* text editor rather than an empty one. Adding the check there would silently break Task 9 Step 4. The only cost of leaving it alone is that the right sidebar derives an outline/tags from HTML markup while previewing, which is cosmetic noise, not breakage.

- [ ] **Step 1: Add the imports**

In `src/components/Editor/Editor.tsx`, change line 31 from:

```ts
import { isMediaFile } from "../../utils/fileType";
```

to:

```ts
import { isHtmlFile, isMediaFile } from "../../utils/fileType";
```

Change line 37 from:

```ts
import { useEditorModeStore } from "../../stores";
```

to:

```ts
import { useEditorModeStore, usePluginsStore } from "../../stores";
```

- [ ] **Step 2: Skip content-preview generation for HTML tabs**

At line 654, change:

```ts
                    if (isMediaFile(path)) {
```

to:

```ts
                    if (isMediaFile(path) || isHtmlFile(path)) {
```

This stops `.html` tabs from showing raw markup as their workspace-overview snippet.

- [ ] **Step 3: Subscribe to plugin toggles (must be above the early return)**

Immediately after `const app = useTessellumApp();` (line 583), add:

```ts
    // Subscribing (value unused) re-renders this component on every plugin
    // toggle, so file-viewer registrations apply to the open file immediately.
    usePluginsStore((state) => state.plugins);
```

**This placement is mandatory.** `Editor.tsx` has an early return at line 856 (`if (!activeNote) { return <EmptyEditorState ... /> }`). Putting the hook below that line would make it a conditional hook call and break the Rules of Hooks. It must sit with the other unconditional hooks near the top of the component.

- [ ] **Step 4: Resolve a file viewer and widen the non-editor branch**

At line 863 (now shifted down by the lines added in Step 3), replace:

```ts
    const isMedia = isMediaFile(activeNote.path);
```

with:

```ts
    const fileViewer = app.ui.getFileViewer(activeNote.path);
    const isMedia = isMediaFile(activeNote.path) || Boolean(fileViewer);
```

`app` is already in scope from line 583. This line is below the early return, so `activeNote` is non-null here.

- [ ] **Step 5: Render the registered viewer when one claims the file**

At lines 1110-1114 (shifted down by earlier edits), replace:

```tsx
                {isMedia && (
                    <div className="h-full w-full">
                        <MediaPreview path={activeNote.path} />
                    </div>
                )}
```

with:

```tsx
                {isMedia && (
                    <div className="h-full w-full">
                        {fileViewer
                            ? <fileViewer.component path={activeNote.path} />
                            : <MediaPreview path={activeNote.path} />}
                    </div>
                )}
```

- [ ] **Step 6: Verify nothing regressed**

Run: `npx tsc --noEmit -p . 2>&1 | grep -v "TS2550"`
Expected: no output. (`TS2550` errors about `Array.prototype.at` are pre-existing in test files and unrelated to this change — filter them out.)

Run: `npx vitest run src/components/Editor`
Expected: PASS — all existing editor tests still green.

- [ ] **Step 7: Commit**

```bash
git add src/components/Editor/Editor.tsx
git commit -m "feat(editor): route opened files through the plugin file-viewer registry"
```

---

### Task 8: HTML support for ![[page.html]] embeds

**Files:**
- Modify: `src/components/Editor/extensions/media-embed-plugin.ts` (lines 17-20, 24, 97-164, 195-202, 334-354, ~536)
- Modify: `src/plugins/builtin/MediaEmbedPlugin.ts`
- Test: `src/plugins/builtin/builtinPluginBasics.test.tsx:250-265` (extend the existing media-embed test)

**Interfaces:**
- Consumes: `isHtmlPreviewEnabled` (Task 3), `HTML_PREVIEW_CHANGED_EVENT` (Task 6).
- Produces: nothing consumed by later tasks.

Extending the existing embed plugin — rather than adding a second `![[...]]` parser — is a hard constraint, not a preference: two CodeMirror `StateField`s decorating the same document range produce colliding decorations.

- [ ] **Step 1: Write the failing test**

In `src/plugins/builtin/builtinPluginBasics.test.tsx`, replace the existing `registers the media embed plugin when a vault is available and refreshes it on vault events` test (lines 250-265) with:

```tsx
    test("registers the media embed plugin when a vault is available and refreshes it on vault and html-preview events", () => {
        resetAppSingleton();
        useVaultStore.getState().setVaultPath("vault");

        const mediaEmbed = createPlugin(MediaEmbedPlugin);
        const embedRegister = vi.spyOn(mediaEmbed.app.editor, "registerExtensions");

        mediaEmbed.plugin.onload();

        expect(embedRegister).toHaveBeenCalledWith("media-embed", ["media-embed-extension"]);

        mediaEmbed.app.events.emit("vault:opened");
        mediaEmbed.app.events.emit("vault:scope-ready");
        mediaEmbed.app.events.emit("html-preview:changed");

        expect(builtinMocks.createMediaEmbedPlugin).toHaveBeenCalledTimes(4);
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/plugins/builtin/builtinPluginBasics.test.tsx`
Expected: FAIL — `expected 4, received 3` (the `html-preview:changed` listener does not exist yet).

- [ ] **Step 3: Wire the gate into MediaEmbedPlugin**

In `src/plugins/builtin/MediaEmbedPlugin.ts`, add these imports after the existing `createMediaEmbedPlugin` import:

```ts
import { isHtmlPreviewEnabled } from "./htmlPreviewState";
import { HTML_PREVIEW_CHANGED_EVENT } from "./HtmlPreviewPlugin";
```

Add `isHtmlPreviewEnabled` to the config object passed to `createMediaEmbedPlugin`:

```ts
            const extensions = createMediaEmbedPlugin({
                vaultPath,
                getSourcePath: () => TessellumApp.instance.workspace.getActiveNote()?.path ?? null,
                isHtmlPreviewEnabled,
            });
```

Subscribe to the toggle event alongside the existing vault events (after the `scopeRef` line):

```ts
        const htmlRef = this.app.events.on(HTML_PREVIEW_CHANGED_EVENT, register);
        this.registerEvent(htmlRef);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/plugins/builtin/builtinPluginBasics.test.tsx`
Expected: PASS

- [ ] **Step 5: Teach media-embed-plugin the "html" kind**

In `src/components/Editor/extensions/media-embed-plugin.ts`:

**(a)** Extend the config interface (lines 17-20):

```ts
interface MediaEmbedConfig {
    vaultPath: string;
    getSourcePath: () => string | null;
    /** Gate for HTML embeds — owned by the html-preview plugin. */
    isHtmlPreviewEnabled: () => boolean;
}
```

**(b)** Add the kind (line 24):

```ts
type MediaKind = "image" | "pdf" | "html" | "unknown";
```

**(c)** Make `getMediaKind` gate-aware (lines 195-202):

```ts
function getMediaKind(path: string, htmlEnabled: boolean): MediaKind {
    const ext = getExtension(path);
    if (ext === "pdf") return "pdf";
    if (htmlEnabled && (ext === "html" || ext === "htm")) return "html";
    if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "tif", "tiff", "avif"].includes(ext)) {
        return "image";
    }
    return "unknown";
}
```

**(d)** Pass the gate through in `buildMediaDecorations`. Immediately after `const embeds = parseEmbeds(state);` (line 342) add:

```ts
    const htmlEnabled = config.isHtmlPreviewEnabled();
```

and change the `kind` line (line 354) to:

```ts
        const kind = resolvedPath
            ? getMediaKind(resolvedPath, htmlEnabled)
            : getMediaKind(embed.target, htmlEnabled);
```

**(e)** Route HTML through `convertFileSrc` instead of the blob path. In `resolvePending`, replace these lines (around line 535-545):

```ts
                                    const mime = getMimeType(resolved);
                                    if (mime === "application/pdf") {
```

with:

```ts
                                    const resolvedExt = getExtension(resolved);
                                    // PDFs and HTML load by URL so relative
                                    // subresources inside them still resolve.
                                    if (resolvedExt === "pdf" || resolvedExt === "html" || resolvedExt === "htm") {
```

Leave the body of that branch (the `convertFileSrc` + cache-update code) unchanged. `getMimeType` stays as-is — it is only used here.

**(f)** Render HTML in the widget. In `MediaEmbedWidget.toDOM`, replace lines 107-108:

```ts
        container.style.display = this.kind === "pdf" ? "block" : "inline-block";
        container.style.width = this.kind === "pdf" ? "100%" : "auto";
```

with:

```ts
        const isFramed = this.kind === "pdf" || this.kind === "html";
        container.style.display = isFramed ? "block" : "inline-block";
        container.style.width = isFramed ? "100%" : "auto";
```

Then add a new branch after the existing `else if (this.kind === "pdf") { ... }` block (which ends at line 127), before the final `else`:

```ts
        } else if (this.kind === "html") {
            const frame = document.createElement("iframe");
            frame.className = "cm-media-html";
            // Empty sandbox: all restrictions on, so inline <script> never runs.
            frame.setAttribute("sandbox", "");
            frame.src = this.src;
            frame.title = this.displayName;
            frame.style.width = this.width ? `${this.width}px` : "100%";
            frame.style.height = this.height ? `${this.height}px` : "60vh";
            frame.style.border = "none";
            frame.addEventListener("error", () => {
                container.innerHTML = "";
                const failure = document.createElement("div");
                failure.className = "cm-media-missing";
                failure.textContent = "Couldn't render HTML";
                container.appendChild(failure);
            });
            container.appendChild(frame);
```

Finally, stop the click-overlay from covering the iframe. Change the overlay condition (line 142) from:

```ts
            this.kind !== "pdf"
```

to:

```ts
            !isFramed
```

- [ ] **Step 6: Verify the whole suite**

Run: `npx tsc --noEmit -p . 2>&1 | grep -v "TS2550"`
Expected: no output.

Run: `npm test`
Expected: PASS — all tests green, with the new ones from Tasks 1-8 included.

- [ ] **Step 7: Commit**

```bash
git add src/components/Editor/extensions/media-embed-plugin.ts src/plugins/builtin/MediaEmbedPlugin.ts src/plugins/builtin/builtinPluginBasics.test.tsx
git commit -m "feat(editor): render html embeds via the media embed plugin"
```

---

### Task 9: Manual verification

**Files:** none modified.

**Interfaces:**
- Consumes: everything from Tasks 1-8.
- Produces: nothing.

Automated tests cover the units; this task confirms the three entry points actually work in the running app, which no unit test can establish.

- [ ] **Step 1: Prepare fixtures in a scratch vault**

Create `scratch.html` in a test vault with content that proves scripts are blocked:

```html
<!doctype html>
<html>
  <body style="font-family: sans-serif">
    <h1 id="title">Static HTML renders</h1>
    <script>document.getElementById("title").textContent = "SCRIPTS RAN — BUG";</script>
  </body>
</html>
```

Create a note containing both embed forms:

````markdown
![[scratch.html]]

```html
<h2>Inline block renders</h2>
```
````

- [ ] **Step 2: Launch the app**

Run: `npm run tauri dev`

If port 3000 is already in use, an instance is already running — use that one instead of starting a second.

- [ ] **Step 3: Verify all three entry points**

Confirm each:
1. Clicking `scratch.html` in the file tree shows the rendered heading, **still reading "Static HTML renders"** (if it says "SCRIPTS RAN — BUG", the sandbox is misconfigured — stop and fix).
2. The note shows the embedded file rendered inline below the `![[scratch.html]]` line.
3. The ` ```html ` block renders as a heading when the cursor is elsewhere, and reverts to editable source when the cursor moves inside it.

- [ ] **Step 4: Verify the plugin toggle**

Open Settings → Plugins, toggle **HTML Files** off. Confirm, without restarting:
1. The open `.html` file falls back to plain-text editing immediately.
2. After clicking into the note, the `![[scratch.html]]` embed no longer renders as HTML.

Toggle it back on and confirm all three behaviors return.

- [ ] **Step 5: Commit (only if fixes were needed)**

If Steps 3-4 surfaced defects, fix them, re-run `npm test`, and commit. If everything passed, there is nothing to commit — this task is verification only.

---

## Known Limitations

Document these; do not treat them as bugs to fix in this plan:

- **Embed reactivity is coarser than the standalone viewer.** Toggling the plugin re-registers the media-embed extension immediately, but existing decorations in an open note rebuild on the next document change, selection change, or asset-resolution effect — not necessarily on the same frame. The standalone file view is instant.
- **No custom error state for a blank iframe load.** An `error` event only fires for genuine load failures; an HTML file that loads but renders as an empty page shows an empty page, matching how the existing PDF preview behaves.
- **`.html` files are not indexed for wikilinks or full-text search** by this change — they render, but nothing else about how the vault indexes them changes.
- **Plain `[[page.html]]` links (without the leading `!`) are unchanged.** `useWikiLinkNavigation.ts:34` only short-circuits for `isMediaFile` targets, so a non-embed link to a `.html` file falls through to the note-creation path, exactly as it does today for any other non-markdown, non-media extension (`[[data.csv]]`, etc.). This is pre-existing behavior, not a regression from this feature, and fixing it is out of scope.
- **The right sidebar treats a previewed `.html` file as markdown.** Its outline/tags panels parse the raw HTML text (see the note in Task 7). Cosmetic only.
