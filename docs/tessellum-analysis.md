# Tessellum — Full Technical Analysis

This document consolidates two things: a **Tessellum 2.0 feature proposal** (new capabilities the application should gain) and a **complete bug report** (concrete defects found by reading the source code). All bug locations cite the actual file path and approximate line number as observed in the codebase.

---

## Table of Contents

1. [Tessellum 2.0 — Feature Proposals](#1-tessellum-20--feature-proposals)
   - 1.1 [Intelligence](#11-intelligence)
   - 1.2 [Collaboration & Sync](#12-collaboration--sync)
   - 1.3 [Structure & Linking](#13-structure--linking)
   - 1.4 [Export & Publish](#14-export--publish)
   - 1.5 [Developer Tools](#15-developer-tools)
   - 1.6 [Platform](#16-platform)
2. [Confirmed User-Facing Bugs](#2-confirmed-user-facing-bugs)
3. [General Bug Analysis](#3-general-bug-analysis)
4. [Full Codebase Scan — Rust Backend](#4-full-codebase-scan--rust-backend)
5. [Full Codebase Scan — Editor Extensions](#5-full-codebase-scan--editor-extensions)
6. [Full Codebase Scan — Stores & Hooks](#6-full-codebase-scan--stores--hooks)
7. [Full Codebase Scan — UI Components](#7-full-codebase-scan--ui-components)
8. [Bug Priority Matrix](#8-bug-priority-matrix)

---

## 1. Tessellum 2.0 — Feature Proposals

Tessellum 1.x is a capable local-first Markdown editor. Version 2.0 should shift the application from a note-taking tool to a full **thinking environment** — one that helps users connect ideas, share knowledge, and extend the app through a public plugin ecosystem.

The three strategic bets:

1. **Intelligence without the cloud** — a local embedding pipeline (ONNX in Rust) powers semantic search, smart linking, and AI writing, all without sending data to any server.
2. **Continuity across devices** — version history and vault sync via user-owned storage (Git, WebDAV, iCloud) close the biggest usability gap for multi-device users.
3. **An open ecosystem** — stabilising the plugin SDK as `@tessellum/plugin-sdk` turns the internal plugin architecture into a platform that the community can extend.

The **core architectural investment** required is a local embedding pipeline shared across intelligence features. The **quickest wins** are Database Views (the indexer already has all the data) and the Static Site Publisher (the export infrastructure already exists).

---

### 1.1 Intelligence

#### Semantic Search & Smart Linking
**Priority:** High | **Effort:** Large

Replace keyword-only search with vector similarity search. Surface related notes as the user types a wikilink.

- Embed notes locally at index time via an ONNX runtime (e.g. `all-MiniLM-L6-v2`); store vectors in SQLite with the `sqlite-vec` extension.
- Semantic search panel shows results ranked by meaning, not just keyword overlap.
- Wikilink autocomplete ranks suggestions by semantic similarity to the current paragraph context.
- Orphan note suggestions: "This note is similar to 3 others — consider linking them."

#### Local AI Writing Assistant
**Priority:** High | **Effort:** Large

Inline AI completions, summarisation, and rewriting — fully local via Ollama or a user-configured cloud API.

- Slash command `/ai` opens a prompt bar for generation in the current note context.
- Selection actions: summarise, expand, rephrase, translate — surfaced in the existing selection toolbar.
- Configurable provider: local Ollama endpoint or Claude/OpenAI API key stored in the OS keychain.
- Streamed output rendered live in the editor; user can accept, reject, or regenerate.

#### Auto-Tagging & Concept Extraction
**Priority:** Medium | **Effort:** Medium

Suggest tags and named entities from note content; keep the tag graph meaningful at scale.

- On save, an NER model extracts people, places, and concepts, shown as suggested inline tags.
- Tag consolidation UI: lists near-duplicate tags (e.g. "machine-learning" vs "ml") and lets users merge them.
- Graph view gains a "cluster by topic" layout mode powered by embedding similarity.

#### Vault Q&A (RAG)
**Priority:** Low | **Effort:** Large

Ask natural language questions across the entire vault; answers cite specific notes.

- Retrieval-augmented: top-k semantically relevant chunks passed as context to the configured LLM.
- Answers shown in a side panel with inline citations linking to source notes.
- Works offline if Ollama is configured; otherwise routes to the cloud API.

---

### 1.2 Collaboration & Sync

#### Multi-Device Vault Sync
**Priority:** High | **Effort:** Extra Large

Sync the vault across devices without a proprietary cloud — via user-owned storage backends.

- Sync adapters implemented as a Rust trait: Git remote (auto-commit and push on save), WebDAV, and local folder (for iCloud/Dropbox passthrough).
- Conflict resolution UI: three-way diff when the same note has changed on two devices.
- Sync status indicator in the title bar; per-note last-synced timestamp stored in frontmatter.
- No Tessellum server required — the user provides credentials for their own backend.

#### Version History
**Priority:** High | **Effort:** Medium

Per-note revision history stored locally; restore any previous version with a diff view.

- Snapshots stored in a hidden `.tessellum/history/` directory inside the vault.
- Side-by-side diff viewer (current vs. selected snapshot) using a unified diff algorithm in Rust.
- Automatic snapshots on significant saves; manual "pin" action to bookmark a named version.
- If Git sync is enabled, history maps to Git commits automatically.

#### Shared Vaults (Read-Only Links)
**Priority:** Low | **Effort:** Extra Large

Share a read-only snapshot of selected notes or folders as a signed URL via the user's own storage.

- Export a selection as a self-contained static site bundle; upload to user's S3 or WebDAV.
- Snapshot-based sharing with manual refresh — no live sync required.
- Access controlled by a signed token embedded in the URL.

---

### 1.3 Structure & Linking

#### Database Views (Dataview-style)
**Priority:** High | **Effort:** Large

Query frontmatter and tags with a simple table/list/calendar syntax inside notes.

- Fenced code block with ` ```dataview ` syntax, executed by the indexer against SQLite.
- Supported views: table, list, calendar (date-field based).
- Filter by tag, property value, folder, or linked-from. Sort, limit, group.
- Results rendered live in preview mode; source visible in edit mode.
- Grafeo/Cypher queries remain for graph operations; dataview handles property queries.

#### Canvas / Spatial View
**Priority:** Medium | **Effort:** Large

A freeform canvas where notes, images, and web clips are arranged spatially — like a digital whiteboard.

- Stored as a `.canvas` JSON file in the vault (compatible with Obsidian Canvas format for interoperability).
- Card types: embedded note (live preview), image, URL embed, plain text sticky.
- Drawing arrows between cards creates wikilinks in the underlying notes.
- Powered by Cytoscape (already a dependency) with a freeform layout mode.

#### Note Properties Panel
**Priority:** Medium | **Effort:** Small

A structured sidebar panel for editing frontmatter fields without touching raw YAML.

- Reads a vault-level `properties.json` schema; renders appropriate inputs (date, select, multi-select, text, number, checkbox, URL).
- Changes write back to frontmatter; the indexer picks them up immediately.
- Inline property hints shown in the file tree (e.g. a status indicator dot on the file icon).

---

### 1.4 Export & Publish

#### Static Site Publisher
**Priority:** High | **Effort:** Large

Export any folder as a fully navigable static website with graph view and search — deployable anywhere.

- Rust-side renderer: walks vault, resolves wikilinks to relative URLs, generates an HTML + CSS bundle.
- Includes a compiled-in JS graph view (Cytoscape) and a client-side search index (pagefind or lunr).
- Frontmatter `publish: true/false` controls which notes are included.
- One-click deploy to GitHub Pages, Cloudflare Pages, or a local folder (for Netlify drag-and-drop).

#### Rich DOCX & Presentation Export
**Priority:** Medium | **Effort:** Medium

Export notes to Word documents and Reveal.js slide decks, with frontmatter-driven slide breaks.

- DOCX export using the `docx-rs` Rust crate; maps heading styles, lists, code blocks, and tables to Word styles.
- Slides: `---` horizontal rules become slide breaks; exported as self-contained HTML with Reveal.js embedded.
- Batch export: entire folder as a ZIP of DOCX files or a single multi-slide deck.

#### Import From Everywhere
**Priority:** Medium | **Effort:** Medium

Import notes from Notion, Obsidian, Roam, Bear, Apple Notes, and web pages with one command.

- Notion: parse exported ZIP (HTML/Markdown); rewrite internal links, convert databases to frontmatter.
- Obsidian: direct vault folder import — compatible by design, but resolve plugin-specific syntax.
- Web clipper: a browser extension (or share-sheet on mobile) sends a URL to Tessellum; Rust fetches the page, extracts readable content via `readability-rs`, and saves it as a note.
- Bear / Apple Notes: import via exported Markdown archives.

---

### 1.5 Developer Tools

#### Public Plugin SDK & Marketplace
**Priority:** High | **Effort:** Large

Document and stabilise the plugin API; ship a community marketplace with one-click install.

- Freeze the `src/plugins/api/` interface as a versioned contract; publish it as an npm package (`@tessellum/plugin-sdk`).
- Plugin manifest schema: name, version, permissions required, entry point, settings schema.
- Marketplace: community-hosted JSON registry (GitHub-backed); browseable and installable from the Plugins settings tab.
- Sandbox: plugins run in a content-security-policy-restricted iframe with a whitelisted API surface.

#### Automation & Scripting (Tessellum Scripts)
**Priority:** Medium | **Effort:** Medium

Run user-defined scripts against the vault API — triggered by hotkey, schedule, or note event.

- Scripts stored as `.ts` files in `.tessellum/scripts/`; run in a Deno-lite sandbox.
- API surface: read/write notes, query index, send notifications, open files.
- Trigger types: on-save hook, scheduled (cron-style), command palette action, keyboard shortcut.
- Example use case: auto-create a weekly review note every Monday morning with the previous week's tasks.

#### Mobile Companion App
**Priority:** Low | **Effort:** Extra Large

iOS/Android app for quick capture and read-only browsing, synced to the desktop vault.

- Built with Tauri Mobile (v2 supports iOS and Android) — shares the Rust core, with a new mobile-optimised React UI.
- Quick capture: title and body, auto-tagged, saved to an inbox folder in the vault on next sync.
- Read-only graph view and search; editing limited to quick capture and single-note edits.
- Sync via the same adapters as the desktop app (Git, WebDAV, iCloud).

---

### 1.6 Platform

#### Incremental Indexing & Large-Vault Performance
**Priority:** High | **Effort:** Medium

Handle vaults of 10,000+ notes without startup lag by making the indexer truly incremental.

- Store content hashes in SQLite; on watcher events, only re-index changed files.
- Background indexing with a priority queue: open note first, then modified files, then the rest.
- Graph view virtualisation: only render visible nodes; cluster large vaults by folder or tag.
- Lazy-load search index: load Tantivy segments on demand rather than all at startup.

#### Offline-Ready CLI
**Priority:** Low | **Effort:** Medium

A headless CLI for scripting vault operations, and an optional browser-based UI for server environments.

- CLI commands: `tessellum index`, `tessellum search "query"`, `tessellum export --site ./out`.
- Run as a local HTTP server (`tessellum serve`) exposing the full app as a PWA — useful for NAS devices or remote servers.
- Shares all Rust backend logic; only the Tauri shell is optional.

---

## 2. Confirmed User-Facing Bugs

These five bugs were reported by direct user observation. Each has been traced to exact source locations.

---

### BUG-U1: Reduced Motion toggle clears the active theme

**Severity:** High  
**Files:** `src/stores/accessibilityStore.ts:79–82`, `src/hooks/useApplyAccessibilitySettings.ts:54–55`, `src/stores/themeStore.ts`

**Description:**  
When the user opens Settings → Accessibility and toggles *Reduce Motion*, the active theme reverts to the application default.

**Root cause:**  
`useApplyAccessibilitySettings.ts` subscribes both the appearance store and the theme store to a shared `queueHighContrastOverlay` callback. When the accessibility store is updated, this callback fires and re-reads theme state. If the Zustand `persist` middleware has not yet finished rehydrating (which can happen on a slow first render), the callback reads the default theme name and writes it back into the active theme key, clobbering whatever the user had selected.

```typescript
// useApplyAccessibilitySettings.ts:54–55
const unsubscribeAppearance = useAppearanceStore.subscribe(queueHighContrastOverlay);
const unsubscribeTheme      = useThemeStore.subscribe(queueHighContrastOverlay);
// queueHighContrastOverlay reads theme state before rehydration is complete
```

**Fix:** Make `queueHighContrastOverlay` read-only — it should apply a CSS class or variable to the root element only, never write to the theme store. Gate the callback behind the `onRehydrateStorage` callback so it does not fire until both stores are fully rehydrated.

**Also affected:** Toggling High Contrast and changing the UI Scale slider use the same callback chain and exhibit the same bug.

---

### BUG-U2: Code block (and other fenced blocks) inside a callout breaks rendering

**Severity:** High  
**Files:** `src/components/Editor/extensions/callout/callout-parser.ts:7, 45–52`

**Description:**  
Writing a fenced code block inside a callout causes the callout decoration to break at the opening fence. The closing ` ``` ` is treated as the end of the callout, leaving the rest of the document undecorated or visually corrupted.

**Root cause:**  
The callout continuation scanner is purely line-by-line. The regex on line 7 only matches lines that begin with `>`. The scanner breaks immediately on the first non-matching line — it has no concept of "I am currently inside a fenced block."

```typescript
// callout-parser.ts:7
export const CALLOUT_CONTINUATION_RE = /^>\s?(.*)$/;

// callout-parser.ts:45–52
while (nextPos <= state.doc.length) {
    const nextLine = state.doc.lineAt(nextPos);
    const contMatch = nextLine.text.match(CALLOUT_CONTINUATION_RE);
    if (contMatch) {
        contentLines.push(contMatch[1]);
        contentTo = nextLine.to;
        nextPos = nextLine.to + 1;
    } else {
        break; // ← exits on first non-`>` line (e.g. closing ```)
    }
}
```

For a callout containing a fenced code block:
```
> [!note] Title
> ```js        ← matched, fence opened
> const x = 1 ← matched
```            ← NOT matched → parser breaks here
```

**Fix:** Track a `fenceOpen: boolean` flag inside the scanner loop. When a continuation line's stripped content starts with ` ``` ` or `~~~`, toggle the flag. While `fenceOpen` is `true`, do not break on non-matching lines.

**Also affected:** Mermaid diagrams (` ```mermaid `), KaTeX display blocks (`$$...$$`), and HTML blocks inside callouts all share the same vulnerability.

---

### BUG-U3: Graph view — media nodes show wrong label and double-click creates a `.md` file

**Severity:** High  
**Files:** `src-tauri/src/commands/graph.rs:42`, `src/components/GraphView/GraphView.tsx:99–106`

**Description:**  
Media nodes in the graph view (images, PDFs, etc.) sometimes display their path including the file extension rather than a clean name. Double-clicking a missing media node (a ghost node for a broken image link) creates a new `.md` Markdown file instead of showing an error.

**Root cause — Part A (Rust, label stripping):**  
`path_to_label()` unconditionally attempts to strip the `.md` suffix from all node paths, regardless of node type. For Markdown notes this works correctly. For media files it is a no-op, but the function is also called for ghost/broken nodes where the raw path string (including extension) ends up as the displayed label when the node has an unusual path structure.

```rust
// graph.rs:42
if let Some(stripped) = relative.strip_suffix(".md") {
    relative = stripped.to_string(); // fires for ALL node types
}
```

**Root cause — Part B (TypeScript, double-click handler):**  
The double-click handler checks if the clicked node ID matches an existing file. For any node that does not match (including all missing media nodes), it falls through to create a new note:

```typescript
// GraphView.tsx:99–106
const existingFile = files.find((f) => f.path === nodeId);
if (existingFile) {
    setActiveNote(existingFile); setViewMode('editor');
} else {
    const filename = parts[parts.length - 1];
    const title    = filename.replace(/\.md$/, ''); // no-op for .png
    const newNote  = await createNoteInDir(vaultPath, title); // always creates .md
}
```

**Fix A (Rust):** Pass the node type alongside the path to `path_to_label` and only strip `.md` when `node_type == NodeType::Note`.  
**Fix B (TypeScript):** Before calling `createNoteInDir`, check the file extension of the node ID. If it matches a known media extension (`.png`, `.jpg`, `.pdf`, `.mp4`, etc.), show an error toast ("This asset is missing from the vault") instead of creating a file.

**Also affected:** Ghost nodes for wikilinks that include a folder prefix (`[[Projects/Idea]]`) — the double-click creates the note at the vault root rather than inside `Projects/`.

---

### BUG-U4: Wikilinks display the full path instead of only the last segment

**Severity:** Medium  
**Files:** `src/components/Editor/extensions/wikilink/wikiLink-parser.ts:100`

**Description:**  
Typing `[[Projects/2024/Meeting Notes]]` renders the full string *Projects/2024/Meeting Notes* as the visible link label, instead of just *Meeting Notes*. The user must manually add a pipe alias (`[[Projects/2024/Meeting Notes|Meeting Notes]]`) every time they use a path-style wikilink.

**Root cause:**  
`parseWikiLink()` returns the full target string as-is when no explicit `|` pipe separator is present. The decoration layer then uses `link.alias ?? link.target` as the visible text. Without an auto-generated alias, the entire target path is displayed.

```typescript
// wikiLink-parser.ts:79–102
return {
    target: inner.trim(),
    // alias: undefined — decoration layer shows full path string
};
```

The standard behaviour in Obsidian, Logseq, and every major wikilink-based editor is that `[[Path/To/Note]]` displays only `Note` (the last path segment), with the pipe syntax overriding that default.

**Fix (one line):**
```typescript
return {
    target: inner.trim(),
    alias: inner.trim().includes('/')
        ? inner.trim().split('/').pop()
        : undefined,
};
```

This auto-generates a display alias from the last path segment when a `/` is present, while leaving flat wikilinks (`[[Note]]`) unchanged.

**Also affected:** The wikilink autocomplete suggestion list only matches on note names, not folder paths — so path-style wikilinks must be typed entirely by hand with no autocomplete assistance.

---

### BUG-U5: Trash restore remembers only the immediate parent folder, not the full path

**Severity:** Medium  
**Files:** `src-tauri/src/trash.rs:27`, `src-tauri/src/commands/notes.rs:111, 120`

**Description:**  
Deleting `Projects/2024/Q1/Notes/Important.md` and then restoring it places the file back in *some* folder named `Notes` — but if multiple `Notes` folders exist in the vault, it may land in the wrong one. If no matching folder is found, the file is restored to the vault root.

**Root cause:**  
`generate_trash_name()` in `trash.rs` stores only the immediate parent folder name, discarding the full path hierarchy:

```rust
// trash.rs:27
let raw_parent = path
    .parent()
    .and_then(|p| p.file_name()) // only "Notes", not "Projects/2024/Q1/Notes"
    .map(|n| n.to_string_lossy())
    .unwrap_or_else(|| "root".into());
```

The restore function in `notes.rs` then searches for any directory in the vault with a matching name:

```rust
// notes.rs:111
.filter(|path| {
    path.file_name()
        .and_then(|v| v.to_str())
        .map(|v| v == parent_label) // matches ANY folder named "Notes"
        .unwrap_or(false)
})
// notes.rs:120
.unwrap_or_else(|| vault_root.join(parent_label)) // creates new folder at root if none found
```

The sort heuristic (`candidate_directory_priority`) prefers shallower paths, so `Archive/Notes` is chosen over `Projects/2024/Q1/Notes`, which is likely wrong.

**Fix:** Encode the full relative path in the trash filename using a safe delimiter (e.g. `__`):  
`Important __Projects__2024__Q1__Notes__ 1740681450123.md`  
On restore, split on the delimiter to reconstruct the exact target path. Fall back to the current name-search heuristic only if the original path no longer exists, with a user-visible warning.

**Edge case also broken:** Files deleted from the vault root are given the label `"root"`. If the guard at `notes.rs:97` does not match exactly (encoding difference), the fallback at line 120 creates a physical folder named `root` at the vault root and places the file inside it, rather than restoring to the root directly.

---

## 3. General Bug Analysis

These bugs were found during an initial audit of core modules.

---

### BUG-G1: vaultStore reads localStorage path with no validation

**Severity:** High  
**File:** `src/stores/vaultStore.ts:53`

**Description:**  
The store initialises `vaultPath` directly from localStorage with no existence check, type guard, or error recovery. If the stored path points to a directory that was renamed, deleted, or is on an unmounted drive, the app silently enters a broken state.

```typescript
vaultPath: localStorage.getItem("vaultPath"), // no validation
```

The same pattern exists in `settingsStore.ts:75–81` for theme names, font families, and locale codes — corrupted or hand-edited localStorage entries are accepted as valid state.

**Fix:** Validate path existence on load via a Tauri command. If the vault path is invalid, show a "vault not found" screen with a prompt to select a new location rather than entering a broken state.

---

### BUG-G2: appearanceStore writes terminal colours in two separate localStorage calls

**Severity:** Medium  
**File:** `src/stores/appearanceStore.ts:214–237`

**Description:**  
Each terminal colour setter makes two `localStorage.setItem` calls — one for the colour value and one for the `TERMINAL_CUSTOM_KEY` flag — with no atomicity between them. If the app is force-killed between the two writes, the colour is stored but `terminalCustom` remains `false`, causing the custom colour to be silently overridden by the active theme on next launch.

```typescript
setTerminalHeaderBg: (terminalHeaderBg) => set(() => {
    localStorage.setItem(TERMINAL_HEADER_BG_KEY, terminalHeaderBg);
    localStorage.setItem(TERMINAL_CUSTOM_KEY, "true"); // separate call — not atomic
    return { terminalHeaderBg, terminalCustom: true };
}),
```

**Fix:** Write both keys before returning from the setter, or combine them into a single serialised object under one key.

---

### BUG-G3: Media embed plugin — in-flight Tauri invoke not cancelled on view destruction

**Severity:** Medium  
**File:** `src/components/Editor/extensions/media-embed-plugin.ts:522–596`

**Description:**  
`resolvePending` clears the `pendingRequests` map immediately before iterating it, then awaits `invoke("resolve_asset")` for each request. There is no abort signal or destroyed-state check. If the editor view is destroyed while an invoke is pending (e.g. the user closes the note), the callback still calls `updateDecorations` on the dead view. New embed requests that arrive during the `await` window are also silently dropped because the map was pre-cleared.

```typescript
async resolvePending(view: EditorView) {
    const requests = Array.from(pendingRequests.values());
    pendingRequests.clear(); // new requests during await are lost
    for (const req of requests) {
        const resolved = await invoke<string | null>("resolve_asset", {...});
        // view may be destroyed here — no guard
        updateDecorations(view, resolved, req);
    }
}
```

**Fix:** Add a `destroyed` boolean flag to the plugin state, set it synchronously in `destroy()`, and check it before calling `updateDecorations`. Keep new requests that arrive during an in-flight resolve in a separate pending queue rather than clearing the map upfront.

---

### BUG-G4: isDirty flag can be cleared after a subsequent keystroke

**Severity:** Medium  
**File:** `src/components/Editor/hooks/useEditorActions.ts:123–154`

**Description:**  
The save guard compares `latestContentByPathRef` inside the `.then()` callback. By the time the Tauri `write_file` call resolves, the user may have typed additional characters. The comparison may incorrectly conclude the content is unchanged and clear the dirty flag even though unsaved edits exist.

**Fix:** Use a monotonically incrementing save generation counter. Only clear `isDirty` if the generation at save-initiation matches the generation at save-completion.

---

### BUG-G5: EditorView registered in useEffect with ref value as dependency — never re-runs

**Severity:** Medium  
**File:** `src/components/Editor/Editor.tsx:59–69`

**Description:**  
The effect that registers the CodeMirror `EditorView` with the plugin system lists `editorRef.current?.view` as a dependency. React does not re-run effects when a ref's `.current` property changes — only when the ref object itself changes (it never does). This means the effect only runs on mount and unmount. If the editor unmounts and remounts (e.g. note switching in certain scenarios), the new `EditorView` instance may not be registered.

```typescript
useEffect(() => {
    const view = editorRef.current?.view;
    if (view) TessellumApp.instance.editor.setView(view);
    return () => TessellumApp.instance.editor.setView(null);
}, [editorRef.current?.view]); // ← never triggers on ref change
```

**Fix:** Use a callback ref (`ref={useCallback(node => { ... }, [])}`) so the callback fires when the DOM node is assigned, not on render.

---

### BUG-G6: TabStrip drag handler captures stale tab order

**Severity:** Medium  
**File:** `src/components/Editor/TabStrip.tsx:144–187`

**Description:**  
`tabsOrderRef` is updated via `useEffect`, but the mousemove/mouseup handlers close over the ref — not its value. If a tab is added or removed while a drag is in progress, the handler may compute an incorrect drop index using a stale tab list. Additionally, `dragStateRef.current` is set to `null` by `cleanupDrag()`, but the global `mouseup` listener is not removed synchronously — rapid start-and-stop drags can accumulate stale handlers that fire on the next drag.

---

### BUG-G7: PDF export swallows the actual error — user gets no actionable information

**Severity:** Medium  
**File:** `src/features/pdfExport/markdownPdfExport.ts:25–51`

**Description:**  
The entire export pipeline is wrapped in a single catch that discards the structured error from the Rust backend and replaces it with a generic toast message. Permission errors, out-of-disk-space errors, and content errors all look identical to the user.

```typescript
} catch (error) {
    console.error(error); // detail only in DevTools
    notifyError("Failed to export PDF"); // no cause shown
}
```

**Fix:** Extract the error message from the caught value and include it in the toast. The Rust backend returns typed `TessellumError` variants — surface the variant name and message to the user.

---

### BUG-G8: Clipboard import ignores `skippedCount` and treats vault-refresh failure as import failure

**Severity:** Medium  
**File:** `src/features/clipboard/clipboardImport.ts:54–82`

**Description:**  
The Rust backend returns a `ClipboardImportResult` containing both `importedPaths` and `skippedCount`, but `skippedCount` is discarded entirely. More critically, if `refreshVault()` throws after a successful import, the entire operation is reported to the user as failed — even though the files are already written to disk.

**Fix:** Separate the import result notification from the vault refresh. Report the import outcome (including skipped count) before attempting the refresh. Handle refresh failures independently.

---

### BUG-G9: Concurrent `full_sync` calls can interleave SQLite and Tantivy writes

**Severity:** Medium  
**File:** `src-tauri/src/indexer.rs:165–183`

**Description:**  
No in-progress flag prevents a second `full_sync` (triggered by the filesystem watcher) from running while a manual rebuild is active. The Tantivy lock is held only during the search-index phase, not during the preceding SQLite writes — both syncs can write to SQLite simultaneously, then race for the Tantivy lock, leaving search results and graph data temporarily inconsistent.

**Fix:** Add an `Arc<AtomicBool>` in-progress flag. If a sync is already running, debounce and retry the next trigger after completion rather than running both concurrently.

---

### BUG-G10: searchStore.syncReadiness does not catch invoke errors

**Severity:** Medium  
**File:** `src/stores/searchStore.ts:135–162`

**Description:**  
`syncReadiness` awaits `invoke<SearchReadinessPayload>` without a try/catch. If the Tauri command fails (e.g. the vault is not yet open), the exception propagates to the caller and `setReadinessState` is never called. Components that catch the error may then display the old (possibly "ready") state, making the search panel appear functional when it is not.

**Fix:** Wrap the invoke in try/catch. On error, call `setReadinessState` with a `notReady` payload and surface an error indicator in the search panel.

---

### BUG-G11: `next_available_name` has no upper bound — can loop thousands of times

**Severity:** Low  
**File:** `src-tauri/src/commands/clipboard.rs:42–49`

**Description:**  
The name deduplication function loops indefinitely, checking filesystem existence on each iteration. A vault with hundreds of identically named files will cause hundreds of filesystem calls before returning.

```rust
let mut copy_index = 1;
loop { // no upper bound
    let candidate = format!("{stem} ({copy_index}){suffix}");
    if !exists(&candidate) { return candidate; }
    copy_index += 1;
}
```

**Fix:** Cap at a reasonable limit (e.g. 100 iterations) and fall back to a UUID suffix.

---

### BUG-G12: Trash restore — misleading error message masks real filesystem error

**Severity:** Low  
**File:** `src-tauri/src/commands/notes.rs:176–181`

**Description:**  
If `resolve_restore_directory` returns a non-writable path, `create_dir_all` succeeds but `fs::rename` fails with a permission error. The error is surfaced as a generic `TessellumError::Io` with no path context, and the user sees an uninformative toast with no indication of whether the failure was due to permissions, a missing directory, or a name conflict.

---

## 4. Full Codebase Scan — Rust Backend

---

### BUG-R1: `todo!()` in trash command causes a panic on database timeout

**Severity:** Critical (Panic)  
**File:** `src-tauri/src/commands/notes.rs:654`

**Description:**  
The trash operation wraps a database call in a 5-second timeout. The `Err` branch (timeout exceeded) calls `todo!()` — a macro that unconditionally panics and crashes the Tauri backend. On any slow disk, locked database, or antivirus scan that delays SQLite access beyond 5 seconds, trashing any file causes the backend to crash and the frontend to freeze.

```rust
match timeout(Duration::from_secs(5), db.delete_file(&item_path)).await {
    Ok(Ok(())) => {}
    Ok(Err(_)) => {}, // DB error silently swallowed
    Err(_) => todo!() // ← PANIC if DB takes > 5 seconds
}
```

**Fix:** Replace `todo!()` with a proper error return:
```rust
Err(_) => return Err(TessellumError::Validation(
    "Database timeout during trash operation".into()
)),
```
Also propagate the `Ok(Err(e))` branch rather than swallowing the database error.

---

### BUG-R2: File write is not atomic — content and index can permanently diverge

**Severity:** Critical  
**File:** `src-tauri/src/commands/notes.rs:809–812`

**Description:**  
The save pipeline writes the file first, then updates the database. If the database step fails (disk full, lock timeout, constraint violation), the file on disk has new content but the search index is permanently stale. On the next app launch, the indexer may not detect any change (same-second mtime) and the inconsistency persists indefinitely.

```rust
tokio::fs::write(&path, &content).await?;        // file written
let delta = index_note_content(...).await?;       // if this fails, out of sync
```

**Fix:** Write to a temporary file first (`path.with_extension(".tmp")`), update the database, then atomically `fs::rename` the temp file over the original. If the database step fails, delete the temp file — the original is untouched.

---

### BUG-R3: Rename only rewrites flat wikilinks — path-style and case-change links silently break

**Severity:** High  
**File:** `src-tauri/src/commands/vault.rs:252–262`

**Description:**  
When a note is renamed, `rewrite_backlinks` is only called when the file stem changes, and the rewrite only handles `[[OldName]]` flat-style links. Two cases are silently missed:

1. **Path-style wikilinks:** `[[Folder/OldName]]` is not rewritten to `[[Folder/NewName]]`.
2. **Case-only renames:** The comparison `os != ns` is case-sensitive. On Windows (case-insensitive filesystem), renaming `Note` to `note` produces `os == ns` so the rewrite is skipped entirely, leaving all backlinks pointing to `[[Note]]` while the file is now `note.md`.

```rust
if os != ns { // case-sensitive — misses "Note" → "note" on Windows
    rewrite_backlinks(&backlinks, os, ns).await?;
    // rewrites [[OldName]] but NOT [[Folder/OldName]]
}
```

Additionally, after `rewrite_backlinks` modifies files (line 260), the full-text search index is **not updated** for those files. Search results show stale snippets containing the old wikilink text after any rename.

**Fix:** The rewrite regex should also match `[[*/OldName]]` (any folder prefix ending with `/`). Case comparison should use case-insensitive matching. After rewriting, trigger re-indexing for all modified files.

---

### BUG-R4: Path validation runs after directory creation — path traversal window

**Severity:** High  
**File:** `src-tauri/src/commands/notes.rs:530–538`

**Description:**  
For daily notes and template-based note creation, the parent directory is created on the filesystem before the path is validated to be inside the vault:

```rust
if let Some(parent) = full_path.parent() {
    tokio::fs::create_dir_all(parent).await?;    // directory CREATED first
    let parent_str = normalize_path(&parent...);
    validate_path_in_vault(&parent_str, &vault_path)?; // validated AFTER
}
```

A crafted template name like `../../outside/Evil` causes directories to be created outside the vault before the error is returned. The directories are not cleaned up on failure.

**Fix:** Validate the fully resolved path against `vault_path` before calling `create_dir_all`. Swap the order of the two operations.

---

### BUG-R5: TOCTOU race on trash directory creation

**Severity:** High  
**File:** `src-tauri/src/commands/notes.rs:623–628`

**Description:**  
The code checks whether the trash directory exists before creating it, which is a classic check-then-act race. Additionally, `generate_unique_trash_path` checks candidate name existence before the caller performs the rename — another TOCTOU window between the check and the filesystem operation.

```rust
if !trash_dir.exists() {
    fs::create_dir_all(&trash_dir)?; // another thread may have created it here
}
```

**Fix:** Remove the `if !exists` guard. `create_dir_all` is idempotent and already succeeds when the directory exists. For the uniqueness loop, use a random suffix on conflict rather than incrementing — handle the `AlreadyExists` error on the final rename as a retry trigger.

---

### BUG-R6: Frontmatter-only changes are not re-indexed when saved within the same second

**Severity:** Medium  
**File:** `src-tauri/src/indexer.rs:75–79`

**Description:**  
The indexer decides whether to re-process a file by comparing `modified_time`. On fast disks or with burst saves, a file's mtime can be unchanged within the same second — so a frontmatter-only edit (tags, status, date) is silently missed by the periodic indexer pass.

```rust
Some((db_modified, _)) => *modified_time > *db_modified, // misses same-second saves
```

**Fix:** Use nanosecond-precision mtime, or — better — call `index_note_content` directly from `write_file` (which already does this for single-file saves) rather than relying solely on the periodic indexer pass.

---

### BUG-R7: DB transaction commits after filesystem mutation — no rollback path on commit failure

**Severity:** Medium  
**File:** `src-tauri/src/db.rs:236–324`

**Description:**  
`update_file_path` runs multiple SQL updates inside a transaction. The caller (the rename command) has already moved the file on the filesystem before this function runs. If `tx.commit()` fails, the file is at the new location but the database still holds the old path — a permanent inconsistency with no recovery path.

**Fix:** Move the filesystem rename so it occurs after the database commit succeeds. Use the write-to-temp-and-rename pattern so the operation can be reversed if the commit fails.

---

### BUG-R8: Concurrent `full_sync` calls — SQLite and Tantivy writes can interleave

**Severity:** Medium  
**File:** `src-tauri/src/indexer.rs:165–183`

**Description:**  
No in-progress guard prevents the filesystem watcher from triggering a second `full_sync` while a manual rebuild is running. The Tantivy lock is held only during the search-phase, not during the SQLite writes — both syncs can write to SQLite simultaneously, then race for the Tantivy lock. This leaves the search index temporarily inconsistent with the database.

**Fix:** Add an `Arc<AtomicBool>` in-progress flag. If already syncing, debounce and re-trigger after completion.

---

### BUG-R9: Files deleted from the vault root are restored into a folder named "root"

**Severity:** Medium  
**File:** `src-tauri/src/commands/notes.rs:97, 120`

**Description:**  
Files deleted from the vault root are given the label `"root"` in their trash name. The restore function has a guard for this at line 97, but if the label encoding differs by even one character, the fallback at line 120 creates a physical folder literally named `root` at the vault root and places the file inside it.

```rust
.unwrap_or_else(|| vault_root.join(parent_label))
// when parent_label == "root" and the line-97 guard fails:
// creates   Vault/root/FileName.md  instead of  Vault/FileName.md
```

**Fix:** After the `WalkDir` search finds no candidates and `parent_label` equals `"root"` (case-insensitive), return `vault_root` directly instead of `vault_root.join("root")`.

---

## 5. Full Codebase Scan — Editor Extensions

---

### BUG-E1: Task list checkbox toggle logic naming is ambiguous and error-prone

**Severity:** High  
**File:** `src/components/Editor/extensions/task-list/task-list-parser.ts:56`

**Description:**  
`getToggledTaskMarker` receives a `checked: boolean` parameter and returns the opposite marker. The parameter name is ambiguous — it is unclear whether `checked` means the *current* state or the *desired new* state. If any call site ever passes the desired state rather than the current state, the toggle will be inverted, checking boxes when the user clicks to uncheck and vice versa.

```typescript
export function getToggledTaskMarker(_marker: string, checked: boolean): string {
    return checked ? "- [ ]" : "- [x]";
    // If checked == current state: returns opposite (correct)
    // If checked == desired state: returns same (inverted behaviour)
}
```

The unused `_marker` parameter also suggests the function signature was changed at some point, adding to the ambiguity.

**Fix:** Rename the parameter to `currentlyChecked` and add a comment: `// returns the marker for the OPPOSITE (toggled) state`. Verify all call sites pass the current state, not the desired state.

---

### BUG-E2: Greedy backtick parser copy-pasted into three files — wikilinks appear inside code spans

**Severity:** Medium  
**Files:** `src/components/Editor/extensions/wikilink/wikiLink-parser.ts`, `src/components/Editor/extensions/markdown-preview-plugin.ts`, `src/components/Editor/extensions/media-embed-plugin.ts`

**Description:**  
Identical `collectInlineCodeTextSpans` logic exists in three separate files. The shared bug: when an opening backtick run has no matching closing run (mismatched length or genuinely unclosed), the parser sets `inCode = true` and never resets it. At end-of-line it creates a span that extends to the end of the line, which can suppress wikilink decoration, Markdown syntax hiding, and media embed rendering for the remainder of that line.

```typescript
// same code in all three files:
if (inCode && codeStart >= 0) {
    spans.push({ from: codeStart, to: lineText.length }); // extends to EOL
}
```

For text like `` `code `` [[WikiLink]] ``, the single opening backtick opens a code span, the double backtick doesn't close it (different length), and the `[[WikiLink]]` is treated as inside a code span, rendering invisibly.

**Fix:** Extract to `src/utils/inlineCodeSpans.ts`. Fix once: when a backtick run of a different length than the opening delimiter is encountered, reset `inCode = false` and restart scanning from that run (it may be a new opener). Import in all three files.

---

### BUG-E3: Terminal callout syntax highlighting shifts on CRLF line endings (Windows)

**Severity:** Medium  
**File:** `src/components/Editor/extensions/callout/callout-plugin.ts:151–189`

**Description:**  
The terminal syntax highlighter joins content lines with `"\n"` (LF) and calculates character offsets assuming single-byte newlines. On Windows, if the vault file was saved with CRLF line endings, the document character positions are off by one per line after the first — causing syntax highlight marks to appear one character to the left of their correct position.

```typescript
lineStart += len + 1; // assumes \n (1 byte); CRLF adds another byte
```

**Fix:** Normalise to LF before joining: `lines.map(l => l.replace(/\r$/, '')).join('\n')`. Or use the document's own line position objects rather than manually tracking `lineStart`.

---

### BUG-E4: Frontmatter and task-list React widgets — deferred unmount causes remount race

**Severity:** Medium  
**Files:** `src/components/Editor/extensions/frontmatter/frontmatter-widget.tsx:476–481`, `src/components/Editor/extensions/task-list/task-list-plugin.tsx:85–94`

**Description:**  
Both widgets defer `root.unmount()` inside `setTimeout(..., 0)` to avoid a React synchronous-unmount warning. Between the `setTimeout` being scheduled and it firing, CodeMirror may have already created a new widget instance at the same DOM position:

```typescript
destroy(): void {
    const root = this.root;
    this.root = null;
    if (root) {
        setTimeout(() => root.unmount(), 0); // fires AFTER new widget may exist
    }
}
```

React 18's `createRoot` does not allow unmounting a root that has been adopted by a new render — this produces a React warning and may leave the new widget's state corrupted.

**Fix:** Set a `destroyed = true` flag synchronously in `destroy()`. Check `if (!this.destroyed) root.unmount()` inside the timeout. For cases where synchronous unmount is safe, use React 18's `flushSync`.

---

### BUG-E5: Table formatter miscalculates column width when cells contain escaped pipes

**Severity:** Low  
**File:** `src/components/Editor/extensions/table/table-navigation.ts:29–128`

**Description:**  
Column width is measured as `cell.length` after trimming. An escaped pipe `\|` is 2 characters in source but renders as 1 character in the table output. After auto-formatting, the column is padded 1 space too wide per escaped pipe in the widest cell of that column, causing misalignment.

**Fix:** Count display width for padding purposes: `cell.replace(/\\\|/g, '|').length`, while keeping the original string for the actual output.

---

## 6. Full Codebase Scan — Stores & Hooks

---

### BUG-S1: vaultPath stored under the unprefixed key `"vaultPath"` — clashes with any other library

**Severity:** High  
**File:** `src/stores/vaultStore.ts:53, 61, 63`

**Description:**  
Every other Tessellum store uses namespaced localStorage keys such as `"tessellum:appearance:accent"`. The vault path is stored under the bare, generic key `"vaultPath"`:

```typescript
vaultPath: localStorage.getItem("vaultPath"),
localStorage.setItem("vaultPath", path);
localStorage.removeItem("vaultPath");
```

Any third-party dependency, browser extension, or future library that happens to use the same key name can silently corrupt the vault path. This is also a maintenance trap — any future namespacing migration must account for the anomaly.

**Fix:** Change to `"tessellum:vault:path"`. Add a one-time migration: on load, if the new key is absent but the old key is present, copy the value and delete the old key.

---

### BUG-S2: Theme schedule timer closes over stale setting values

**Severity:** Medium  
**File:** `src/hooks/useApplyThemeSchedule.ts:231–241`

**Description:**  
The effect captures `themeScheduleLightStart` and `themeScheduleDarkStart` into closures that are used by a periodic timer. The dependency array is correct, so the effect re-runs when settings change — but the timer that fires between two setting changes (even a fraction of a second apart) uses the old closure values and may apply the wrong schedule.

```typescript
const applyCustomSchedule = () => {
    const lightStart = parseTimeToMinutes(themeScheduleLightStart, 8 * 60);
    // stale if user changed the setting before this timer fires
};
```

**Fix:** Read live values from the store inside the timer callback:
```typescript
const { themeScheduleLightStart } = useAppearanceStore.getState();
```
This always reads the current value regardless of closure capture timing.

---

### BUG-S3: `applyThemeAccent` snapshots appearance state once but acts on a stale check

**Severity:** Medium  
**File:** `src/stores/themeStore.ts:69–80`

**Description:**  
The function reads `useAppearanceStore.getState()` once at the start and caches the result. It then checks the cached `accentSource` later in the function. If another store update fires between the snapshot and the check (e.g. the user switches the accent source to "custom"), the stale cached value will cause the theme accent to be applied when it should not be.

```typescript
const appearance = useAppearanceStore.getState(); // snapshot
// ... other logic ...
if (appearance.accentSource !== "theme") return; // stale check
```

**Fix:** Call `useAppearanceStore.getState().accentSource` at the point of use rather than caching the entire state object at function entry.

---

### BUG-S4: navigationHistoryStore — `isReplaying` flag not set atomically with entry application

**Severity:** Medium  
**File:** `src/stores/navigationHistoryStore.ts:124–128`

**Description:**  
`goBack()` sets `isReplaying: true` in one `set()` call, then calls `applyEntry()` (which mutates vault and graph stores), then updates the cursor in another `set()` call. Any synchronous subscription to those intermediate store mutations that fires the history-record hook will see `isReplaying: true` and be suppressed correctly — but any async hop between the three operations creates a window where a navigation event can slip through and be recorded as a new history entry during a replay.

**Fix:** Use Zustand's `unstable_batchedUpdates` or React 18's automatic batching to wrap flag set + applyEntry + cursor update as a single atomic update visible to all subscribers.

---

## 7. Full Codebase Scan — UI Components

---

### BUG-C1: Closing a tab with unsaved changes silently discards all edits

**Severity:** High  
**File:** `src/components/Editor/Editor.tsx:777–778`

**Description:**  
The tab close handler calls `closeTab(id)` with no dirty-state check:

```typescript
const handleTabClose = (id: string) => {
    closeTab(id); // no unsaved-changes guard
};
```

The editor shows a dirty indicator (a dot next to the tab title), but there is no confirmation dialog. Clicking the × button on a tab with unsaved content permanently discards all edits for that note. There is no undo.

**Fix:** Before calling `closeTab`, check if the note has unsaved changes. If it does, show a small confirmation dialog ("Discard unsaved changes to *Note Name*?") with Discard and Cancel buttons. Auto-save on tab close is an alternative, but should be a user-configurable preference.

---

### BUG-C2: Search results keyed by array index — React reuses wrong DOM nodes on result change

**Severity:** High  
**File:** `src/components/Search/SearchPanel.tsx:474`

**Description:**  
Each search result is keyed by `${result.type}-${idx}` where `idx` is the array index. When the result set changes (new query, filter applied), items shift positions. React sees the same key at position 0, believes it is the same element, and reuses the DOM node — potentially carrying over stale hover state, scroll position, or focus from the previous result set.

```tsx
results.map((result, idx) => (
    <div key={`${result.type}-${idx}`}> // index-based — wrong
))
```

**Fix:** `key={`${result.fullPath}-${result.type}`}` — stable across re-renders because it is derived from data identity, not array position.

**Same pattern also in:** `TemplatePicker.tsx:222` (template list), `SidebarContextMenu.tsx:93` (context menu items).

---

### BUG-C3: Search query with special characters sent to Tantivy unescaped — silent zero results

**Severity:** Medium  
**File:** `src/components/Search/SearchPanel.tsx:321`

**Description:**  
Query terms are split and forwarded to the Rust backend without sanitisation. Characters meaningful in Tantivy query syntax (`+`, `-`, `:`, `"`, `(`, `)`, `[`, `]`, `^`, `~`, `*`, `?`) are forwarded as-is. Queries like `c++`, `(algorithm)`, or `key:value` silently return 0 results or trigger a backend error, with no user-facing explanation.

```typescript
terms.push(part); // no sanitisation
invoke("search_full_text", { request: { query: terms.join(" ") } });
```

**Fix:** Escape Tantivy special characters before building the query string:
```typescript
term.replace(/[+\-:!"()\[\]{}^~*?\\\/]/g, '\\$&')
```
Or switch to a "simple query" parser mode on the Rust side that treats all input as literal text.

---

### BUG-C4: Appearance settings — free-text hex colour input accepts invalid values silently

**Severity:** Low  
**File:** `src/components/Settings/AppearanceSettings.tsx:307`

**Description:**  
A colour picker is paired with a free-text input for the hex value. The colour picker enforces valid hex via the browser's native `type="color"` input, but the adjacent text input does not validate:

```tsx
<input type="text" onChange={(e) => {
    setAccentColor(e.target.value); // accepts "hello", "#gg0000", "red"
}} />
```

Invalid values are stored in localStorage and silently fail to apply — the CSS variable is set to an invalid colour string, the UI shows the bad string in the input, and the actual accent colour does not change. No error indicator is shown.

**Fix:** Validate on change:
```typescript
if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(e.target.value)) {
    setAccentColor(e.target.value);
}
```
Show a red border on the text input when the entered value is not a valid hex colour.

---

## 8. Bug Priority Matrix

The following table summarises all bugs by fix priority. The recommended order is: panics first (risk of data loss or crash), then silent data corruption, then user-visible behaviour bugs, then polish.

| Priority | ID | Description | File | Severity |
|---|---|---|---|---|
| 1 | BUG-R1 | `todo!()` panic on DB timeout in trash | `notes.rs:654` | Critical |
| 2 | BUG-R2 | Non-atomic file write — content/index diverge permanently | `notes.rs:809` | Critical |
| 3 | BUG-C1 | Tab close discards unsaved edits silently | `Editor.tsx:777` | High |
| 4 | BUG-E1 | Task toggle logic ambiguous — may be inverted | `task-list-parser.ts:56` | High |
| 5 | BUG-R4 | Path validation after dir creation (traversal) | `notes.rs:530` | High |
| 6 | BUG-R3 | Rename misses path-style and case-change wikilinks | `vault.rs:252` | High |
| 7 | BUG-G1 | vaultStore reads localStorage with no validation | `vaultStore.ts:53` | High |
| 8 | BUG-S1 | vaultPath stored under unprefixed localStorage key | `vaultStore.ts:53` | High |
| 9 | BUG-C2 | Search results keyed by array index | `SearchPanel.tsx:474` | High |
| 10 | BUG-U1 | Reduced motion toggle clears active theme | `accessibilityStore.ts:79` | High |
| 11 | BUG-U2 | Fenced blocks break inside callouts | `callout-parser.ts:7` | High |
| 12 | BUG-U3 | Graph media nodes: wrong label + double-click creates .md | `graph.rs:42` + `GraphView.tsx:102` | High |
| 13 | BUG-G5 | EditorView registration useEffect wrong dependency | `Editor.tsx:59` | Medium |
| 14 | BUG-G3 | Media embed in-flight invoke not cancelled on view destroy | `media-embed-plugin.ts:522` | Medium |
| 15 | BUG-G4 | isDirty flag cleared after subsequent keystroke | `useEditorActions.ts:123` | Medium |
| 16 | BUG-G9 | Concurrent full_sync interleaves SQLite/Tantivy writes | `indexer.rs:165` | Medium |
| 17 | BUG-G10 | searchStore does not catch invoke errors | `searchStore.ts:135` | Medium |
| 18 | BUG-R6 | Frontmatter-only changes not re-indexed same-second | `indexer.rs:75` | Medium |
| 19 | BUG-R7 | DB transaction commit after filesystem mutation | `db.rs:236` | Medium |
| 20 | BUG-R8 | Concurrent full_sync — no in-progress guard | `indexer.rs:165` | Medium |
| 21 | BUG-R9 | Root-level files restored into "root" folder | `notes.rs:120` | Medium |
| 22 | BUG-E2 | Greedy backtick parser in 3 files — wikilinks in code spans | `wikiLink-parser.ts` | Medium |
| 23 | BUG-E3 | Terminal callout highlight shifts on CRLF (Windows) | `callout-plugin.ts:151` | Medium |
| 24 | BUG-E4 | Frontmatter/task-list React widget unmount race | `frontmatter-widget.tsx:476` | Medium |
| 25 | BUG-S2 | Theme schedule timer closes over stale settings | `useApplyThemeSchedule.ts:231` | Medium |
| 26 | BUG-S3 | applyThemeAccent reads stale appearance state | `themeStore.ts:69` | Medium |
| 27 | BUG-S4 | navigationHistoryStore isReplaying not set atomically | `navigationHistoryStore.ts:124` | Medium |
| 28 | BUG-C3 | Search query special chars sent to Tantivy unescaped | `SearchPanel.tsx:321` | Medium |
| 29 | BUG-G2 | appearanceStore terminal colour written in two localStorage calls | `appearanceStore.ts:214` | Medium |
| 30 | BUG-G7 | PDF export swallows structured error | `markdownPdfExport.ts:25` | Medium |
| 31 | BUG-G8 | Clipboard import ignores skippedCount / vault refresh failure | `clipboardImport.ts:54` | Medium |
| 32 | BUG-U4 | Wikilinks display full path instead of last segment | `wikiLink-parser.ts:100` | Medium |
| 33 | BUG-U5 | Trash restore loses full folder path hierarchy | `trash.rs:27` | Medium |
| 34 | BUG-G6 | TabStrip drag handler captures stale tab order | `TabStrip.tsx:144` | Medium |
| 35 | BUG-R5 | TOCTOU race on trash directory creation | `notes.rs:623` | Medium |
| 36 | BUG-E5 | Table formatter miscounts escaped pipe width | `table-navigation.ts:29` | Low |
| 37 | BUG-G11 | `next_available_name` unbounded loop on collision | `clipboard.rs:42` | Low |
| 38 | BUG-G12 | Trash restore misleading error message | `notes.rs:176` | Low |
| 39 | BUG-C4 | Accent colour text input accepts invalid hex | `AppearanceSettings.tsx:307` | Low |

---

*Analysis performed on branch `fix/Pdf-Export-With-Images` as of 2026-06-18. Line numbers are approximate and should be verified against the current HEAD before implementing fixes.*
