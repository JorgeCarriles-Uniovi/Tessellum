# HTML File Rendering Plugin Design

## Goal

Let users view HTML content in Tessellum, implemented as a builtin plugin (`html-preview`) toggleable from Settings → Plugins like the other 18 builtins, covering three entry points: opening a standalone `.html`/`.htm` file, embedding one via `![[page.html]]` inside a note, and rendering a ` ```html ` fenced code block live in place.

## Scope

- A generic, reusable **file-viewer plugin registry** added to `UIAPI`, so any plugin (not just this one) can claim a file extension for a custom whole-file view — the mechanism this feature needs, generalized for future file-type plugins.
- Standalone preview of `.html`/`.htm` files opened from the file tree, view-only (no in-app source editing).
- Live rendering of ` ```html ` fenced code blocks inside markdown notes.
- Live rendering of `![[page.html]]` (and `![alt](page.html)`) embeds inside markdown notes, by extending the existing `MediaEmbedPlugin`'s kind-dispatch rather than writing a second, competing `![[...]]` parser.
- All three render inside a sandboxed iframe (`sandbox=""`) — no embedded JavaScript ever executes, regardless of entry point.
- A visible fallback UI when rendering fails, consistent with existing patterns (`ImageWithFallback` for the React case, Mermaid's `renderMermaidError` for the CodeMirror-widget cases).
- Instant reactivity: toggling the plugin off/on in Settings takes effect immediately on the currently open file, not just after a manual re-render trigger.

## Out Of Scope

- In-app source editing of `.html` files (view-only for v1; external editor for edits).
- Allowing embedded `<script>` execution (explicitly rejected — sandboxed, no scripts, for all three entry points).
- Converting the existing image/PDF preview path to use the new file-viewer registry — they stay hardcoded in `MediaPreview.tsx`/`Editor.tsx` exactly as today; only new file types (starting with HTML) go through the new registry.
- Retry buttons or surfacing the underlying error message/reason in the fallback UI — a generic "couldn't render" message is enough for v1.
- Any dedicated file-tree icon or other cosmetic treatment for `.html` files beyond what falls out naturally from the above.

## User Scenario

1. User has one or more `.html` files in their vault (e.g. an exported report, a saved web page).
2. Clicking one in the file tree renders it live in the main pane — no raw markup, no script execution — instead of showing an editable text buffer.
3. Inside any markdown note, the user can either:
   - write `![[report.html]]` to embed that file inline, or
   - type a ` ```html ` fenced block directly and see it render in place (hidden raw source unless the cursor is inside it, same interaction as the existing Mermaid plugin).
4. If Settings → Plugins → "HTML Files" is disabled, all three behaviors revert immediately: standalone files fall back to plain-text editing, the `![[...]]` embed falls back to today's "unknown kind" broken-image treatment, and fenced ` ```html ` blocks render as plain code.

## Design

### 1. Generic file-viewer registry (`UIAPI.ts`)

New types and methods, added alongside the existing `sidebarActions`/`paletteCommands`/`settingsTabs` registries (same `Map<pluginId, T[]>` shape, same lifecycle):

```ts
export interface FileViewer {
    id: string;
    test: (path: string) => boolean;
    component: ComponentType<{ path: string }>;
    order?: number;
}
```

- `registerFileViewer(pluginId, viewer)` — appends to `Map<pluginId, FileViewer[]>`.
- `unregisterFileViewers(pluginId)` — deletes the plugin's entries. Wired into `Plugin.ts`'s existing `[PLUGIN_CLEANUP]()` alongside the other `unregisterX` calls, so disabling a plugin automatically tears this down too — no new cleanup mechanism.
- `getFileViewer(path): FileViewer | undefined` — flattens all registered viewers, returns the first whose `test(path)` is true, sorted by `order` (default 0) then registration order — same sort convention as `getSidebarActions()`.

### 2. `Editor.tsx` dispatch change

Currently (`Editor.tsx:863`, `1090-1114`):
```ts
const isMedia = isMediaFile(activeNote.path);
// ...
{isMedia && <MediaPreview path={activeNote.path} />}
```

New:
```ts
usePluginsStore((s) => s.plugins); // subscribe so plugin toggles re-render this component immediately
const fileViewer = app.ui.getFileViewer(activeNote.path);
const isMedia = isMediaFile(activeNote.path) || !!fileViewer;
// ...
{isMedia && (
    fileViewer
        ? <fileViewer.component path={activeNote.path} />
        : <MediaPreview path={activeNote.path} />
)}
```

Images/PDF are untouched (still hardcoded through `MediaPreview.tsx`); anything a plugin registers goes through `fileViewer`. The `usePluginsStore` subscription doesn't use its returned value — its only purpose is to force `Editor.tsx` to re-render whenever any plugin is toggled, so a newly (un)registered file viewer takes effect on the currently open file immediately. This reuses the store that Settings → Plugins already updates on every toggle (`pluginsStore.togglePlugin`), rather than adding new reactive plumbing. The small `isMediaFile` check in the tab-switcher preview-text builder (`Editor.tsx:654`) also gains an `isHtmlFile` check, so `.html` tabs don't show raw markup as their overview-card snippet.

### 3. `fileType.ts`

Add:
```ts
export const HTML_EXTENSIONS = ["html", "htm"];
export function isHtmlFile(path: string): boolean {
    return HTML_EXTENSIONS.includes(getFileExtension(path));
}
```
Kept separate from `MEDIA_EXTENSIONS`/`isMediaFile()` (which stay unchanged) since those are consumed elsewhere without any notion of plugin-enabled state, and `isHtmlFile` needs to be combined with the plugin registry rather than treated as unconditionally "media."

### 4. `HtmlPreviewPlugin` (new builtin plugin)

```ts
export class HtmlPreviewPlugin extends Plugin {
    static manifest: PluginManifest = {
        id: "html-preview",
        name: "HTML Files",
        description: "Renders .html files as sandboxed previews — standalone, embedded via ![[file.html]], and in ```html code blocks.",
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
    }
}
```
Registered in `builtin/index.ts` alongside the other 18.

### 5. Standalone preview — `HtmlFilePreview.tsx` (new)

```tsx
export function HtmlFilePreview({ path }: { path: string }) {
    const [failed, setFailed] = useState(false);
    if (failed) {
        return (
            <div className="h-full w-full flex items-center justify-center select-none">
                <div className="text-center space-y-3" style={{ color: theme.colors.text.muted, maxWidth: "720px", margin: "0 auto" }}>
                    <div className="text-lg font-semibold" style={{ color: theme.colors.text.secondary }}>
                        Couldn't render this HTML file
                    </div>
                    <div className="text-sm">{path.split(/[\\/]/).pop()}</div>
                </div>
            </div>
        );
    }
    return (
        <iframe
            src={convertFileSrc(path)}
            sandbox=""
            title="HTML Preview"
            className="w-full h-full border-none"
            onError={() => setFailed(true)}
        />
    );
}
```
Mirrors `ImageWithFallback`'s `onError`-driven state swap; the fallback markup reuses the exact same structure/classes as `MediaPreview.tsx`'s existing "Preview not available for this file type" branch, just with different copy. Using `convertFileSrc` (not reading bytes into a blob) so relative references inside the HTML (sibling `.css`/images) resolve correctly — same technique the existing PDF preview already uses (`MediaPreview.tsx`'s PDF branch).

### 6. Fenced ` ```html ` block — `src/components/Editor/extensions/code/html-block-plugin.ts` (new)

Structurally mirrors `mermaid-plugin.ts`: a `StateField<DecorationSet>` built from `parseCodeBlocks(state)` filtered to `language === "html"`, replacing the block with a block-level `WidgetType` (`HtmlBlockWidget`) unless the cursor overlaps it (same "hidden unless focused" rule as Mermaid). The widget's `toDOM()` builds:
```
<iframe srcdoc={code} sandbox="" />
```
with an edit-badge / dblclick-to-select-source affordance identical to `MermaidWidget`. On the iframe's native `error` event, the widget replaces its container's contents with a small styled error box — the same shape as Mermaid's `renderMermaidError()`, adapted to say "Couldn't render HTML".

### 7. `![[page.html]]` embed — extends `media-embed-plugin.ts`

- `MediaKind` gains `"html"`.
- `getMediaKind()`/`getMimeType()` recognize `.html`/`.htm` (next to the existing `.pdf` special case).
- `MediaEmbedWidget.toDOM()` gains an `else if (this.kind === "html")` branch: same `convertFileSrc(resolved)`-into-`<iframe sandbox="">` technique as the existing `"pdf"` branch (skipping the blob-fetch path used for images), plus the same native `error`-event fallback described above.
- Gated via config injection, matching this file's existing design (it already receives `getSourcePath` this way rather than importing `TessellumApp` directly, keeping the pure decoration logic decoupled/testable): `MediaEmbedConfig` gains an `isHtmlPreviewEnabled: () => boolean` field, set by `MediaEmbedPlugin.onload()` to `() => !TessellumApp.instance.plugins.isDisabled("html-preview")`. When it returns `false`, kind resolution falls back to `"unknown"` (today's existing behavior — rendered as a broken `<img>`), so disabling the plugin turns off all three behaviors consistently without giving `media-embed-plugin.ts` a hard compile-time dependency on `HtmlPreviewPlugin`.

## Security

- Every iframe uses `sandbox=""` (present, no allow-flags) — this blocks script execution, form submission, popups, and top-level navigation. It does **not** block ordinary resource loading (`<img>`, `<link rel="stylesheet">`), so a self-contained HTML file with sibling assets still renders correctly, just without any JS running.
- This is uniform across all three entry points (standalone file, fenced block, embed) — no distinction between "typed by the user" and "opened from disk," since the goal is a single, simple security posture.
- Malformed HTML gets no special handling — browsers already parse it leniently, so the iframe just renders best-effort.
- `.html` files are not parsed for wikilinks, so `![[a.html]]` embedding another `.html` file that embeds itself back is not a recursion risk through this feature's own logic (an `.html` file linking to another `.html` file is just ordinary sandboxed browser navigation).

## Rationale

The generic file-viewer registry is the smallest addition that satisfies "implemented as a plugin, toggleable like the others" for arbitrary future file types, without inventing a bigger content-type/MIME framework nobody has asked for. The `![[...]]` embed deliberately extends the existing `MediaEmbedPlugin` instead of adding a second `![[...]]` parser, because two independent CodeMirror `StateField`s decorating the same syntax range would produce colliding/duplicate decorations — one shared parser per embed syntax is a hard architectural constraint here, not a stylistic preference. The fenced-block and embed error-fallback logic deliberately stay as two small, separate implementations (React vs. vanilla CodeMirror-widget DOM) rather than one shared abstraction, since unifying two different rendering paradigms for a ~15-line handler isn't worth the indirection.

## Testing

- `fileType.ts`: unit tests for `isHtmlFile`/`HTML_EXTENSIONS` (pure function, trivial to test, mirrors existing `isImageFile`/`isPdfFile` tests if present).
- `UIAPI.ts`: unit tests for `registerFileViewer`/`unregisterFileViewers`/`getFileViewer` — registration, ordering, cleanup on unregister — mirroring the existing test coverage style for `getSidebarActions`/`getUIActions` if present, else new focused tests.
- `media-embed-plugin.ts`: extend existing tests (if present) or add new ones for the `"html"` kind resolving to an iframe branch, and for the disabled-plugin fallback to `"unknown"`.
- `html-block-plugin.ts`: new tests mirroring whatever test coverage `mermaid-plugin.ts` has today (if any) for block detection/decoration building; the error-fallback path if reasonably testable without a real iframe load.
- `HtmlFilePreview.tsx`: Testing Library test for the `onError` → fallback-UI state swap, mirroring `ImageWithFallback`'s test if one exists.
- Manual verification: open a `.html` file from the sidebar, embed one via `![[...]]`, type a ` ```html ` fenced block, and toggle the plugin off/on in Settings, confirming all three behaviors change immediately per the reactivity design above.
