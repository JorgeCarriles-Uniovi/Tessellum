# Tessellum — Full Technical Analysis

*Refreshed 2026-07-30. Supersedes the 2026-06-18 version.*

This document consolidates a **Tessellum 2.0 feature proposal** (updated to reflect what has since shipped) and a **live bug report** (concrete defects found by reading the source code). Every finding cites the actual file path and line range.

> **Citation baseline — read before following any line number.** Line numbers are against the **working tree as of 2026-07-31** on branch `New-UI`, *not* against a commit. At the time of the audit the working tree carried uncommitted changes to six source files — `src-tauri/src/commands/notes.rs`, `src-tauri/src/trash.rs`, `src/components/Editor/extensions/frontmatter/frontmatter-widget.tsx`, `src/components/GraphView/LocalGraphPanel.tsx`, `src/components/Layout/RightSidebar.tsx`, `src/components/ai/VaultQAPanel.tsx` — so citations into those files will **not** line up with the last commit (`37faba9`). The drift is material: `LocalGraphPanel.tsx`'s `handleNodeDoubleClick` is at line 137 in the working tree but line 120 at `37faba9`, and `notes.rs:232` is a different function at `37faba9`. Re-check every line number against your own tree before implementing a fix; the surrounding code quoted in each finding is the reliable anchor.

The 2026-06-18 audit tracked 39 findings (`BUG-U1`–`U5`, `BUG-G1`–`G12`, `BUG-R1`–`R9`, `BUG-E1`–`E5`, `BUG-S1`–`S4`, `BUG-C1`–`C4`). This refresh re-verified all 39 against current code and additionally audited three areas that did not exist at the time of the previous audit: the **HTML Preview plugin**, the **Graph View / Mosaic redesign**, and the **Vault Switcher / recent-vaults** feature.

**Headline numbers:** 32 of 39 old findings are fixed. 7 remain open (2 fully unchanged, 5 partially addressed with a residual gap). A further 2 findings outside the old ID set were confirmed open during this session's earlier trash/restore work (`CONFIRMED-TRASH-1`, `CONFIRMED-TRASH-2`), and 27 new findings were discovered. Total currently-open findings as of that refresh: **36** (7 + 2 + 27).

**Update — `fix/audit-2026-07-31-open-findings`:** the security-and-high-severity remediation branch (`docs/superpowers/plans/2026-07-31-security-and-high-severity-remediation.md`) has since closed 7 of those 36 in full — `NEW-STORES-1`, `BUG-C1`, `NEW-GRAPH-1`, `BUG-C2`, `NEW-HTMLPREVIEW-1`, `NEW-HTMLPREVIEW-3`, `NEW-HTMLPREVIEW-4` (see section 3) — and surfaced 2 new findings during the work, `NEW-BACKEND-5` and `NEW-UI-1`. `NEW-HTMLPREVIEW-2` is only partially closed by the same branch and remains open (see its section 2.6 entry). Net: 36 − 7 + 2 = **31 currently-open findings** (29 defects + 2 verification/coverage records — see section 4).

---

## Changelog Since 2026-06-18

### Fixed since the last audit (32)

- **BUG-U1** (Reduced Motion toggle clears the active theme) — fixed, see `src/hooks/useApplyAccessibilitySettings.ts:35-43`.
- **BUG-U2** (fenced blocks break callout rendering) — fixed, see `src/components/Editor/extensions/callout/callout-parser.ts:41-80`.
- **BUG-U3** (graph media nodes: wrong label, double-click creates `.md`) — fixed **in the global Graph View only**, see `src-tauri/src/commands/graph.rs:30-48` and `src/components/GraphView/GraphView.tsx:144-185`. The Local Graph panel reproduced it separately (tracked as `NEW-GRAPH-1`); that regression was since closed by the `fix/audit-2026-07-31-open-findings` branch via a shared `resolveGhostNodeTarget` helper — see section 3.
- **BUG-U4** (wikilinks display the full path) — fixed, see `src/components/Editor/extensions/wikilink/wikiLink-parser.ts:40-68`.
- **BUG-U5** (trash restore remembers only the immediate parent folder) — fixed, see `src-tauri/src/trash.rs` (`generate_trash_name`, now encoding the full relative directory as `p=<encoded-rel-dir>`). Tracked in this refresh as `CONFIRMED-TRASH-4`.
- **BUG-G1** (vaultStore reads localStorage path with no validation) — fixed downstream, see `src/hooks/useVaultSession.ts:120-134`.
- **BUG-G2** (terminal colours written in two localStorage calls) — fixed, see `src/stores/appearanceStore.ts:185-187, 270-280`.
- **BUG-G3** (media embed in-flight invoke not cancelled) — fixed, see `src/components/Editor/extensions/media-embed-plugin.ts:511-612`.
- **BUG-G4** (`isDirty` cleared after a subsequent keystroke) — fixed, see `src/components/Editor/hooks/useEditorActions.ts:121-137`.
- **BUG-G5** (EditorView registered with a ref value as dependency) — fixed, see `src/components/Editor/Editor.tsx:70-88`. See the classification note below.
- **BUG-G6** (TabStrip drag handler captures stale tab order) — fixed, see `src/components/Editor/TabStrip.tsx:93-99, 131-176`.
- **BUG-G7** (PDF export swallows the actual error) — fixed, see `src/features/pdfExport/markdownPdfExport.ts:35-52`.
- **BUG-G8** (clipboard import ignores `skippedCount`) — fixed, see `src/features/clipboard/clipboardImport.ts:75-94`.
- **BUG-G9** (concurrent `full_sync` interleaves SQLite/Tantivy writes) — fixed, see `src-tauri/src/commands/indexer.rs:49-107`.
- **BUG-G10** (`searchStore.syncReadiness` does not catch invoke errors) — fixed, see `src/stores/searchStore.ts:139-155`.
- **BUG-G11** (`next_available_name` has no upper bound) — fixed, see `src-tauri/src/commands/clipboard.rs:43-56`.
- **BUG-R1** (`todo!()` panic on DB timeout in trash) — fixed, see `src-tauri/src/commands/notes.rs:712-716`.
- **BUG-R2** (non-atomic file write — content and index diverge) — fixed, see `src-tauri/src/commands/notes.rs:867-887`.
- **BUG-R4** (path validation runs after directory creation) — fixed, see `src-tauri/src/commands/notes.rs:268-284, 289-303`.
- **BUG-R8** (duplicate of BUG-G9 — concurrent `full_sync` guard) — fixed, see `src-tauri/src/commands/indexer.rs:49-107`.
- **BUG-R9** (root-level files restored into a folder named "root") — fixed, see `src-tauri/src/commands/notes.rs:114-128`.
- **BUG-E1** (task list toggle logic ambiguous) — fixed, see `src/components/Editor/extensions/task-list/task-list-parser.ts:52-58`.
- **BUG-E2** (greedy backtick parser duplicated in three files) — fixed, see `src/utils/inlineCodeSpans.ts:12-53`.
- **BUG-E3** (callout syntax highlighting shifts on CRLF) — fixed, see `src/components/Editor/extensions/callout/callout-plugin.ts:144-193`.
- **BUG-E4** (frontmatter/task-list widget deferred-unmount race) — fixed, see `src/components/Editor/extensions/frontmatter/frontmatter-widget.tsx:451, 480-489` and `src/components/Editor/extensions/task-list/task-list-plugin.tsx:54, 86-97`.
- **BUG-E5** (table formatter miscounts escaped pipe width) — fixed, see `src/components/Editor/extensions/table/table-navigation.ts:37-47`.
- **BUG-S1** (`vaultPath` stored under the unprefixed key) — fixed, see `src/stores/vaultStore.ts:54, 78-89`.
- **BUG-S2** (theme schedule timer closes over stale settings) — fixed, see `src/hooks/useApplyThemeSchedule.ts:118-127`.
- **BUG-S3** (`applyThemeAccent` acts on a stale snapshot) — fixed, see `src/stores/themeStore.ts:69-79`.
- **BUG-S4** (`isReplaying` flag not set atomically) — fixed, see `src/stores/navigationHistoryStore.ts:124-128`.
- **BUG-C3** (search query special characters sent to Tantivy unescaped) — fixed, see `src/components/Search/SearchPanel.tsx:201-225`.
- **BUG-C4** (accent colour text input accepts invalid hex) — fixed, see `src/components/Settings/AppearanceSettings.tsx:68-69, 305-323`.

### Changed since the last audit — partially fixed, residual gap remains (5)

These are **not** closed. Each has a full writeup in section 2.

- **BUG-R3** — the two silent-miss cases (path-style wikilinks, case-only renames) are fixed; the rewritten backlink **source** files are still not re-indexed immediately. Full writeup: [§2.2](#22-rust-backend-commands--indexer).
- **BUG-R5** — the trash-directory `mkdir` race is fixed; the check-then-act gap between `generate_unique_trash_path` and the caller's `rename` remains. Full writeup: [§2.2](#22-rust-backend-commands--indexer).
- **BUG-R6** — the indexer now compares file size as well as mtime; a same-second, same-size frontmatter edit is still skipped. Full writeup: [§2.2](#22-rust-backend-commands--indexer).
- **BUG-C1** — closing the *active* tab with unsaved changes is now guarded by a confirm dialog; closing a **background** tab still discards edits silently. Full writeup: [§2.5](#25-ui-components--feature-slices). *(Since fully closed by the `fix/audit-2026-07-31-open-findings` branch — see section 3.)*
- **BUG-C2** — `SearchPanel` now keys on data identity; `TemplatePicker` and `SidebarContextMenu` still splice the array index into their keys. Full writeup: [§2.5](#25-ui-components--feature-slices). *(Since fully closed by the `fix/audit-2026-07-31-open-findings` branch — see section 3.)*

### Unchanged — still fully open (2)

- **BUG-G12** — trash-restore error messages still carry no path context (`src-tauri/src/commands/notes.rs:213-217`).
- **BUG-R7** — DB transaction still commits after the filesystem mutation, with no rollback path (`src-tauri/src/db.rs:247-335`).

### New areas audited for the first time

- **HTML Preview plugin** (commits `e4f8cce`..`37faba9`) — 6 findings.
- **Graph View / Mosaic redesign** — 4 new findings (one of them a High-severity regression of the fixed `BUG-U3`).
- **Vault Switcher / recent vaults** (commits `0487be1`, `8780866`) — 4 findings.
- **Trash/Restore** re-audit — 3 open findings beyond the fixed `BUG-U5`/`BUG-R9`.

### Classification note on BUG-G5

`BUG-G5` was reported by the UI-components audit as `CHANGED-SINCE`, but its writeup describes a fix that is complete with **no residual gap** — the landed mechanism (a no-dependency-array effect plus a `lastViewRef` change check) differs from the originally *suggested* callback-ref approach, but achieves the same guarantee, and the entry carries no `Fix` field because nothing remains to fix. It is reclassified here as **FIXED-SINCE**: `CHANGED-SINCE` in this document means "partially fixed, something still open", and reserving it for "fixed by a different means than we proposed" would put a closed item in the open-findings list and the priority matrix.

---

## Table of Contents

1. [Tessellum 2.0 — Feature Proposals](#1-tessellum-20--feature-proposals)
   - 1.1 [Intelligence](#11-intelligence)
   - 1.2 [Collaboration & Sync](#12-collaboration--sync)
   - 1.3 [Structure & Linking](#13-structure--linking)
   - 1.4 [Export & Publish](#14-export--publish)
   - 1.5 [Developer Tools](#15-developer-tools)
   - 1.6 [Platform](#16-platform)
2. [Currently Open Findings by Area](#2-currently-open-findings-by-area)
   - 2.1 [Trash / Restore](#21-trash--restore)
   - 2.2 [Rust Backend Commands & Indexer](#22-rust-backend-commands--indexer)
   - 2.3 [Editor Extensions](#23-editor-extensions)
   - 2.4 [Stores & Hooks](#24-stores--hooks)
   - 2.5 [UI Components & Feature Slices](#25-ui-components--feature-slices)
   - 2.6 [HTML Preview Plugin](#26-html-preview-plugin)
   - 2.7 [Graph View / Mosaic Redesign](#27-graph-view--mosaic-redesign)
   - 2.8 [Vault Switcher / Recent Vaults](#28-vault-switcher--recent-vaults)
3. [Fixed-Since-Last-Audit (Reference Only)](#3-fixed-since-last-audit-reference-only)
4. [Priority Matrix](#4-priority-matrix)

---

## 1. Tessellum 2.0 — Feature Proposals

Tessellum 1.x is a capable local-first Markdown editor. Version 2.0 should shift the application from a note-taking tool to a full **thinking environment** — one that helps users connect ideas, share knowledge, and extend the app through a public plugin ecosystem.

The three strategic bets:

1. **Intelligence without the cloud** — a local embedding pipeline (ONNX in Rust) powers semantic search, smart linking, and AI writing, all without sending data to any server.
2. **Continuity across devices** — version history and vault sync via user-owned storage (Git, WebDAV, iCloud) close the biggest usability gap for multi-device users.
3. **An open ecosystem** — stabilising the plugin SDK as `@tessellum/plugin-sdk` turns the internal plugin architecture into a platform that the community can extend.

**Status update (2026-07-30):** the great majority of this roadmap shipped between 2026-06-18 and now. Each item below is annotated **Shipped**, **Partially shipped**, or **Not started**, with a pointer to the implementation where one exists.

---

### 1.1 Intelligence

#### Semantic Search & Smart Linking — **Shipped**
Implemented in `src-tauri/src/commands/semantic.rs` (`semantic_search`, `get_link_suggestions`), landed 2026-06-19 (`943f71a`).

Remaining from the original proposal: orphan-note "similar to N others" suggestions are not surfaced in the UI.

#### Local AI Writing Assistant — **Shipped**
Implemented in `src-tauri/src/commands/ai.rs` (`ai_generate`) with provider configuration for Ollama / OpenAI / Claude in `src/stores/aiStore.ts` and `src/components/Settings/AISettings.tsx`.

> **Regression against the original design, since resolved:** the proposal specified the API key be "stored in the OS keychain". It was persisted in plaintext `localStorage` — tracked as `NEW-STORES-1`, formerly the highest-priority open finding in this document — until the `fix/audit-2026-07-31-open-findings` branch moved it into the OS credential store; see section 3.

#### Auto-Tagging & Concept Extraction — **Shipped**
Implemented in `src-tauri/src/commands/semantic.rs` (`suggest_tags`, `get_similar_tag_groups`, `merge_tags`), with the consolidation UI in `src/components/Settings/TagsSettings.tsx`.

Remaining: the graph view's "cluster by topic" layout uses tag co-occurrence (`computeTagClusters` in the Mosaic redesign), not embedding similarity.

#### Vault Q&A (RAG) — **Shipped**
Implemented in `src/components/ai/VaultQAPanel.tsx`, landed 2026-06-19 (`e050d8f`).

---

### 1.2 Collaboration & Sync

#### Multi-Device Vault Sync — **Partially shipped**
Git-backed sync is implemented in `src-tauri/src/commands/sync.rs` (`init_vault_repo`, `sync_commit`, `sync_pull`, `sync_push`, `get_conflict_list`, `full_git_sync`), configured via `src/components/Settings/SyncSettings.tsx`.

Not yet implemented: the WebDAV and local-folder adapters, and the three-way-diff conflict resolution UI (`get_conflict_list` returns conflicting paths but there is no diff surface for them).

> The git remote **password** was persisted in plaintext `localStorage` (`NEW-STORES-1`); since moved to the OS credential store by the `fix/audit-2026-07-31-open-findings` branch — see section 3.

#### Version History — **Shipped**
Implemented in `src-tauri/src/commands/history.rs` (`write_note_snapshot`, `list_note_snapshots`, `get_note_snapshot`, `pin_snapshot`, `unpin_snapshot`), with the UI in `src/components/history/` (`NoteHistoryPanel.tsx`, `DiffView.tsx`, `computeDiff.ts`). Snapshots are written in the background on every `write_file` (`src-tauri/src/commands/notes.rs:891-903`).

#### Shared Vaults (Read-Only Links) — **Not started**
No signed-link or S3/WebDAV upload path exists. The static-site export half of this proposal shipped separately (see 1.4), so this reduces to "host and sign the exported bundle".

---

### 1.3 Structure & Linking

#### Database Views (Dataview-style) — **Shipped**
Implemented end-to-end: `src-tauri/src/commands/dataview.rs`, the editor extension `src/components/Editor/extensions/code/dataview-plugin.tsx`, and the plugin registration `src/plugins/builtin/DataviewPlugin.ts`.

#### Canvas / Spatial View — **Shipped**
Implemented in `src/components/canvas/CanvasView.tsx` with `.canvas` JSON persistence.

> Canvas state is not torn down on vault switch — see `NEW-VAULTSWITCH-2`.

#### Note Properties Panel — **Partially shipped**
Frontmatter is editable as a structured form via `src/components/Editor/extensions/frontmatter/frontmatter-widget.tsx`.

Not yet implemented: the vault-level `properties.json` schema that would drive typed inputs (date/select/multi-select/number/checkbox), and the file-tree property hints.

---

### 1.4 Export & Publish

#### Static Site Publisher — **Shipped**
Implemented in `src-tauri/src/commands/publish.rs` (`publish_vault`), configured via `src/components/Settings/PublishSettings.tsx`.

Not yet implemented: one-click deploy targets (GitHub Pages / Cloudflare Pages) — the command emits a local bundle only.

#### Rich DOCX & Presentation Export — **Partially shipped**
DOCX export is implemented in `src-tauri/src/commands/export.rs` (`export_note_docx`). Reveal.js slide export and folder-level batch export are not implemented.

#### Import From Everywhere — **Partially shipped**
URL/web-page import is implemented (`src-tauri/src/commands/export.rs`, `import_from_url`), surfaced in `src/components/Settings/ExportImportSettings.tsx`. Notion, Obsidian, Roam, Bear and Apple Notes importers are not implemented.

---

### 1.5 Developer Tools

#### Public Plugin SDK & Marketplace — **Partially shipped**
A marketplace surface exists in `src/components/Settings/PluginsSettings.tsx`. The API in `src/plugins/api/` has not been extracted into a versioned `@tessellum/plugin-sdk` npm package (the repo is still a single `tessellum` package), and plugins run in-process rather than in a CSP-restricted iframe.

#### Automation & Scripting (Tessellum Scripts) — **Shipped**
Implemented in `src-tauri/src/commands/scripts.rs` (`list_scripts`, `read_script`, `write_script`, `delete_script`), with `src/components/Settings/ScriptsSettings.tsx`.

#### Mobile Companion App — **Not started**
No `src-tauri/gen/android` or `gen/apple` targets exist.

---

### 1.6 Platform

#### Incremental Indexing & Large-Vault Performance — **Partially shipped**
The indexer skips unchanged files using an `(mtime, size)` tuple (`src-tauri/src/indexer.rs:76-84`) rather than the proposed content hash — see `BUG-R6` for the residual correctness gap. Graph virtualisation shipped as part of the Mosaic redesign (`MAX_TILES = 200` in `src/components/GraphView/MosaicCanvas.tsx:14`) — see `NEW-GRAPH-4` for a performance issue in that code. Priority-queue background indexing and lazy Tantivy segment loading are not implemented.

#### Offline-Ready CLI — **Not started**
No `[[bin]]` target or `tessellum serve` mode exists.

---

## 2. Currently Open Findings by Area

31 findings. Each entry gives Severity, File(s), Description, Root cause where it differs from the description, and Fix.

---

### 2.1 Trash / Restore

#### CONFIRMED-TRASH-1: Restore fallback silently picks one of several same-named folders

**Status:** CONFIRMED-STILL-OPEN
**Severity:** Medium
**File:** `src-tauri/src/commands/notes.rs` (`resolve_restore_directory`, the `WalkDir` fallback branch, ~lines 130-148)

**Description:**
When the original folder recorded in the trash entry no longer exists, restore falls back to a `WalkDir` search for any directory whose name matches the last path segment, and picks the shallowest / lexicographically-first match. If the vault contains multiple folders with that name (e.g. several `Notes` folders under different projects), the note is silently restored into the wrong one.

**Root cause:**
The fallback treats a name match as sufficient identification, and `candidate_directory_priority` resolves ambiguity by heuristic rather than surfacing it.

**Fix:** When the fallback finds more than one candidate, surface a disambiguation choice to the user — or at minimum emit a warning naming the folder that was chosen — instead of silently picking one.

---

#### CONFIRMED-TRASH-2: Restore-triggered reindex bypasses the `sync_in_progress` guard

**Status:** CONFIRMED-STILL-OPEN
**Severity:** Medium
**File:** `src-tauri/src/commands/notes.rs:232` (`refresh_indexes_after_restore`)

**Description:**
`refresh_indexes_after_restore` calls `VaultIndexer::full_sync` directly instead of going through `run_sync_vault` (`src-tauri/src/commands/indexer.rs:49-107`), which is the entry point that holds the `sync_in_progress` `AtomicBool`. A restore that races a manual rebuild or a watcher-triggered sync can therefore still interleave SQLite and Tantivy writes — the exact failure mode `BUG-G9`/`BUG-R8` was fixed to prevent, reachable through a path the fix did not cover.

**Fix:** Route restore-triggered reindexing through `run_sync_vault`, the same guarded entry point used by manual and watcher-triggered syncs.

---

#### CONFIRMED-TRASH-3: No test coverage for nested-path, fallback-search, or legacy-marker restore

**Status:** NEW (test-coverage gap, not a defect in shipping behaviour)
**Severity:** Medium
**File:** `src-tauri/src/trash.rs` (tests at ~lines 351-609) and `src-tauri/src/commands/notes.rs` (tests at ~lines 1010-1152)

**Description:**
Existing restore tests only exercise the legacy `(Root)` / `(Folder)` bare-label format. There is no test for (a) restoring into a nested `p=Folder%2FSub`-encoded path, (b) the `WalkDir` fallback-search path, or (c) the legacy `p:` → `p=` marker decode path feeding into `resolve_restore_directory` end-to-end. The `p=` encoding is the fix for `BUG-U5` — the primary format in use today is the one with the least coverage.

**Fix:** Add integration tests covering all three paths.

---

#### CONFIRMED-TRASH-4: (superseded — see section 3)

`BUG-U5` from the 2026-06-18 audit is fixed; `generate_trash_name` in `src-tauri/src/trash.rs` now encodes the full relative directory as `p=<encoded-rel-dir>`. Retained here as a pointer only; the full entry is in [section 3](#3-fixed-since-last-audit-reference-only).

---

### 2.2 Rust Backend Commands & Indexer

#### BUG-G12: Trash-restore error messages carry no path context

**Status:** CONFIRMED-STILL-OPEN
**Severity:** Low
**File:** `src-tauri/src/commands/notes.rs:213-217`

**Description:**
`restore_trash_item_internal_for_tests` maps both `create_dir_all` and the restoring `fs::rename` straight through `TessellumError::Io`, which carries only the OS error's own text (e.g. `"Access is denied. (os error 5)"`). A permission failure, a missing or unwritable restore directory, and a genuine OS-level race all surface as the same uninformative message, with no indication of which path failed or why.

```rust
let restore_dir = resolve_restore_directory(vault_root, &parsed);
fs::create_dir_all(&restore_dir).map_err(TessellumError::Io)?;
let destination = build_restored_destination_path(&restore_dir, &parsed.original_name)
    .ok_or_else(|| TessellumError::Validation("Failed to resolve restore destination".to_string()))?;
fs::rename(&resolved_entry, &destination).map_err(TessellumError::Io)?;
```

**Fix:** Wrap these `map_err` calls with a message that names the source and destination, e.g. `TessellumError::Internal(format!("Failed to restore '{}' to '{}': {}", resolved_entry.display(), destination.display(), e))`.

---

#### BUG-R3 (remainder): Rewritten backlink source files are not re-indexed

**Status:** CHANGED-SINCE
**Severity:** Low
**File:** `src-tauri/src/commands/vault.rs:34-40` (regex), `:261` (rename guard), `:267` (the `rewrite_backlinks` call), `:289-319` (the re-index that covers only the renamed file)

**Description:**
Both original silent-miss cases are fixed. The rewrite regex now matches an optional folder prefix and is case-insensitive (`(?i)(\\?)\[\[([^\]|]*?/)?{escaped}(\|[^\]]+)?\]\]`, `vault.rs:38`), and the rename guard uses `!os.eq_ignore_ascii_case(ns)` (`vault.rs:261`), so `[[Folder/OldName]]` and `Note` → `note` renames are both rewritten. The regex also correctly skips backslash-escaped links.

What remains is the third part of the original finding: after `rewrite_backlinks` (called at `vault.rs:267`) writes the modified **source** files, only the *renamed* file is pushed back into Tantivy — the `spawn` block at `vault.rs:289-319` indexes `new_path_str` and nothing else. The files whose wikilink text just changed are never re-indexed by this command, so full-text search returns stale snippets containing the old wikilink until the filesystem watcher's next periodic `full_sync` notices their changed mtime.

**Root cause:** `rewrite_backlinks` returns `Ok(())` and its caller discards the list of files it actually modified.

**Fix:** Have `rewrite_backlinks` return the paths it wrote, and index those documents in the same `spawn` block that re-indexes the renamed file.

---

#### BUG-R5 (remainder): `generate_unique_trash_path` check-then-act gap before the caller's rename

**Status:** CHANGED-SINCE
**Severity:** Medium
**File:** `src-tauri/src/trash.rs:100-112` (`generate_unique_trash_path`), called from `src-tauri/src/commands/notes.rs:696-701`

**Description:**
The `if !trash_dir.exists()` mkdir race is fixed — `notes.rs:689` now unconditionally calls the idempotent `fs::create_dir_all(&trash_dir)`. The second half of the original finding is unchanged: `generate_unique_trash_path` picks a destination purely by looping on `candidate.exists()` and returns the `PathBuf` to the caller, which performs the `tokio::fs::rename` as a separate later step.

```rust
let mut candidate = trash_dir.join(&base_name);
let mut collision_index = 1;
while candidate.exists() {
    let next_name = with_collision_suffix(&base_name, collision_index);
    candidate = trash_dir.join(next_name);
    collision_index += 1;
}
Some(candidate)
```

Between the last `exists()` check and the caller's `rename`, a concurrent `trash_item` / `trash_items` call (or an external process) can create a file at that exact path; the rename then silently overwrites it or fails with a platform-specific error, instead of retrying with a fresh name.

**Classification note:** the source audit filed this as `CONFIRMED-STILL-OPEN`, but its own writeup states that the `if !trash_dir.exists()` mkdir race — one of the two halves of the original `BUG-R5` — is fixed. Since half the finding demonstrably landed, `CHANGED-SINCE` is the accurate status under this document's definition ("partially fixed, something still open"), and the closed half is recorded in [section 3](#3-fixed-since-last-audit-reference-only). This does not change the open-findings count: `BUG-R5` is open either way, at unchanged Medium severity, and its remaining work is exactly the `Fix` below.

**Fix:** Treat an `AlreadyExists`-class rename failure as a retry trigger — loop back into `generate_unique_trash_path` with a bumped collision index or a random suffix — rather than relying solely on the pre-check.

---

#### BUG-R6 (remainder): Same-second, same-size frontmatter edits are still skipped by the periodic indexer

**Status:** CHANGED-SINCE
**Severity:** Medium
**File:** `src-tauri/src/indexer.rs:76-84`

**Description:**
The re-index decision now compares file size as well as mtime, which catches same-second frontmatter edits that add or remove characters:

```rust
let needs_index = match db_files.get(path) {
    None => true, // New file
    // Re-index if mtime changed OR if mtime is equal but size changed
    // (handles same-second edits that only touch frontmatter).
    Some((db_modified, _, db_size)) => {
        *modified_time > *db_modified
            || (*modified_time == *db_modified && *db_size != *size as i64)
    }
};
```

An edit that changes frontmatter content while preserving the exact byte count — `status: draft` → `status: ready ` with padding, or swapping two same-length tag values — still has both `modified_time` and `size` identical to the DB record, and is silently skipped by `full_sync`.

**Root cause:** the `(mtime, size)` tuple is a proxy for "changed", not a proof of it.

**Scope note:** this is largely masked in the interactive app, because `write_file` calls `index_note_content` directly on every save. It matters for changes made outside the app (external editors, `git checkout`) and for vault sync/import flows that do not go through `write_file`.

**Fix:** Hash file content — or use nanosecond mtime where the filesystem supports it — instead of relying on `(mtime, size)`.

---

#### BUG-R7: DB transaction commits after the filesystem mutation, with no rollback path

**Status:** CONFIRMED-STILL-OPEN
**Severity:** Medium
**File:** `src-tauri/src/db.rs:247-335` (`update_file_path`), called from `src-tauri/src/commands/vault.rs:250-274` (`rename_file`) and `:392-403` (`move_items`)

**Description:**
Both `rename_file` and `move_items` perform the filesystem `rename` first and only afterward call `db.update_file_path`, whose transaction commits at `db.rs:333`.

```rust
// vault.rs — rename_file
tokio::fs::rename(old, &new_path).await.map_err(TessellumError::from)?;
...
db.update_file_path(&old_path, &new_path.to_string_lossy()).await.map_err(TessellumError::from)?;
```

If `tx.commit()` fails — disk full, DB locked, power loss — the file is at its new location but the database (and therefore backlinks and the graph) still reference the old path, with no recovery path.

**Fix:** Perform the DB update and commit first, then the filesystem rename, so a DB failure never leaves an already-moved file with stale index state; or add a compensating action that reverts the filesystem move when the commit fails.

---

#### NEW-BACKEND-1: `create_note_from_template` passes the destination folder, not the vault root, as `{{vault}}`

**Status:** NEW
**Severity:** Medium
**File:** `src-tauri/src/commands/templates.rs:120-121`

**Description:**
`apply_placeholders`'s third parameter is the vault path everywhere else it is called — see `get_or_create_daily_note` in `notes.rs`, which correctly passes `&vault_path`. `create_note_from_template` passes `&target_dir` (the note's destination subfolder) in that slot:

```rust
let processed_content =
    apply_placeholders(&template_content, &clean_title, &target_dir, Local::now());
```

Any template using the `{{vault}}` placeholder therefore renders the subfolder the note happens to be created in, and the value changes depending on where in the vault the user creates the note.

**Fix:** Pass `&vault_path` instead of `&target_dir` at `templates.rs:121`.

---

#### NEW-BACKEND-2: Template and asset filename-collision loops have no upper bound

**Status:** NEW
**Severity:** Low
**File:** `src-tauri/src/commands/templates.rs:110-118` and `src-tauri/src/commands/assets.rs:120-127`

**Description:**
Both `create_note_from_template` and `save_asset_inner` resolve name collisions with a `while path.exists() { ...; counter += 1 }` loop that has no iteration cap — unlike `clipboard.rs`'s `next_available_name`, which was fixed under `BUG-G11` to cap at 100 attempts with a timestamp fallback. A directory holding hundreds of same-titled notes or pasted assets (a plausible template-driven daily/meeting-notes workflow) makes every new-note and new-asset call perform a correspondingly growing number of blocking filesystem `exists()` checks.

**Fix:** Reuse — or factor out — the bounded-loop-plus-timestamp-fallback pattern already in `next_available_name`.

---

#### NEW-BACKEND-3: `create_folder` has a check-then-act race between the existence check and `create_dir`

**Status:** NEW
**Severity:** Low
**File:** `src-tauri/src/commands/folders.rs:33-41`

**Description:**
`create_folder` checks `folder_path.exists()` and returns a friendly `"Folder already exists"` error, then calls `tokio::fs::create_dir` as a separate step. If two folder-creation calls for the same name race (a double-submitted UI action, or a watcher/import path creating the directory concurrently), both can pass the `exists()` check before either creates it, and the loser surfaces a raw OS "already exists" `io::Error` as a generic string instead of the intended message — the same TOCTOU class as `BUG-R5`.

**Fix:** Treat `ErrorKind::AlreadyExists` from `create_dir` as the authoritative "already exists" signal, mapping it to the friendly message, rather than relying on the preceding `exists()` check to catch every case.

---

#### NEW-BACKEND-4: Watcher's `file-changed` emission failure is silently swallowed

**Status:** NEW
**Severity:** Low
**File:** `src-tauri/src/commands/watcher.rs:65`

**Description:**
Inside the `notify` callback, a debounced filesystem event triggers `app_handle_clone.emit("file-changed", ())` and discards the `Result` with `let _ =`. If emission fails — a serialization error, or the main window being torn down during a vault-switch race — the frontend never learns a file changed and nothing is logged, so the UI can go stale with no diagnostic trail.

**Fix:** Log the error branch: `if let Err(e) = app_handle_clone.emit("file-changed", ()) { log::warn!("Failed to emit file-changed: {}", e); }`.

---

#### NEW-BACKEND-5: `create_note`'s containment check validates the target directory against itself

**Status:** NEW
**Severity:** Medium
**File:** `src-tauri/src/commands/notes.rs:508` (`create_note`), called with a target subfolder (not the vault root) from `src/utils/noteUtils.ts:23-27` (`createNoteInDir`)

**Description:**
`create_note`'s only containment check is:

```rust
pub async fn create_note(
    state: State<'_, AppState>,
    kuzu_state: State<'_, ManagedGrafeoConnection>,
    vault_path: String,
    title: String,
) -> Result<String, TessellumError> {
    validate_path_in_vault(&vault_path, &vault_path).map_err(TessellumError::Validation)?;
```

`validate_path_in_vault(candidate, vault_root)` checks that `candidate` resolves inside `vault_root` — here both arguments are the same string, so the check reduces to "does `vault_path` resolve inside itself", which is trivially true no matter what `vault_path` contains. But `vault_path` is not always the vault root: `createNoteInDir` (`noteUtils.ts:24-27`) passes `vaultPath: targetDir`, i.e. the note's destination *subfolder*, in that slot. So the one caller this command exists for never gives `create_note` anything to validate the target directory against, and a target directory that traverses outside the vault gets no backend protection at all. The only thing currently stopping this is a frontend guard in `src/utils/graphNodeActions.ts` (`resolveGhostNodeTarget`); an in-vault symlink pointing outward, or any future caller that bypasses that helper, would reach `tokio::fs::write` (`notes.rs:536`) unchecked.

**Root cause:** the command has no separate vault-root parameter — the only value available to validate against is the same target-directory string being validated.

**Fix:** Pass the true vault root as a distinct parameter (as `ensure_daily_note_parent` does at `notes.rs:302`, calling `validate_path_in_vault(&parent_str, vault_path)` with `vault_path` as the *root*), and validate the target directory against that root instead of against itself.

---

### 2.3 Editor Extensions

#### NEW-EDITOR-1: Heading fold widget still has the deferred-unmount race that BUG-E4 fixed elsewhere

**Status:** NEW
**Severity:** Medium
**File:** `src/components/Editor/extensions/markdown-heading-fold.ts:163-170`

**Description:**
`HeadingFoldWidget.destroy()` unmounts its React root inside a bare `setTimeout(..., 0)` with no synchronous `destroyed` flag:

```typescript
destroy(): void {
    const iconRoot = this.iconRoot;
    this.iconRoot = null;
    if (iconRoot) {
        // Defer unmount to avoid React warning when CodeMirror tears down during a render pass.
        setTimeout(() => iconRoot.unmount(), 0);
    }
}
```

This is exactly the pattern `BUG-E4` identified and which was fixed in `frontmatter-widget.tsx` and `task-list-plugin.tsx`. If CodeMirror recreates a `HeadingFoldWidget` at the same document position before the timeout fires (rapid fold/unfold toggling, or an edit that leaves the fold decoration's `from`/`to` unchanged), the deferred `iconRoot.unmount()` can fire after a new root has already been created for that DOM node.

**Fix:** Add a `private destroyed = false` field, set it synchronously at the top of `destroy()`, and guard the timeout with `if (this.destroyed) iconRoot.unmount();` — mirroring the fix already applied to `FrontmatterWidget` and `TaskListCheckboxWidget`.

---

#### NEW-EDITOR-2: Mermaid widget can leak a panzoom instance if destroyed mid-render

**Status:** NEW
**Severity:** Low
**File:** `src/components/Editor/extensions/code/mermaid-plugin.ts:97-131`

**Description:**
`MermaidWidget.toDOM` starts an async `mermaid.render(...)` chain that, on resolution, creates a `panzoom` instance on the rendered SVG and stores it on `this.panzoomInstance`. `destroy()` disposes whatever instance exists at destroy time, but nothing prevents the `.then()` callback from running *after* `destroy()`. If the widget is torn down while `mermaid.render` is still in flight — the user switches notes, or the block scrolls out of view while a complex diagram renders — the callback still runs, attaches a fresh `panzoom` instance (with its own pointer and wheel listeners) to an SVG inside a now-detached container, and that instance is never disposed because `destroy()` already ran.

**Fix:** Add a `private destroyed = false` flag set synchronously in `destroy()`, and check it at the top of the `.then(({ svg }) => ...)` callback before touching the container or creating the `panzoom` instance.

---

#### NEW-EDITOR-3: Media paste inserts embed markdown at a stale selection

**Status:** NEW
**Severity:** Medium
**File:** `src/components/Editor/extensions/media-paste-plugin.ts:97-130`

**Description:**
On paste, `selection` is captured once from `view.state.selection.main` before the async loop runs. Each pasted file then goes through `await file.arrayBuffer()` and `await invoke("save_asset", ...)` sequentially — multiple IPC round trips for a multi-file paste. Only after all files are saved does the code dispatch an insert using the original `selection.from`/`selection.to`:

```typescript
const selection = view.state.selection.main;
// ... awaits per file ...
view.dispatch({
    changes: { from: selection.from, to: selection.to, insert: insertText },
    selection: { anchor: selection.from + insertText.length },
    userEvent: "input.paste",
});
```

If the user types or moves the cursor during that window (a large image or several files can take a perceptible time), the embed markdown lands at the stale position — over different content than was selected, or out of range if the document shortened, which CodeMirror rejects.

**Fix:** Re-read `view.state.selection.main` immediately before the final dispatch, or map the captured selection forward through intervening transactions via `changes.mapPos`.

---

#### NEW-EDITOR-4: Callout collapse state is keyed by line number, so unrelated edits reset it

**Status:** NEW
**Severity:** Low
**File:** `src/components/Editor/extensions/callout/callout-state.ts:24-26` (doc comment at `:23`), used from `src/components/Editor/extensions/callout/callout-plugin.ts:62-65`

**Description:**
`calloutKey(filePath, headerText, lineOffset)` builds the localStorage key for a callout's collapsed/expanded state from `block.headerLineNumber`:

```typescript
/** Build a stable key for a callout using its content hash. */
export function calloutKey(filePath: string, headerText: string, lineOffset: number): string {
    return `${filePath}::${lineOffset}::${headerText}`;
}
```

That line number is not stable. Inserting or deleting any line earlier in the document shifts the callout's header to a new line and therefore to a different storage key; `isCollapsed` finds no entry and falls back to `defaultCollapsed` (derived from the `+`/`-` fold character). A callout the user manually collapsed or expanded silently reverts to its default after an edit elsewhere in the note, with no visible cause.

Note also that the doc comment at `:23` is itself stale and actively misleading: it claims the key is built "using its content hash", but the implementation keys on `lineOffset`, which is exactly why the key is *not* stable. Anyone auditing this function by reading its contract rather than its body would conclude there is no bug here.

**Fix:** Key on something stable across unrelated edits — a hash of the callout's own header text plus its ordinal index among same-header callouts in the file, or (more robustly) an explicit ID embedded in the callout syntax. Update the doc comment at `:23` to match whatever the implementation actually does.

---

### 2.4 Stores & Hooks

#### NEW-STORES-2: Stale recent-vault paths are only pruned when actively selected

**Status:** NEW
**Severity:** Low
**File:** `src/stores/vaultStore.ts:58-67`, cross-referenced with the sole existence check at `src/hooks/useVaultSession.ts:121-134`

**Description:**
The `recentVaultPaths` feature does *not* repeat `BUG-S1`'s unprefixed-key mistake (it uses `"tessellum:vault:recentPaths"`) and does *not* repeat `BUG-G1`'s missing validation (`readRecentVaultPaths()` wraps `JSON.parse` in try/catch and structurally filters to an array of strings). However, unlike the primary `vaultPath` — existence-checked via `exists()` on every mount and change — entries in `recentVaultPaths` are pruned only when that specific path becomes the *active* vault and fails that check. A vault folder the user deletes, moves, or unmounts and never re-selects sits in the switcher's "Recent Vaults" list indefinitely, bounded only by the 6-entry cap eventually pushing it out.

**Fix:** When the switcher popover opens (or when `recentVaultPaths` is first read), batch-check each entry with `exists()` and call `removeRecentVaultPath` for any that no longer resolve.

---

#### NEW-STORES-3: Unguarded `JSON.parse` on a corrupted `expandedFolders` entry aborts workspace restoration

**Status:** NEW
**Severity:** Medium
**File:** `src/hooks/useVaultSession.ts:79-106`, inside the outer try/catch at `:65, 115-117`, gating the effects at `:203-210` and `:213-224`

**Description:**
Inside `refreshFiles`'s `restoreState` branch, `storedOpenTabs` is parsed inside its own local try/catch (so corrupted tabs degrade gracefully), but `storedExpanded` is parsed with a bare `JSON.parse(storedExpanded)` and no local guard:

```typescript
if (storedExpanded) {
    setExpandedFolders(JSON.parse(storedExpanded));
}
```

A malformed `expandedFolders` value — hand-edited, corrupted by a partial write, or written by an incompatible future format — throws, is caught by the single outer handler, and is only `console.error`'d. Everything after the throw point never runs for that call, including `setWorkspaceRestored(true)` (line 112) and `seedTemplatesIfEmpty` (line 113).

**Root cause / blast radius:** `workspaceRestored` gates both the periodic index-sync effect (`:203-210`) and the effect that persists workspace state back to localStorage (`:213-224`). One corrupted `expandedFolders` entry therefore silently disables periodic sync *and* stops persisting any workspace state (open tabs, view mode, last note) for that vault session, until the app is restarted or the vault re-selected.

**Fix:** Wrap the `storedExpanded` parse in the same local try/catch used for `storedOpenTabs`, falling back to `{}`.

---

#### NEW-STORES-4: Syntax-highlight and inline-code colour setters still have BUG-G2's two-write pattern

**Status:** NEW
**Severity:** Low
**File:** `src/stores/appearanceStore.ts:325-329, 364-368`

**Description:**
`BUG-G2` was fixed for the six *terminal* colour setters by consolidating them onto a single `writeTerminalColors` call. The seven *syntax* colour setters (`setSyntaxComment`, `setSyntaxKeyword`, `setSyntaxOperator`, `setSyntaxString`, `setSyntaxNumber`, `setSyntaxVariable`, `setSyntaxFunction`) and `setInlineCodeColor` were not migrated:

```typescript
setSyntaxComment: (syntaxComment) => set(() => {
    localStorage.setItem(SYNTAX_COMMENT_KEY, syntaxComment);
    localStorage.setItem(SYNTAX_CUSTOM_KEY, "true");
    return { syntaxComment, syntaxCustom: true };
}),
```

Each still makes two separate, non-atomic `setItem` calls. A force-kill between them leaves the colour persisted but its custom flag `false`, so the custom colour is silently overridden by the theme default on next launch — exactly `BUG-G2`'s failure mode on a different set of fields.

**Severity note:** rated Low rather than `BUG-G2`'s Medium because the blast radius is narrower — syntax and inline-code colours are cosmetic editor-theming preferences, whereas terminal colours were toggled together as a visibly themed unit.

**Fix:** Apply the same `writeTerminalColors`-style consolidation: serialise each colour group plus its custom flag into a single JSON blob under one key, written with one `setItem` per setter.

---

### 2.5 UI Components & Feature Slices

#### NEW-UI-1: Bulk tab-close paths bypass the unsaved-changes guard entirely

**Status:** NEW
**Severity:** Medium
**File:** `src/stores/vaultStore.ts:213-226` (`closeOtherTabs`, `closeAllTabs`), `src/hooks/useGlobalShortcuts.ts:92` (`Ctrl+W`)

**Description:**
`BUG-C1`'s fix routes single-tab closes through `dirtyPaths`, but `closeOtherTabs` and `closeAllTabs` are store actions that discard tabs directly, with no dirty check anywhere in the call path:

```typescript
closeOtherTabs: (path) => set((state) => {
    if (!state.openTabPaths.includes(path)) {
        return state;
    }
    const active = state.files.find((file) => file.path === path) ?? state.activeNote;
    return {
        openTabPaths: [path],
        activeNote: active,
    };
}),
closeAllTabs: () => set(() => ({
    openTabPaths: [],
    activeNote: null,
})),
```

Either action — reachable from the tab-strip context menu — silently drops every unsaved edit in the tabs it closes, the same failure mode `BUG-C1` fixed for a single tab, via a different entry point that the fix never covered. `Ctrl+W` in `useGlobalShortcuts.ts:92` also calls `closeTab` directly rather than through the guarded `handleTabClose` in `Editor.tsx`, but this path is benign in practice: switching the active note flushes the pending save first, so there is no unsaved content left on the tab by the time `closeTab` runs.

**Fix:** Move the dirty check into `vaultStore.closeTab` itself (consulting `editorContentStore`'s `dirtyPaths`) so every entry point — single close, close-others, close-all, and the keyboard shortcut — is covered by one guard instead of relying on each call site to re-implement it.

---

### 2.6 HTML Preview Plugin

*Area first audited in this refresh. The `html-preview` builtin plugin (commits `e4f8cce`..`37faba9`) renders untrusted HTML three ways: standalone `.html`/`.htm` files opened from the file tree, fenced ` ```html ` code blocks inside notes, and `![[page.html]]` embeds routed through the media-embed plugin. All three were reviewed for sandbox escape, path escape, and out-of-vault/network reach.*

#### NEW-HTMLPREVIEW-2 (remainder): CSP now confines embedded HTML on Blink, but two of three surfaces still fall back to the app CSP on WebKit engines

**Status:** CHANGED-SINCE
**Severity:** Medium
**File:** `src/components/Editor/extensions/code/html-block-plugin.ts:38-39` (`EMBEDDED_HTML_CSP`), applied at `:115` (fenced-block iframe), `src/components/Editor/HtmlFilePreview.tsx:102` (standalone viewer), `src/components/Editor/extensions/media-embed-plugin.ts:138` (`![[page.html]]` embeds); residual gap in `src-tauri/tauri.conf.json` (`app.security.csp`)

**Description:**
A shared policy, `EMBEDDED_HTML_CSP`, is now applied to all three HTML iframes as a `csp` attribute — `default-src 'none'` plus local-only `img-src`/`style-src`/`font-src`/`media-src` allowances (`data:`, `blob:`, `asset:`), with no `https:`/`http:` source anywhere in it. For the fenced ` ```html ` block, which renders via `srcdoc`, the same policy is additionally prepended as an inline `<meta http-equiv="Content-Security-Policy">` in the document itself (`buildEmbeddedHtmlSrcDoc`, `html-block-plugin.ts:51-53`), so that surface is confined on every rendering engine — a `srcdoc` document can carry its own CSP via a meta tag, and every engine honours it.

**What remains open:** the `csp` **attribute** — as opposed to the meta-tag form — is CSP Embedded Enforcement, which is implemented in Blink only; WKWebView (macOS) and WebKitGTK (Linux) ignore it entirely. The two `asset://`-loaded surfaces (the standalone `.html` viewer and `![[page.html]]` embeds) load an existing document by URL rather than via `srcdoc`, so there is no meta-tag option available to them — they depend solely on the Blink-only attribute. On macOS and Linux, a frame on either of those two surfaces silently falls back to inheriting the **app's** CSP from `tauri.conf.json`, which still permits `img-src ... https:`, so the original network-beacon leak (`<img src="https://tracker/<id>.png">` firing on note open) remains reachable on those platforms through those two surfaces specifically. The `srcdoc` fenced-block frame is unaffected by this gap on any engine.

**Fix:** Add a Tauri-level CSP response header on the asset protocol so `asset://`-served documents carry a real, engine-independent CSP instead of depending on the attribute alone; or drop the bare `https:` source from the global CSP's `img-src`/`media-src` in `tauri.conf.json` (this would also affect remote images in ordinary notes, so treat it as a product decision rather than a pure bugfix). Either closes the remaining gap on WKWebView/WebKitGTK.

---

#### NEW-HTMLPREVIEW-5: Opening an `.html` file still reads the whole file into the editor store

**Status:** NEW
**Severity:** Low
**File:** `src/components/Editor/hooks/useEditorActions.ts:56-64`

**Description:**
`useFileSynchronization` short-circuits content loading for `isMediaFile(...)` only; `isHtmlFile` was never added, even though `Editor.tsx:867` treats a file-viewer match exactly like a media file and hides the CodeMirror surface:

```tsx
const fileViewer = app.ui.getFileViewer(activeNote.path);
const isMedia = isMediaFile(activeNote.path) || Boolean(fileViewer);
```

Opening an `.html` file therefore invokes `read_file` (which has no extension gate — `notes.rs:841-848` just `read_to_string`s any in-vault path) and pushes the entire HTML source into `setActiveNoteContent`, where the outline, word count, and tag/link scanners in the right sidebar parse markup as markdown while the user is looking at the iframe. No write path is reachable (CodeMirror is unmounted, so no change event fires), so there is no corruption risk; the cost is a wasted full-file read per open plus nonsense in the note-derived panels.

**Fix:** Gate on the same predicate both sides use — add `|| isHtmlFile(activeNote.path)` to the skip in `useFileSynchronization`, or better, pass down the `Boolean(fileViewer)` decision so any future plugin-registered viewer automatically suppresses the note-content read.

---

#### NEW-HTMLPREVIEW-6: With the plugin disabled, `![[page.html]]` degrades to a broken-image icon

**Status:** NEW
**Severity:** Low
**File:** `src/components/Editor/extensions/media-embed-plugin.ts:217-225` and `:149-158`

**Description:**
The `htmlEnabled` gate in `getMediaKind` only removes `"html"` as a *kind*; it does not make the embed inert. The backend still resolves `page.html` (the `html`/`htm` entries in `SUPPORTED_EXTS` are unconditional), and `resolvePending` still hands back a `convertFileSrc` URL for `.html`/`.htm` (`:565-566`), so the widget arrives with `kind === "unknown"` and a non-null `src` and falls into the final `else`, which unconditionally builds an `<img>`. The user turns HTML rendering off and gets a broken-image glyph rather than the "Missing asset" / plain-link treatment the gate implies.

**Fix:** Make the `else` branch render the unknown-kind placeholder (reuse `cm-media-missing` with the target name, as the `!this.src` branch does) instead of assuming any resolved asset is an image, so a disabled html-preview — and any future unsupported type — degrades to a readable label.

---

### 2.7 Graph View / Mosaic Redesign

*Area first audited in this refresh.*

#### NEW-GRAPH-2: Ghost-node creation fails silently when the target folder doesn't exist on disk

**Status:** NEW
**Severity:** Medium
**File:** `src/components/GraphView/GraphView.tsx:167-181` and `src-tauri/src/commands/notes.rs:502-538`

**Description:**
`GraphView.tsx`'s fixed handler computes `targetDir` by re-joining the node ID's folder segments, so `createNoteInDir(targetDir, title)` gets the right destination for a ghost node like `[[Projects/Idea]]`. But the backend `create_note` never calls `create_dir_all` (or any directory-creation logic) on `vault_path` — the parameter that receives `targetDir` — before writing the file at `notes.rs:536`. If `Projects/` doesn't already exist on disk (plausible: a wikilink can reference a folder never created), `tokio::fs::write` fails with `NotFound`.

That error propagates back through `invoke` and is caught by the frontend's `catch (e) { console.error('Failed to create note:', e); }`, which has no user-facing surface — no toast, no dialog. Net effect: double-clicking such a ghost node does nothing visible; no note is created, no folder is created, and the only trace is a console error the user will not see.

**Fix:** Either call `tokio::fs::create_dir_all(&vault_path)` in `create_note` before the collision-check loop, or have the frontend surface the rejected promise as a toast — ideally both, so the user gets feedback either way.

---

#### NEW-GRAPH-3: `useDraggablePosition` validates the stored value's shape but not its bounds

**Status:** NEW
**Severity:** Low
**File:** `src/hooks/useDraggablePosition.ts:13-24` (and `:40-44`, `:53-60`), test at `src/hooks/useDraggablePosition.test.tsx:64-78`

**Description:**
Unlike the old `BUG-G1`/`BUG-S1` pattern, `readStoredPosition` does guard against malformed JSON (try/catch) and the wrong shape (`typeof parsed?.x === "number" && typeof parsed?.y === "number"`), and commit `50f415e` added regression tests for exactly those two cases. What neither implementation nor test covers is *value* validity: any object with numeric `x`/`y` is accepted verbatim, with no clamping to the current viewport.

Since `handlePointerMove` (`:40-44`) also computes new positions purely from pointer deltas with no clamping, a user can drag a panel (currently `GraphLegend`, `storageKey: "tessellum:graphLegendPosition"`) until it is partly or fully invisible, and that off-screen position is persisted (`:53-60`) and restored verbatim. The same happens passively, with no drag at all, when a position saved on a large or multi-monitor viewport is loaded on a smaller one. Because the drag handle is part of the panel itself, an off-screen panel has no visible affordance to drag back and there is no reset control — the only recovery is manually clearing the localStorage key.

**Contrast:** the sibling `useResizableFloatingPanel` hook, added in the same redesign and used by `LocalGraphPanel.tsx`, clamps its persisted values on every read and write via a `clamp(value, min, max)` helper (`src/components/GraphView/useResizableFloatingPanel.ts:25-33`). This is an inconsistency between the two new position-persisting hooks, not a universal gap in the redesign.

**Fix:** Clamp `x`/`y` to the current `window.innerWidth`/`innerHeight` (minus the panel's own size) both when reading the stored value and on window resize.

---

#### NEW-GRAPH-4: MosaicCanvas recomputes the full hex-cluster layout on every node selection

**Status:** NEW
**Severity:** Low
**File:** `src/components/GraphView/MosaicCanvas.tsx:27-38, 43-66`

**Description:**
The tile layout is memoized with `useMemo(..., [graphData, selectedNodeId])`, so it avoids recomputing on every render — but `selectedNodeId` is in the dependency array and every node click changes it. For any graph at or under the `MAX_TILES` cap of 200 nodes — i.e. every graph not already large enough to be a real performance concern — `pickVisibleNodes` returns `nodes` unchanged without consulting `selectedNodeId` at all (`:28`: `if (nodes.length <= MAX_TILES) return nodes;`).

A click that merely selects a tile therefore re-runs `countConnections`, `computeTagClusters`, `bucketNodesByDominantTag`, and `packHexClusters` — the BFS-based hex-packing placement algorithm in `src/utils/hexGrid.ts:69-163` — over the full visible node set, producing a layout provably identical to the one already on screen. `selectedNodeId` is load-bearing for `pickVisibleNodes` only in the >200-node case (to force the selected node into the visible top-N), so in the large-graph case every click re-runs the whole clustering/packing pipeline over up to 200 tiles instead of only when the visible set actually changes.

**Fix:** Split the memo: memoize `layout` on `graphData` alone (plus `selectedNodeId` only when `graphData.nodes.length > MAX_TILES`), and derive `selectedTile` for the halo/label separately via a cheap `.find()` against the already-computed `layout.tiles` — which the component already does at `:72`, so the infrastructure exists.

---

### 2.8 Vault Switcher / Recent Vaults

*Area first audited in this refresh.*

#### NEW-VAULTSWITCH-1: Clicking a stale recent-vault entry has no pre-flight validation

**Status:** NEW
**Severity:** Medium
**File:** `src/components/vault/VaultSwitcherPopover.tsx:210-213`, `src/stores/vaultStore.ts:99-113`, `src/hooks/useVaultSession.ts:121-134` and `:143-160`

**Description:**
The recent-vaults click handler calls `setVaultPath(path)` directly with no existence, directory, or readability check first. `setVaultPath` synchronously commits the new path to `localStorage`/state and tears down the *previous* vault's volatile state (`activeNote`, `openTabPaths`) immediately, before anything has confirmed the new path is valid.

`useVaultSession`'s "watch the vault directory" effect then fires unconditionally on the new `vaultPath` — it calls `invoke("watch_vault", ...)` and `refreshFiles(vaultPath, true)` regardless of whether the path exists. Both backend calls fail for a missing path, but the frontend only `console.error`s, so `setFiles`/`setFileTree` are never reached and the file tree is left showing the *previous* vault's contents while `vaultPath` already points at the new, invalid path.

**Root cause:** the existence check that exists (`useVaultSession.ts:121-134`, the `BUG-G1` fix pattern) runs asynchronously and fires *after* the switch and its side effects have already happened, rather than gating them. When it resolves `false` it does `console.warn`, `removeRecentVaultPath`, and `setVaultPath(null)`.

**User-visible effect:** clicking a recent entry whose folder was deleted, renamed, or unmounted produces a flash of inconsistent UI (new invalid path, old vault's file list) and then silently dumps the user onto the "no vault" screen with zero user-facing error message — losing their session context in the process, instead of staying on the vault they were already in and showing a toast.

**Fix:** Before calling `setVaultPath` in the popover's click handler, `await exists(path)` (or a dedicated `validate_vault_path` command); switch on success, or show a toast ("This vault folder could not be found") and call `removeRecentVaultPath(path)` without touching the currently-active vault's state. This applies the `BUG-G1` fix pattern *before* the transition instead of reactively after teardown has begun.

---

#### NEW-VAULTSWITCH-2: Vault switch does not tear down `canvasPath`/`viewMode`

**Status:** NEW
**Severity:** Medium
**File:** `src/stores/graphStore.ts:23-37`, `src/components/canvas/CanvasView.tsx:162-187`, `src/hooks/useVaultSession.ts:89-91`

**Description:**
`vaultStore.setVaultPath` explicitly resets `activeNote` and `openTabPaths` on a vault-scope change, but nothing resets `graphStore`'s `viewMode`, `canvasPath`, `selectedGraphNode`, or `isLocalGraphOpen` — `setViewMode` only clears `selectedGraphNode` as a side effect, and `setCanvasPath` is a bare, vault-unaware setter.

If a user is viewing a Canvas file in vault A (`viewMode: "canvas"`, `canvasPath` an absolute path inside A) and switches to a different, valid vault B — via the recent-vaults list or "Open folder as vault", both of which route through `setVaultPath` — `CanvasView`'s load effect re-fires because its dependency array includes `vaultPath`, and immediately calls `invoke('read_file', { vaultPath: B, path: canvasPath /* still A's */ })`. The backend's `validate_path_in_vault` correctly rejects this, so no cross-vault data leaks, but the frontend has no recovery beyond `setError(String(e))` — the user is left on a broken Canvas error screen for vault B.

Nothing switches `viewMode` back to `"editor"` except `useVaultSession`'s per-vault `restoreState` step, and only if vault B happens to have a previously-stored `viewMode`. If B has never been opened, the app stays parked on the errored Canvas view indefinitely. Even when a stored `viewMode` for B exists, `canvasPath` is never restored per-vault anywhere in the codebase — only explicit user actions call `setCanvasPath` — so a vault B whose last-used view was `"canvas"` would still render leftover state from A.

**Fix:** Reset `graphStore` (`viewMode` → `"editor"`, `canvasPath` → `null`, `selectedGraphNode` → `null`, `isLocalGraphOpen` → `false`) in the same place `vaultStore.setVaultPath` resets `activeNote`/`openTabPaths`, before `restoreState` re-applies whatever is stored for the new vault. This keeps teardown symmetric across all workspace-scoped stores.

---

#### NEW-VAULTSWITCH-3: `selectionStore`'s file selection is not cleared on vault switch

**Status:** NEW
**Severity:** Low
**File:** `src/stores/selectionStore.ts:18-26`, `src/components/Sidebar/hooks/useDeleteFile.ts:41-43`

**Description:**
Like `graphStore`, `selectionStore`'s `selectedFilePaths` / `lastSelectedPath` are not reset anywhere in the vault-switch path — `clearSelection` is only invoked after a successful delete or from file-tree interaction handlers, never from `vaultStore.setVaultPath` or `useVaultSession`. After switching from vault A (with an active multi-selection) to vault B, `selectedFilePaths` still holds vault A's absolute paths.

This does not appear exploitable for a cross-vault operation: the one bulk-action consumer inspected, `useDeleteFile.requestDelete`, re-resolves `selectedFilePaths` against the *current* vault's `files` list before treating a click as a "delete the selection" action, so stale paths simply fail to match and are ignored. The residual risk is UI staleness rather than data loss, but it is still an asymmetric teardown compared with `vaultStore`'s own fields.

**Fix:** Call `useSelectionStore.getState().clearSelection()` alongside the `activeNote`/`openTabPaths` reset in `vaultStore.setVaultPath`, for the same reason `NEW-VAULTSWITCH-2` recommends resetting `graphStore`.

---

#### NEW-VAULTSWITCH-4: List bounding, dedup, and removal verified correct (informational)

**Status:** NEW (verification record — no defect)
**Severity:** Low
**File:** `src/stores/vaultStore.ts:56, 73-76, 114-118`, `src/components/vault/VaultSwitcherPopover.tsx:220-236`

**Description:**
Recorded because the switcher / recent-vaults feature had never been reviewed before. Three properties were checked and found correct:

1. **Bounding** — `MAX_RECENT_VAULTS = 6` and `pushRecentVaultPath` slices to that length on every push; covered by `vaultStore.test.ts`'s *"caps the list at 6 entries, dropping the oldest"* (lines 193-210).
2. **Dedup** — `pushRecentVaultPath` filters out any existing occurrence before unshifting, so re-opening a vault moves it to the top rather than duplicating it; covered by *"dedupes and moves a re-opened path back to the front"* (lines 183-191).
3. **Removal** — the per-row remove button calls `removeRecentVaultPath(path)` with `e.stopPropagation()` so it does not also trigger the switch, and the store action filters and persists correctly; exercised by `VaultSwitcherPopover.test.tsx`'s *"removes a recent vault without switching to it"*.

The persistence-layer angle on this same feature — recent-vault entries never proactively re-validated unless they become active — is filed separately as `NEW-STORES-2`.

**Fix:** None required.

---

## 3. Fixed-Since-Last-Audit (Reference Only)

Historical traceability for every fix that landed since the 2026-06-18 audit: the 32 fully-closed findings, plus the closed *portion* of the 5 findings marked *(partial)*. Two of those five — `BUG-C1` and `BUG-C2` — were subsequently closed in full by the `fix/audit-2026-07-31-open-findings` remediation branch and are recorded below without the `(partial)` marker; the other three (`BUG-R3`, `BUG-R5`, `BUG-R6`) remain partial, with the residual gap tracked in section 2. That same branch also closed five findings from the 2026-07-30 refresh outright — `NEW-STORES-1`, `NEW-GRAPH-1`, `NEW-HTMLPREVIEW-1`, `NEW-HTMLPREVIEW-3`, `NEW-HTMLPREVIEW-4` — appended at the end of the table below. Nothing in this section is actionable — for the remaining partials, the outstanding work is tracked in section 2 and ranked in section 4.

| ID | One-line description | Fix landed at |
|---|---|---|
| BUG-U1 | Reduced Motion toggle no longer writes theme state | `src/hooks/useApplyAccessibilitySettings.ts:35-43` |
| BUG-U2 | Callout scanner tracks open fences, so nested code blocks render | `src/components/Editor/extensions/callout/callout-parser.ts:41-80` |
| BUG-U3 | Graph double-click guards media extensions and preserves folder prefix — **global Graph View only** at the time; the Local Graph panel's separate regression (`NEW-GRAPH-1`) was closed later by unifying both panels on one helper (see below) | `src/components/GraphView/GraphView.tsx:144-185`; label test at `src-tauri/src/commands/graph.rs:170` |
| BUG-U4 | Path-style wikilinks auto-alias to the last segment | `src/components/Editor/extensions/wikilink/wikiLink-parser.ts:40-68` |
| BUG-U5 | Trash names encode the full relative dir as `p=<encoded>` | `src-tauri/src/trash.rs` (`generate_trash_name`) |
| BUG-G1 | Persisted vault path validated via `exists()` and pruned when missing | `src/hooks/useVaultSession.ts:120-134` |
| BUG-G2 | Terminal colours serialised into one key by `writeTerminalColors` | `src/stores/appearanceStore.ts:185-187, 270-280` |
| BUG-G3 | Media embed guards a `destroyed` flag at every await; drains pending queue | `src/components/Editor/extensions/media-embed-plugin.ts:511-612` |
| BUG-G4 | Per-path save-generation counter gates the `isDirty` clear | `src/components/Editor/hooks/useEditorActions.ts:121-137` |
| BUG-G5 | EditorView re-registered via no-deps effect + `lastViewRef` change check | `src/components/Editor/Editor.tsx:70-88` |
| BUG-G6 | Drag handler reads `tabsOrderRef.current` fresh; `cleanupDrag()` runs first | `src/components/Editor/TabStrip.tsx:93-99, 131-176` |
| BUG-G7 | PDF export toast interpolates the caught error's message | `src/features/pdfExport/markdownPdfExport.ts:35-52` |
| BUG-G8 | `skippedCount` surfaced; vault refresh moved out of the import try/catch | `src/features/clipboard/clipboardImport.ts:75-94` |
| BUG-G9 | `sync_in_progress` `AtomicBool` via `compare_exchange` in `run_sync_vault` | `src-tauri/src/commands/indexer.rs:49-107` |
| BUG-G10 | `syncReadiness` catches invoke errors and sets a `failed` readiness state | `src/stores/searchStore.ts:139-155` |
| BUG-G11 | Dedup loop caps at `MAX_ATTEMPTS = 100` with a timestamp fallback | `src-tauri/src/commands/clipboard.rs:43-56` |
| BUG-R1 | `todo!()` replaced with `log::warn!`; the `Ok(Err(_))` branch also logs | `src-tauri/src/commands/notes.rs:712-716` |
| BUG-R2 | Write-to-temp → index → atomic rename; temp removed if indexing fails | `src-tauri/src/commands/notes.rs:867-887` |
| BUG-R3 (partial) | Rewrite regex matches folder prefixes and is case-insensitive | `src-tauri/src/commands/vault.rs:34-40, 261` |
| BUG-R4 | `validate_relative_note_path` rejects `..`/absolute *before* `create_dir_all` | `src-tauri/src/commands/notes.rs:268-284, 289-303` |
| BUG-R5 (partial) | Trash dir created unconditionally with idempotent `create_dir_all` | `src-tauri/src/commands/notes.rs:689` |
| BUG-R6 (partial) | Re-index decision also compares file size when mtime is equal | `src-tauri/src/indexer.rs:76-84` |
| BUG-R8 | Duplicate of BUG-G9 — same `sync_in_progress` guard | `src-tauri/src/commands/indexer.rs:49-107` |
| BUG-R9 | `parent_label.eq_ignore_ascii_case("root")` returns `vault_root` directly | `src-tauri/src/commands/notes.rs:114-128` |
| BUG-E1 | Parameter renamed `currentlyChecked`; sole call site passes current state | `src/components/Editor/extensions/task-list/task-list-parser.ts:52-58` |
| BUG-E2 | Deduplicated into `collectInlineCodeSpansForLine`; mismatched runs no longer span to EOL | `src/utils/inlineCodeSpans.ts:12-53` |
| BUG-E3 | CRLF/CR normalised to LF before offset computation | `src/components/Editor/extensions/callout/callout-plugin.ts:144-193` |
| BUG-E4 | Synchronous `destroyed` flag checked inside the deferred unmount | `frontmatter-widget.tsx:451, 480-489`; `task-list-plugin.tsx:54, 86-97` |
| BUG-E5 | `cellDisplayWidth` strips `\|` before measuring | `src/components/Editor/extensions/table/table-navigation.ts:37-47` |
| BUG-C1 | Per-path `dirtyPaths` set gates every tab close, not just the active tab | `src/stores/editorContentStore.ts` (`dirtyPaths`), `src/components/Editor/Editor.tsx` (`handleTabClose`) |
| BUG-C2 | `TemplatePicker` keys on `template.path`; `SidebarContextMenu` items carry an explicit `id` | `src/components/Sidebar/sidebarContextMenuItems.ts` (required `id`), `src/components/TemplatePicker.tsx` |
| BUG-C3 | `escapeTantivyTerm` escapes the special-character set before query build | `src/components/Search/SearchPanel.tsx:201-225` |
| BUG-C4 | `draftAccentColor` + `isValidHex` regex gate the commit; error border shown | `src/components/Settings/AppearanceSettings.tsx:68-69, 305-323` |
| BUG-S1 | Namespaced `"tessellum:vault:path"` with one-time legacy-key migration | `src/stores/vaultStore.ts:54, 78-89` |
| BUG-S2 | `applyVariant` reads live store values at fire time | `src/hooks/useApplyThemeSchedule.ts:118-127` |
| BUG-S3 | `useAppearanceStore.getState()` called at each point of use | `src/stores/themeStore.ts:69-79` |
| BUG-S4 | `isReplaying` and the cursor set in one `set()` before `applyEntry` | `src/stores/navigationHistoryStore.ts:124-128` |
| NEW-STORES-1 | Git password and AI API key moved to the OS credential store via a `keyring`-backed command triple, stripped from `partialize`, with one-time migrate-and-purge | `src/lib/secretStorage.ts`, `src/stores/syncStore.ts`, `src/stores/aiStore.ts`, `src-tauri/src/commands/secrets.rs` |
| NEW-GRAPH-1 | Local Graph panel's ghost-node double-click now shares `GraphView`'s media-guard + folder-preserving logic via one helper | `src/utils/graphNodeActions.ts` (`resolveGhostNodeTarget`), shared by `GraphView.tsx` and `LocalGraphPanel.tsx` |
| NEW-HTMLPREVIEW-1 | Mermaid `securityLevel` pinned to `"strict"`; sandbox invariant now asserted on all three HTML surfaces | `src/components/Editor/extensions/code/mermaid-plugin.ts` (`securityLevel` pinned) + sandbox assertions on all three surfaces |
| NEW-HTMLPREVIEW-3 | Backend pre-flight check confirms a preview file exists and is in-vault before the frame renders, replacing the dead `error`-event fallback | `src-tauri/src/commands/assets.rs` (`validate_preview_file`), `src/components/Editor/HtmlFilePreview.tsx` |
| NEW-HTMLPREVIEW-4 | `AssetIndex::resolve`'s containment check now applies to every return path | `src-tauri/src/models/asset_index.rs` (`accept_in_vault` on every return path), `src-tauri/src/commands/assets.rs` |

> Rows marked *(partial)* record the portion that landed; the residual gap is tracked as an open finding in section 2.

---

## 4. Priority Matrix

All **31 currently-open** findings — more precisely **29 defects plus 2 verification / coverage-gap records**. The two non-defects, per their own status labels in section 2, are `CONFIRMED-TRASH-3` (row 16) and `NEW-VAULTSWITCH-4` (row 31): neither describes a defect in shipping behaviour. `CONFIRMED-TRASH-3` still carries real work — it needs integration tests — so it is ranked normally. `NEW-VAULTSWITCH-4` requires no action at all; it is listed purely so the coverage is traceable. (The third verification/coverage record from the 2026-07-30 refresh, `NEW-HTMLPREVIEW-1`, was closed in full by the `fix/audit-2026-07-31-open-findings` branch and moved to section 3.) Ranked by severity then by blast radius. Fixed items are excluded. With the Critical (`NEW-STORES-1`) and High-severity (`BUG-C1`, `NEW-GRAPH-1`, `BUG-C2`) items all closed by that same branch, the highest-priority open findings are now Medium severity: reindex/restore correctness issues first, then the residual CSP gap and vault-switch teardown items, then the rest of the Medium tier, then Low-severity polish.

| Priority | ID | Description | File | Severity |
|---|---|---|---|---|
| 1 | CONFIRMED-TRASH-2 | Restore-triggered reindex bypasses the `sync_in_progress` guard | `notes.rs:232` | Medium |
| 2 | BUG-R7 | DB commit after filesystem mutation, no rollback path | `db.rs:247-335` | Medium |
| 3 | CONFIRMED-TRASH-1 | Restore fallback silently picks one of several same-named folders | `notes.rs:130-148` | Medium |
| 4 | BUG-R5 | `generate_unique_trash_path` check-then-act gap before the rename | `trash.rs:100-112` | Medium |
| 5 | BUG-R6 | Same-second, same-size frontmatter edits skipped by the indexer | `indexer.rs:76-84` | Medium |
| 6 | NEW-HTMLPREVIEW-2 | Two of three HTML surfaces still inherit the app's permissive CSP on WKWebView/WebKitGTK (Blink-only `csp` attribute; `srcdoc` frame is covered on all engines) | `tauri.conf.json`, `html-block-plugin.ts:38-39`, `HtmlFilePreview.tsx:102`, `media-embed-plugin.ts:138` | Medium |
| 7 | NEW-STORES-3 | Corrupted `expandedFolders` aborts workspace restore, disabling periodic sync | `useVaultSession.ts:79-106` | Medium |
| 8 | NEW-VAULTSWITCH-1 | Recent-vault click has no pre-flight validation; silent bounce to "no vault" | `VaultSwitcherPopover.tsx:210-213` | Medium |
| 9 | NEW-VAULTSWITCH-2 | `canvasPath`/`viewMode` not torn down on vault switch | `graphStore.ts:23-37` | Medium |
| 10 | NEW-EDITOR-1 | Heading fold widget still has the BUG-E4 deferred-unmount race | `markdown-heading-fold.ts:163-170` | Medium |
| 11 | NEW-EDITOR-3 | Media paste inserts embed markdown at a stale selection | `media-paste-plugin.ts:97-130` | Medium |
| 12 | NEW-BACKEND-1 | `create_note_from_template` passes `target_dir` as `{{vault}}` | `templates.rs:120-121` | Medium |
| 13 | NEW-GRAPH-2 | Ghost-node creation fails silently when the target folder is missing | `GraphView.tsx:167-181`, `notes.rs:502-538` | Medium |
| 14 | NEW-BACKEND-5 | `create_note`'s containment check validates the target directory against itself | `notes.rs:508` | Medium |
| 15 | NEW-UI-1 | Bulk tab-close (`closeOtherTabs`/`closeAllTabs`) bypasses the unsaved-changes guard | `vaultStore.ts:213-226` | Medium |
| 16 | CONFIRMED-TRASH-3 | No tests for nested-path, fallback-search, or legacy-marker restore | `trash.rs:351-609`, `notes.rs:1010-1152` | Medium |
| 17 | BUG-R3 | Rewritten backlink source files not re-indexed immediately | `vault.rs:267, 289-319` | Low |
| 18 | BUG-G12 | Trash-restore errors carry no path context | `notes.rs:213-217` | Low |
| 19 | NEW-BACKEND-2 | Template/asset collision loops have no upper bound | `templates.rs:110-118`, `assets.rs:120-127` | Low |
| 20 | NEW-BACKEND-3 | `create_folder` check-then-act race | `folders.rs:33-41` | Low |
| 21 | NEW-BACKEND-4 | Watcher `file-changed` emission failure silently swallowed | `watcher.rs:65` | Low |
| 22 | NEW-EDITOR-2 | Mermaid widget can leak a panzoom instance if destroyed mid-render | `mermaid-plugin.ts:97-131` | Low |
| 23 | NEW-EDITOR-4 | Callout collapse state keyed by line number, reset by unrelated edits | `callout-state.ts:24-26` | Low |
| 24 | NEW-STORES-4 | Syntax/inline-code colour setters keep BUG-G2's two-write pattern | `appearanceStore.ts:325-329, 364-368` | Low |
| 25 | NEW-STORES-2 | Stale recent-vault paths pruned only when actively selected | `vaultStore.ts:58-67` | Low |
| 26 | NEW-VAULTSWITCH-3 | `selectionStore` not cleared on vault switch | `selectionStore.ts:18-26` | Low |
| 27 | NEW-GRAPH-3 | `useDraggablePosition` never clamps to viewport; panel can go off-screen | `useDraggablePosition.ts:13-24` | Low |
| 28 | NEW-GRAPH-4 | MosaicCanvas re-runs the full hex layout on every node selection | `MosaicCanvas.tsx:43-66` | Low |
| 29 | NEW-HTMLPREVIEW-5 | Opening an `.html` file still reads it into the editor store | `useEditorActions.ts:56-64` | Low |
| 30 | NEW-HTMLPREVIEW-6 | Disabled html-preview degrades `![[page.html]]` to a broken-image icon | `media-embed-plugin.ts:149-158` | Low |
| 31 | NEW-VAULTSWITCH-4 | Verification record — bounding/dedup/removal correct, no action needed | `vaultStore.ts:56, 73-76, 114-118` | Low |

---

*Audit performed on branch `New-UI` as of 2026-07-30–31, against the **working tree** (last commit `37faba9` plus uncommitted changes to the six files listed in the citation-baseline note at the top of this document). Line numbers were verified against that working tree and should be re-checked before implementing fixes — especially in those six files, where they do not match `37faba9`.*
