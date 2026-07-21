# Wave 6 Backend Foundations Design

## Objective

Wave 6 starts the backend coverage program for `src-tauri/src` with strong branch-oriented tests around command foundations and the shared core services they depend on. The wave focuses on low- and medium-coupling Rust modules where deterministic unit and integration-style tests can be added without weakening isolation.

## In Scope

- Command files:
  - `src-tauri/src/commands/assets.rs`
  - `src-tauri/src/commands/folders.rs`
  - `src-tauri/src/commands/graph.rs`
  - `src-tauri/src/commands/indexer.rs`
  - `src-tauri/src/commands/links.rs`
  - `src-tauri/src/commands/watcher.rs`
- Backend core files:
  - `src-tauri/src/db.rs`
  - `src-tauri/src/indexer.rs`
  - `src-tauri/src/search.rs`
  - `src-tauri/src/grafeo_projection.rs`
- Shared backend utilities:
  - `src-tauri/src/utils/sanitize.rs`
  - `src-tauri/src/utils/validate.rs`

## Included Existing Coverage

Wave 6 builds on the command tests that already existed in:

- `src-tauri/src/commands/clipboard.rs`
- `src-tauri/src/commands/notes.rs`
- `src-tauri/src/commands/search.rs`
- `src-tauri/src/commands/templates.rs`
- `src-tauri/src/commands/vault.rs`
- `src-tauri/src/trash.rs`

## Out of Scope

- `main.rs`
- `lib.rs` except for already-existing repository tests
- `mod.rs` files
- remaining backend models and support modules not required by this coverage slice

## Testability Strategy

1. Keep tests colocated in the Rust modules under `#[cfg(test)]`.
2. Use one temp vault and one temp database per test case.
3. Prefer direct tests of internal helpers and non-Tauri inner functions where IPC wrappers add noise without adding coverage value.
4. Add small seam extractions only when they reduce cognitive complexity and make the command logic directly testable.

## Branch Targets

### Command Foundations

- asset resolution for remote, local, unsupported, and collision branches
- folder creation success, empty-name rejection, and duplicate handling
- graph label normalization plus orphan/broken-node graph construction
- indexer command stats mapping and cache invalidation after sync
- wikilink extraction with escaped and aliased forms
- watcher debounce allow vs suppress paths

### Backend Core

- search tokenization, indexing, search, delete, and clear branches
- database link deduplication, rename propagation, tag search, and metadata aggregation
- vault indexer filesystem scan skipping hidden files, indexing new files, and deleting removed files
- Grafeo helper behavior for title derivation and uninitialized query failure
- sanitize/validate helper success and failure branches

## Acceptance Criteria

- All in-scope files above have direct automated coverage.
- Tests remain independent and create no shared filesystem, DB, or search-index state.
- Tests demonstrate specification-based, structure-based, and error-guessing techniques.
- `cargo test --manifest-path src-tauri/Cargo.toml --lib` passes with the new backend suites.
