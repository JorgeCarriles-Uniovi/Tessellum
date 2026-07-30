## HTML Preview Plugin

Area E — new territory. The `html-preview` builtin plugin (commits `e4f8cce`..`37faba9`) renders untrusted HTML three ways: standalone `.html`/`.htm` files opened from the file tree, fenced ` ```html ` code blocks inside notes, and `![[page.html]]` embeds routed through the media-embed plugin. All three were reviewed for sandbox escape, path escape, and out-of-vault/network reach.

---

### NEW-HTMLPREVIEW-1: Audit summary — all three HTML render paths are sandboxed correctly (informational)
**Status:** NEW
**Severity:** Low
**File:** `src/components/Editor/HtmlFilePreview.tsx:50-56`, `src/components/Editor/extensions/code/html-block-plugin.ts:64-69`, `src/components/Editor/extensions/media-embed-plugin.ts:131-137`
**Description:** Every one of the three HTML surfaces sets an **empty** `sandbox` attribute, which enables all sandbox restrictions; the dangerous `allow-scripts` + `allow-same-origin` pair appears nowhere in the repo (`grep -rn "sandbox" src src-tauri` returns only these three assignments, their tests, and unrelated Cargo fingerprint noise). Inline `<script>`, form submission, top-level navigation, popups and plugins are therefore all blocked in every path, and no sandboxed frame can reach the parent DOM. The fenced-block path is not the weaker sibling of the standalone viewer — both are sandboxed identically; the sandbox is also applied *before* the frame is attached to the document in every case (attribute set on the detached element at `html-block-plugin.ts:67` before `srcdoc` at `:68`; React sets all props before mount for `HtmlFilePreview`). Separately confirmed there is no *un*-sandboxed surface for **note-authored HTML**: `grep -rn "dangerouslySetInnerHTML\|innerHTML =" src` shows no path that injects raw note markup into the main document (the writes are `""` clears, static SVG icon paths, and mermaid/KaTeX generated output). One caveat on that claim: `mermaid-plugin.ts:101` does `container.innerHTML = svg` with mermaid's own output, and `mermaid.initialize` in that file (`:219-222`) sets only `startOnLoad` and `theme` — it does not set `securityLevel`, so the sanitization of note-derived diagram labels rests on mermaid's `"strict"` default rather than an explicit setting, unlike `markdownPdfRenderer.tsx:1204` which pins `securityLevel: "strict"`. That is a mermaid-plugin concern rather than an html-preview one, but it means "no unsandboxed HTML surface" holds by dependency default, not by local enforcement.
**Evidence:**
```tsx
// src/components/Editor/HtmlFilePreview.tsx:50-56 — standalone file viewer
            <iframe
                ref={frameRef}
                src={convertFileSrc(path)}
                sandbox=""
                title="HTML Preview"
                className="w-full h-full border-none"
            />
```
```typescript
// src/components/Editor/extensions/code/html-block-plugin.ts:64-69 — fenced ```html block
        const frame = document.createElement("iframe");
        frame.className = "cm-html-frame";
        // Empty sandbox: all restrictions on, so inline <script> never runs.
        frame.setAttribute("sandbox", "");
        frame.srcdoc = this.code;
        frame.title = "HTML preview";
```
```typescript
// src/components/Editor/extensions/media-embed-plugin.ts:131-137 — ![[page.html]] embed
        } else if (this.kind === "html") {
            const frame = document.createElement("iframe");
            frame.className = "cm-media-html";
            // Empty sandbox: all restrictions on, so inline <script> never runs.
            frame.setAttribute("sandbox", "");
            frame.src = this.src;
            frame.title = this.displayName;
```
**Fix:** No change required to the sandboxing itself. The one gap is that this security invariant is asserted only for the standalone viewer (`HtmlFilePreview.test.tsx:13`) — `html-block-plugin.test.ts` and the media-embed tests assert decoration counts and `getMediaKind` gating but never that the produced iframe carries `sandbox=""`. Add a `toDOM()`-level assertion in both so a future refactor that drops or loosens the attribute fails a test.

---

### NEW-HTMLPREVIEW-2: Sandboxed HTML can still reach the network — a note-borne beacon fires on open
**Status:** NEW
**Severity:** Medium
**File:** `src-tauri/tauri.conf.json:30`, `src/components/Editor/HtmlFilePreview.tsx:50-56`
**Description:** `sandbox=""` stops script execution but does **not** stop subresource fetches, so `<img src="https://tracker/<vault-id>.png">` inside an untrusted `.html` file or ` ```html ` block still issues a real request the moment the note is opened — leaking the reader's IP, the time of reading, and (via a unique URL) *which* note was opened, in an app that is otherwise fully offline. Neither layer that could stop it does: the parent CSP explicitly allows `https:` in both `img-src` and `media-src` (which is what governs the `srcdoc` fenced-block frame, since a `srcdoc` document inherits the embedder's CSP), and documents served over `asset://` — the standalone viewer and the `![[page.html]]` embed — get **no CSP header at all** (verified in `tauri-2.11.5/src/protocol/asset.rs`, whose response builder sets only `Access-Control-Allow-Origin`, `Content-Type` and range headers). The plugin is enabled by default (`PluginRegistry.list()` computes `enabled: !this.disabled.has(id)`), and fenced blocks auto-render with no click-to-load step, so no user action beyond opening the note is required.
**Evidence:**
```json
// src-tauri/tauri.conf.json:30
      "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: asset: http://asset.localhost https://asset.localhost https:; media-src 'self'  data: blob: asset: https://asset.localhost http://asset.localhost https:; frame-src 'self' asset: https://asset.localhost http://asset.localhost; object-src 'none'; font-src 'self' data:; connect-src 'self' ipc: http://ipc.localhost"
```
```tsx
// src/components/Editor/HtmlFilePreview.tsx:50-56 — no `csp` / `referrerpolicy` / offline gate on the frame
            <iframe
                ref={frameRef}
                src={convertFileSrc(path)}
                sandbox=""
                title="HTML Preview"
                className="w-full h-full border-none"
            />
```
**Fix:** Add a `csp` attribute to the three HTML iframes (e.g. `csp="default-src 'none'; img-src data: asset:; style-src 'unsafe-inline'"`) so embedded documents are confined to local subresources, and/or tighten the global CSP's `img-src`/`media-src` by dropping the bare `https:` source. If remote content is wanted, make it an explicit per-document opt-in ("Load remote content") rather than the default.

---

### NEW-HTMLPREVIEW-3: The "couldn't render" fallback is dead code in all three paths — failures show a blank frame
**Status:** NEW
**Severity:** Medium
**File:** `src/components/Editor/HtmlFilePreview.tsx:24-30`, `src/components/Editor/extensions/code/html-block-plugin.ts:73`, `src/components/Editor/extensions/media-embed-plugin.ts:141-147`
**Description:** All three paths detect failure by listening for an `error` event on the `<iframe>` element, but browsers do not fire `error` on an iframe for navigation failures — an HTTP 403/404 from the asset protocol still fires `load`, with the error page rendered inside the frame. The failure modes here are real and reachable: the Tauri asset scope returns **403** for any path outside the vault (see NEW-HTMLPREVIEW-4) and **404** for a file deleted between resolution and render, both of which currently produce a silent blank frame instead of the written fallback. The `HtmlFilePreview` unit test passes only because `fireEvent.error` synthesises an event jsdom will never produce on its own, so the test certifies handler wiring rather than the behaviour it claims.
**Evidence:**
```tsx
// src/components/Editor/HtmlFilePreview.tsx:24-30
    useEffect(() => {
        const frame = frameRef.current;
        if (!frame) return;
        const handleError = () => setFailed(true);
        frame.addEventListener("error", handleError);
        return () => frame.removeEventListener("error", handleError);
    }, []);
```
```typescript
// src/components/Editor/extensions/code/html-block-plugin.ts:73
        frame.addEventListener("error", () => renderHtmlBlockError(container));
```
```typescript
// src/components/Editor/extensions/media-embed-plugin.ts:141-147
            frame.addEventListener("error", () => {
                container.innerHTML = "";
                const failure = document.createElement("div");
                failure.className = "cm-media-missing";
                failure.textContent = "Couldn't render HTML";
                container.appendChild(failure);
            });
```
```tsx
// src/components/Editor/HtmlFilePreview.test.tsx:16-24 — the test that hides the gap
    test("swaps to the fallback message when the iframe fails to load", () => {
        const { container } = render(<HtmlFilePreview path="vault/Report.html" />);

        fireEvent.error(container.querySelector("iframe")!);

        expect(screen.getByText("Couldn't render this HTML file")).toBeTruthy();
        expect(screen.getByText("Report.html")).toBeTruthy();
        expect(container.querySelector("iframe")).toBeNull();
    });
```
**Fix:** Detect failure before rendering rather than after: have the backend confirm the file exists and is inside the vault (returning a typed error the component can render), or use the `load` event plus a readability probe. Keep the `error` listener only as a belt-and-braces path, and stop asserting the fallback via a synthetic `error` event.

---

### NEW-HTMLPREVIEW-4: `AssetIndex::resolve` skips its vault-containment check on one of four return paths
**Status:** NEW
**Severity:** Medium
**File:** `src-tauri/src/models/asset_index.rs:73-77`, call path `src-tauri/src/commands/assets.rs:73-77`
**Description:** `AssetIndex::resolve` guards three of its four `Some(...)` returns with `canonicalize(...).starts_with(&canonical_vault_root)`, but the first one — the plain `vault_root.join(link_target)` branch taken whenever the wikilink target contains a `/` or `\` — returns the joined path as soon as it `exists()`, with no canonicalization, no containment check, and no extension check. So `![[../../Other Vault/page.html]]` resolves to a path outside the vault and is handed to the frontend, which feeds it straight into `convertFileSrc` and an iframe. This matters more since commit `507a26b` added `html`/`htm` to `SUPPORTED_EXTS`: the escape can now surface a whole rendered document rather than just an image. Note the asymmetry inside `resolve_asset_inner` itself — the `markdown` mode branch calls `validate_path_in_vault` **and** `is_supported_asset` before returning (`assets.rs:56-61`), while the `obsidian` (wikilink) branch delegates entirely to `AssetIndex` and calls neither.

**Second vector, same mitigation:** the wikilink target is not the only way this feature reaches local files. `HtmlFilePreview.tsx:12-13` documents a deliberate choice to render via `convertFileSrc` rather than a blob URL *precisely so that relative references inside the HTML document resolve* — which means an in-vault `.html` file containing `<img src="../../../secret.png">` (or a relative `<link>`/`<iframe>`) issues its own `asset://` requests for paths this repo never sees, let alone validates. Nothing in this codebase governs those requests; the same Tauri asset-scope check verified below is the only thing confining them, and it applies identically. The conclusion is therefore unchanged, but the vector exists independently of `resolve_asset` and should not be assumed covered by fixing `AssetIndex`.

Exploitation of either vector is currently blocked by Tauri's asset protocol, and the mitigation is stronger than a single canonicalization: `SafePathBuf::new` rejects **any** path containing a `Component::ParentDir` before the scope check even runs (`tauri-2.11.5/src/path/mod.rs:46-52`), so the `..`-shaped form 403s immediately; and paths that survive that are canonicalized via `try_resolve_symlink_and_canonicalize` before glob-matching (`tauri-2.11.5/src/scope/fs.rs:419-420`), so the residual shape — an in-vault symlink pointing outside — is rejected too. That is two gates, both outside this codebase; the only user-visible effect today is the silent blank frame of NEW-HTMLPREVIEW-3. Note also that scope grants accumulate per session (`vault.rs:554-560` calls `allow_directory` on every `set_vault_path`), so a second vault opened in the same session widens what the backstop permits.
**File (second vector):** `src/components/Editor/HtmlFilePreview.tsx:12-13`
**Evidence:**
```tsx
// src/components/Editor/HtmlFilePreview.tsx:12-13 — in-document relative refs are resolved by design
 * Renders through `convertFileSrc` rather than a blob URL so relative
 * references inside the document (sibling stylesheets, images) still resolve.
```
```rust
// src-tauri/src/models/asset_index.rs:73-77 — no containment check on this return
		if link_target.contains('/') || link_target.contains('\\') {
			let mut full_path = vault_root.join(link_target);
			if full_path.exists() {
				return Some(full_path);
			}
```
```rust
// src-tauri/src/commands/assets.rs:73-77 — the "obsidian" branch: no validate_path_in_vault, no is_supported_asset
	let asset_index = index_guard.as_ref().unwrap();
	Ok(asset_index
		.resolve(vault_path, target)
		.map(|p| to_asset_path(&p)))
}
```
```rust
// src-tauri/src/commands/assets.rs:56-61 — the "markdown" branch does both checks
		let resolved = validate_path_in_vault(&resolved_path.to_string_lossy(), vault_path)
			.map_err(TessellumError::Validation)?;
		
		if !is_supported_asset(&resolved) {
			return Ok(None);
		}
```
**Fix:** Apply the same `canonicalize(...).starts_with(&canonical_vault_root)` guard to the `full_path.exists()` return in `asset_index.rs`, and have the `obsidian` branch of `resolve_asset_inner` run the resolved path through `validate_path_in_vault` and `is_supported_asset` exactly like the `markdown` branch, so containment does not depend on the Tauri scope being the only line of defence. The second vector cannot be fixed the same way — in-document references never pass through Rust — so it stays a Tauri-scope concern; the `csp` attribute proposed in NEW-HTMLPREVIEW-2 is what would additionally constrain it.

---

### NEW-HTMLPREVIEW-5: Opening an `.html` file still reads the whole file into the editor store behind the viewer
**Status:** NEW
**Severity:** Low
**File:** `src/components/Editor/hooks/useEditorActions.ts:56-64`
**Description:** `useFileSynchronization` short-circuits content loading for `isMediaFile(...)` only; `isHtmlFile` was never added, even though `Editor.tsx:867` treats a file-viewer match exactly like a media file and hides the CodeMirror surface. Opening an `.html` file therefore invokes `read_file` (which has no extension gate — `notes.rs:841-848` just `read_to_string`s any in-vault path) and pushes the entire HTML source into `setActiveNoteContent`, where every consumer of active-note content — outline, word count, tag/link scanners in the right sidebar — parses markup as markdown while the user is actually looking at the iframe. No write path is reachable (CodeMirror is unmounted, so no change event fires), so there is no corruption risk; the cost is a wasted full-file read per open plus nonsense in the note-derived panels.
**Evidence:**
```typescript
// src/components/Editor/hooks/useEditorActions.ts:56-64 — isHtmlFile missing from the skip condition
                if (isMediaFile(activeNote.path)) {
                    if (cancelled || loadRequestIdRef.current !== requestId) {
                        return;
                    }
                    setContent("");
                    setActiveNoteContent("");
                    setIsDirty(false);
                    return;
                }
```
```tsx
// src/components/Editor/Editor.tsx:866-867 — the render side already treats a viewer match as "media"
    const fileViewer = app.ui.getFileViewer(activeNote.path);
    const isMedia = isMediaFile(activeNote.path) || Boolean(fileViewer);
```
**Fix:** Gate on the same predicate both sides use — either add `|| isHtmlFile(activeNote.path)` to the skip in `useFileSynchronization`, or better, pass down the `Boolean(fileViewer)` decision so any future plugin-registered viewer automatically suppresses the note-content read instead of each new file type needing a second edit here.

---

### NEW-HTMLPREVIEW-6: With the plugin disabled, `![[page.html]]` degrades to a broken-image icon
**Status:** NEW
**Severity:** Low
**File:** `src/components/Editor/extensions/media-embed-plugin.ts:217-225`, `src/components/Editor/extensions/media-embed-plugin.ts:149-158`
**Description:** The `htmlEnabled` gate in `getMediaKind` only removes `"html"` as a *kind*; it does not make the embed inert. The backend still resolves `page.html` (the `html`/`htm` entries in `SUPPORTED_EXTS` are unconditional), and `resolvePending` still hands back a `convertFileSrc` URL for `.html`/`.htm` at `media-embed-plugin.ts:565-566`, so the widget arrives with `kind === "unknown"` and a non-null `src` and falls into the final `else`, which unconditionally builds an `<img>`. The user turns HTML rendering off and gets a broken-image glyph rather than the "Missing asset"/plain-link treatment the gate implies.
**Evidence:**
```typescript
// src/components/Editor/extensions/media-embed-plugin.ts:217-225 — gate yields "unknown", not "inert"
export function getMediaKind(path: string, htmlEnabled: boolean): MediaKind {
    const ext = getExtension(path);
    if (ext === "pdf") return "pdf";
    if (htmlEnabled && (ext === "html" || ext === "htm")) return "html";
    if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "tif", "tiff", "avif"].includes(ext)) {
        return "image";
    }
    return "unknown";
}
```
```typescript
// src/components/Editor/extensions/media-embed-plugin.ts:149-158 — "unknown" + a src falls through to <img>
        } else {
            const img = document.createElement("img");
            img.className = "cm-media-image";
            img.src = this.src;
            if (this.alt) img.alt = this.alt;
            img.loading = "lazy";
            if (this.width) img.style.width = `${this.width}px`;
            if (this.height) img.style.height = `${this.height}px`;
            container.appendChild(img);
        }
```
**Fix:** Make the `else` branch render the "unknown kind" placeholder (reuse `cm-media-missing` with the target name, as the `!this.src` branch does) instead of assuming any resolved asset is an image, so a disabled html-preview — and any future unsupported type — degrades to a readable label.
