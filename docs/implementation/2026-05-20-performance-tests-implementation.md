# Performance Tests Implementation

This document explains the implementation of the Rust performance test suite added for Tessellum.

## 1. Create a dedicated integration test target

The performance suite lives in `src-tauri/tests/performance.rs`.

This keeps the benchmarks separate from unit tests and allows them to use the public library API exactly as an external consumer would.

## 2. Reuse deterministic vault fixtures

The test suite uses `TestVault` to generate synthetic vaults on disk:

- `seed_linear_vault(10_000)` creates 10,000 markdown notes for the indexing benchmark.
- `seed_dense_graph_vault(5_000, 4)` creates 5,000 notes with four wiki-links each, producing 20,000 edges.

This keeps the setup readable and avoids duplicating filesystem fixture code inside each test.

## 3. Expose the minimum test-facing API

Integration tests compile against the library boundary, so the following types were re-exported from `tessellum_lib`:

- `Database`
- `VaultIndexer`
- `SearchIndex`
- `TestVault`

This allows the benchmark file to stay small and focused without reaching into private modules.

## 4. Measure the real backend operations

Each performance test uses `std::time::Instant` around the real operation under test:

- full vault indexing through `VaultIndexer::full_sync`
- graph projection generation through `build_graph_data`
- concurrent SQLite reads and writes through Tokio tasks

The assertions remain strict inside the test body so the suite still acts as a hard budget check when explicitly executed.

## 5. Reduce indexing overhead for large vaults

While wiring the suite, the 10k indexing benchmark exposed a real bottleneck in the indexing pipeline.

The backend was updated in three places:

- `VaultIndexer::full_sync` now reuses the first filesystem scan to build the wikilink resolution index instead of walking the vault twice.
- Markdown updates are prepared in memory first and then written through batch database operations.
- Initial full sync uses chunked bulk inserts for `notes`, `note_tags`, `links`, and `search_files` to reduce SQLite round-trips.

These changes lowered the release benchmark substantially while keeping the code path understandable.

## 6. Keep performance validation opt-in

The performance tests are marked `#[ignore]`.

This prevents routine `cargo test` runs from failing because of machine-dependent timing checks, while still preserving the strict benchmark assertions for explicit validation runs.

Use this command to execute the suite:

```powershell
cargo test --release --test performance -- --ignored
```

## 7. Current result

At the time of implementation:

- the graph projection budget passes
- the SQLite concurrency test passes
- the 10k indexing budget is still above the 5 second target on this machine

This means the suite is ready to validate the documented constraints, and it also highlights that the indexing target still needs further optimization if the 5 second requirement must be met on the current host.
