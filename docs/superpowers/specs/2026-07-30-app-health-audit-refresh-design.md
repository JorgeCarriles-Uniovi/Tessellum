# App Health Audit Refresh — Design

## Purpose

`docs/tessellum-analysis.md` (written 2026-06-18) is Tessellum's only existing bug/tech-debt audit. Spot-checking it during this session showed it is substantially stale: of the highest-severity findings checked, most (the `todo!()` panic on trash timeout, the non-atomic file write, the concurrent `full_sync` race, the callout fence-parsing break, the path-validation-after-mkdir ordering issue, and the trash-restore "only remembers immediate parent" bug) have already been fixed on this branch. Meanwhile, substantial new surface area — the html-preview plugin, the graph view / Mosaic hexagon redesign, and the vault switcher / recent-vaults feature — has shipped since the doc was written and has never been audited.

The goal of this work is a refreshed, evidence-based audit that reflects the codebase as of 2026-07-30, replacing the stale document with current findings and covering the previously-unaudited recent features.

## Scope

**Re-verify** (previously covered by the old doc, likely to have partially moved):
- Rust backend commands (`src-tauri/src/commands/`), trash/restore (`src-tauri/src/trash.rs`), indexer (`src-tauri/src/indexer.rs`, `db.rs`)
- Editor extensions (`src/components/Editor/extensions/`)
- Stores & hooks (`src/stores/`, `src/hooks/`)
- Other UI components (`src/components/Search/`, `src/components/Settings/`, `src/components/Editor/*.tsx`, etc.)

**Newly audit** (shipped since 2026-06-18, never reviewed):
- html-preview plugin (`src/plugins/builtin/`, media-embed/file-viewer registry changes)
- Graph view / Mosaic hexagon redesign (`src/components/GraphView/`)
- Vault switcher, recent-vaults (`src/stores/vaultStore.ts` and related components)

**Already confirmed this session** (folded in directly, not re-investigated):
- Trash-restore fallback-search heuristic can restore into the wrong same-named folder (`notes.rs`, `resolve_restore_directory`)
- Restore-triggered reindex bypasses the `sync_in_progress` guard (`notes.rs:232`, `refresh_indexes_after_restore`)
- No test coverage for the new `p=`-encoded restore path or its fallback case
- Tab-close dirty-check only guards the active tab, not background dirty tabs (`Editor.tsx`)

**Out of scope:** fixing any of the findings. This session produces a document only.

## Method

One investigation agent per subsystem area listed above, run in parallel. Each agent is instructed to:
- Read current source directly rather than trust old doc claims
- For areas the old doc already covered, classify each prior finding as `FIXED-SINCE`, `CONFIRMED-STILL-OPEN`, or `CHANGED-SINCE` (behavior different from both the old doc and a simple fix)
- For newly-audited areas, find and report new issues from scratch
- Cite file:line and include a short code snippet for every claim
- Report only what was actually read/verified — no speculation without evidence

Findings are then synthesized by hand into one document, deduplicated, and ranked.

## Output

Replace `docs/tessellum-analysis.md` in place (same filename, so existing references keep working) with:
1. A short changelog note at the top: what changed since the 2026-06-18 version, and which old findings turned out fixed
2. The feature-proposal section (§1 of the old doc) kept largely as-is — it's forward-looking, not a bug list, and wasn't invalidated by recent commits (spot-check for anything obviously already shipped, e.g. version history or vault switcher features)
3. Bug findings reorganized by subsystem area, each with severity, file:line, root cause, and suggested fix — same format as the existing doc
4. A single priority matrix at the end, ranked by severity, covering only currently-open findings (fixed/stale items are noted in the changelog, not the matrix)

## Self-review notes

- No placeholders remain; scope list is concrete and file-path-anchored.
- Consistent with the already-confirmed findings from earlier in this session — no contradictions.
- Scoped to one document as the sole deliverable; no implementation work implied.
- "Fixing findings" is explicitly excluded to avoid scope creep into code changes.
