# Wave 6 Backend Foundations Standards Package

## 1. Test Plan Summary (IEEE 829)

### 1.1 Test Plan Identifier

- `TP-W6-BE-FOUNDATIONS-2026-04-29`

### 1.2 Introduction

Wave 6 begins the backend coverage rollout for Tessellum. This implementation targets the command-foundation and backend-core files in `src-tauri/src` where branch-oriented coverage can be added through isolated `cargo test` suites using temp vaults, temp databases, and deterministic search-index fixtures.

### 1.3 Test Items

- `src-tauri/src/commands/assets.rs`
- `src-tauri/src/commands/folders.rs`
- `src-tauri/src/commands/graph.rs`
- `src-tauri/src/commands/indexer.rs`
- `src-tauri/src/commands/links.rs`
- `src-tauri/src/commands/watcher.rs`
- `src-tauri/src/db.rs`
- `src-tauri/src/indexer.rs`
- `src-tauri/src/search.rs`
- `src-tauri/src/grafeo_projection.rs`
- `src-tauri/src/utils/sanitize.rs`
- `src-tauri/src/utils/validate.rs`

### 1.4 Features To Be Tested

- command-level validation, collision handling, cache invalidation, and debounce logic
- wikilink extraction and graph data building
- search index creation, search, delete, and clear operations
- database indexing, rename propagation, tag search, and metadata aggregation
- full vault indexing behavior for hidden-file skipping and deleted-file cleanup
- Grafeo helper behavior that does not require a live initialized graph DB
- backend sanitization and vault-path validation

### 1.5 Features Not To Be Tested

- Tauri window bootstrap
- `main.rs`, `lib.rs`, and `mod.rs` structural files
- backend modules outside the implemented Wave 6 scope
- end-to-end desktop flows

### 1.6 Approach

- `ISO/IEC/IEEE 29119` governs the process framing and traceability.
- `IEEE 829` governs the structure of this test plan summary, test design specification, and test case specification.
- `IEEE 1008` principles are applied to the isolated backend unit tests through deterministic fixtures, one-temp-resource-per-test rules, and explicit branch assertions.
- Colocated Rust tests are used for both pure helper coverage and DB/search-backed integration-style coverage.

### 1.7 Item Pass/Fail Criteria

- All Wave 6 backend tests pass under `cargo test --manifest-path src-tauri/Cargo.toml --lib`.
- Each in-scope file has direct automated coverage.
- No test depends on shared vault, DB, or search-index state.

### 1.8 Suspension and Resumption Criteria

- Suspend if the Rust test binary cannot be linked or executed reliably.
- Suspend if a backend module cannot be tested without a behavior-changing refactor.
- Resume after the test binary lock is cleared or after a minimal seam is introduced.

### 1.9 Test Deliverables

- New Rust backend test cases in the in-scope files
- Wave 6 design and plan artifacts
- This standards package
- Wave 6 implementation-process record

### 1.10 Environmental Needs

- Rust toolchain with `cargo test`
- temp filesystem access
- sqlite through `sqlx`
- Tantivy local index directories
- existing `test_support.rs` vault fixture builder

### 1.11 Responsibilities

- Codex implemented the backend suites and documentation.
- Repository maintainers review branch adequacy and define later backend waves.

### 1.12 Risks and Contingencies

- Search index fixtures can fail if an empty directory is reused as an existing index.
- Windows can transiently lock the Rust test executable during repeated runs.
- DB rename and search-index tests can become brittle if path normalization assumptions are not explicit.

Mitigation:

- Use non-existing child directories for search-index creation
- Re-run `cargo test --lib` when the full target run hits a transient linker lock
- Assert normalized full paths explicitly in backend tests

## 2. Test Design Specification (IEEE 829)

### 2.1 Test Design Identifier

- `TDS-W6-BE-FOUNDATIONS-2026-04-29`

### 2.2 Features To Be Tested

1. backend utility validation and sanitization
2. command-foundation behavior
3. database and search core behavior
4. vault indexing and graph-core behavior
5. Grafeo helper fallback behavior

### 2.3 Approach Refinement

- Specification-based:
  - ECP partitions valid vs invalid folder names, supported vs unsupported asset extensions, remote vs local asset targets, and populated vs empty search/tag datasets.
  - BVA targets debounce windows, index-clear behavior, and collision suffix increments.
- Structure-based:
  - Basis-path style tests cover duplicate-link dedupe, DB rename propagation, graph ghost-node creation, full-sync deletion cleanup, and watcher debounce branches.
- Error guessing:
  - unsupported file types, paths outside the vault, uninitialized Grafeo access, duplicate folders, and hidden filesystem paths are covered directly.

### 2.4 Feature-to-Suite Mapping

- `src-tauri/src/utils/sanitize.rs`
- `src-tauri/src/utils/validate.rs`
  - in-module `#[cfg(test)]` suites
- `src-tauri/src/commands/links.rs`
- `src-tauri/src/commands/folders.rs`
- `src-tauri/src/commands/assets.rs`
- `src-tauri/src/commands/graph.rs`
- `src-tauri/src/commands/indexer.rs`
- `src-tauri/src/commands/watcher.rs`
  - in-module `#[cfg(test)]` suites
- `src-tauri/src/db.rs`
- `src-tauri/src/search.rs`
- `src-tauri/src/indexer.rs`
- `src-tauri/src/grafeo_projection.rs`
  - in-module `#[cfg(test)]` suites

## 3. Test Case Specifications (IEEE 829)

| Test ID | Test Item | Input | Expected Outcome | Technique |
|---|---|---|---|---|
| `W6-UTIL-001` | `sanitize.rs` | allowed/disallowed file-name characters | disallowed characters are removed and trailing dots/spaces are stripped | ECP Valid/Invalid Character Classes |
| `W6-UTIL-002` | `validate.rs` | path inside and outside a temp vault | inside path validates; outside path is rejected | Basis Path |
| `W6-CMD-001` | `links.rs` | plain, aliased, and escaped wikilinks | plain and aliased links are extracted; escaped links are ignored | ECP + Error Guessing |
| `W6-CMD-002` | `folders.rs` | valid folder name, duplicate name, and empty sanitized name | valid folder is created; duplicate and empty names are rejected | ECP |
| `W6-CMD-003` | `assets.rs` | remote URL target and local relative markdown asset | remote target returns `None`; local vault asset resolves | ECP Valid/Invalid Target Classes |
| `W6-CMD-004` | `assets.rs` | conflicting asset names plus unsupported extension | collision suffixes are appended; unsupported extension is rejected | BVA Collision Increment + Error Guessing |
| `W6-CMD-005` | `graph.rs` | indexed note graph with orphan and missing target | graph contains existing, orphan, and ghost nodes plus broken edge | Basis Path |
| `W6-CMD-006` | `commands/indexer.rs` | successful sync stats and primed cache state | sync result maps stats and invalidates cached indexes | Basis Path |
| `W6-CMD-007` | `watcher.rs` | elapsed vs non-elapsed debounce interval | event is emitted only after debounce window elapses | BVA Time Boundary |
| `W6-CORE-001` | `search.rs` | indexed docs with text and tag queries | matching docs are returned for text and tag searches | ECP |
| `W6-CORE-002` | `search.rs` | delete and clear operations | indexed paths are removed correctly | Basis Path |
| `W6-CORE-003` | `db.rs` | duplicate links and backlinks | outgoing links are deduped and backlinks remain correct | Basis Path |
| `W6-CORE-004` | `db.rs` | folder rename with linked notes | note paths and link endpoints are rewritten | Basis Path |
| `W6-CORE-005` | `db.rs` | frontmatter tags, inline tags, and property keys | tag search, aggregated tags, and property keys are returned correctly | ECP + Error Guessing |
| `W6-CORE-006` | `indexer.rs` | vault with visible, hidden, and deleted files | hidden entries are skipped; deleted entries are removed on resync | Basis Path |
| `W6-CORE-007` | `grafeo_projection.rs` | note path and query before init | title is derived from path; query fails with uninitialized-db error | ECP + Error Guessing |

## 4. ISO/IEC/IEEE 29119 Sub-process Mapping

| ISO 29119 Sub-process | Wave 6 Application |
|---|---|
| Test Monitoring and Control | Wave 6 scope was fixed to backend foundations and core services |
| Test Analysis | Remaining low- and medium-coupling Rust modules were inventoried from `src-tauri/src` |
| Test Design | Branch targets were defined around validation, dedupe, rename, sync, search, and debounce flows |
| Test Implementation | Colocated Rust tests and small inner-function seams were added |
| Test Execution | `cargo test --manifest-path src-tauri/Cargo.toml --lib` was executed to verify the backend slice |
| Test Completion | Traceability and verification evidence were written into this standards package and the implementation log |

## 5. Representative Code Samples

- Command asset sample: [src-tauri/src/commands/assets.rs](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src-tauri/src/commands/assets.rs)
- DB sample: [src-tauri/src/db.rs](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src-tauri/src/db.rs)
- Search sample: [src-tauri/src/search.rs](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src-tauri/src/search.rs)
- Indexer sample: [src-tauri/src/indexer.rs](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src-tauri/src/indexer.rs)
