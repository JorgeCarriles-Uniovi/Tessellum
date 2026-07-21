# Wave 6 Backend Foundations Plan

## Goal

Implement isolated backend tests for the first Rust coverage slice in `src-tauri/src`, centered on command foundations and the shared backend core services they exercise.

## Execution Steps

1. Write the Wave 6 design and plan artifacts.
2. Add direct unit tests for shared backend utilities:
   - `utils/sanitize.rs`
   - `utils/validate.rs`
3. Add command-foundation tests for:
   - `commands/links.rs`
   - `commands/folders.rs`
   - `commands/assets.rs`
   - `commands/graph.rs`
   - `commands/indexer.rs`
   - `commands/watcher.rs`
4. Add backend core tests for:
   - `db.rs`
   - `search.rs`
   - `indexer.rs`
   - `grafeo_projection.rs`
5. Introduce only the minimum inner-function seams required to test command logic without Tauri IPC wrappers.
6. Run backend verification with `cargo test --manifest-path src-tauri/Cargo.toml --lib`.
7. Write the Wave 6 standards package and implementation-process record.

## Constraints

- Every test must be independent.
- Temp vaults, temp DBs, and temp search-index directories are required per test.
- Refactors are allowed only when they reduce coupling or cognitive complexity.
- Assertions should be branch-first rather than smoke-first.

## Exit Criteria

- The new backend suites pass through `cargo test --manifest-path src-tauri/Cargo.toml --lib`.
- The documented Wave 6 scope matches the implemented files.
- The Wave 6 docs contain no placeholders.
