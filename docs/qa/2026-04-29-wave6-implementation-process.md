# Wave 6 Implementation Process

## Summary

Wave 6 started the backend testing program by covering command-foundation Rust files and the backend core services they depend on. The implementation prioritized low- and medium-coupling modules first so the tests could stay independent and branch-oriented while still exercising real filesystem, sqlite, and search-index behavior.

## Step-by-Step Implementation

1. Inventoried the backend scope under `src-tauri/src`, including all command files and the core services requested for explicit coverage.
2. Identified the first practical coverage slice:
   - command foundations
   - shared backend core
   - supporting validation/sanitization utilities
3. Added direct unit tests to:
   - `utils/sanitize.rs`
   - `utils/validate.rs`
4. Added command tests to:
   - `commands/links.rs`
   - `commands/folders.rs`
   - `commands/assets.rs`
   - `commands/graph.rs`
   - `commands/indexer.rs`
   - `commands/watcher.rs`
5. Added backend core tests to:
   - `db.rs`
   - `search.rs`
   - `indexer.rs`
   - `grafeo_projection.rs`
6. Introduced small command seams in `commands/assets.rs` so the command logic could be tested directly without relying on Tauri `State` wrappers.
7. Ran `cargo test` and fixed the resulting issues:
   - corrected a malformed test assertion in the new asset suite
   - switched search-index fixtures to non-existing child directories so Tantivy creates a fresh index instead of trying to open an empty directory as an existing index
   - aligned backend assertions to normalized full paths instead of relative assumptions
8. Re-ran the backend verification using the library-only test target after a transient Windows linker file lock on the full test executable.

## Production/Design Adjustments During Verification

- `src-tauri/src/commands/assets.rs`
  - extracted `resolve_asset_inner()` and `save_asset_inner()` to reduce cognitive complexity and make backend command behavior directly testable
- `src-tauri/src/commands/watcher.rs`
  - extracted `should_emit_change()` so debounce behavior can be tested without a live filesystem watcher

These seams preserve behavior and reduce coupling instead of adding test-only indirection.

## Verification Record

Verification command:

```powershell
cargo test --manifest-path src-tauri\Cargo.toml --lib
```

Observed result:

- `80` tests passed
- `0` tests failed

Note:

- A full `cargo test --manifest-path src-tauri\Cargo.toml` run hit a transient Windows linker lock on the generated test executable.
- The backend library-target verification completed successfully with the command above and exercised the in-scope backend suites.

## Isolation Notes

- Every new backend test creates its own temp vault, temp DB, or temp search-index directory.
- The search-index fixtures use a child path that does not exist yet, so index creation is deterministic.
- Backend path assertions use normalized paths explicitly to avoid platform-specific separator drift.
