# Wave 1 Frontend Shared Logic Implementation Process

## Purpose

This note records the exact implementation flow used for Wave 1 so later waves can reuse the same low-complexity approach instead of rediscovering the testing pattern.

## Step-By-Step Process

1. Freeze the Wave 1 boundary before writing tests.
   - The scope was limited to frontend shared logic that can be tested independently on top of the Wave 0 harness.
   - UI-heavy editor modules, plugin runtime APIs, graph rendering, and cross-store orchestration were left for later waves.

2. Write the Wave 1 design and execution documents.
   - `docs/superpowers/specs/2026-04-28-wave1-frontend-shared-logic-design.md`
   - `docs/superpowers/plans/2026-04-28-wave1-frontend-shared-logic.md`

3. Group the tests by behavior, not by directory alone.
   - constants
   - i18n core
   - i18n service
   - Cypher helpers
   - themes
   - shared utilities
   - shared hooks
   - plugin preferences
   - basic stores
   - persisted stores
   - plugin store
   - search store
   - vault store

4. Use the Wave 0 isolation helpers instead of per-file cleanup code.
   - `trackStore()` was used for every Zustand store touched by a test.
   - `localStorage` cleanup, `sessionStorage` cleanup, and Tauri mock reset continued to run from `src/test/setup.ts`.

5. Use fresh module imports for storage-backed initialization paths.
   - `vi.resetModules()` was used before importing persisted-store modules and modules with module-level caches.
   - This kept each test independent and made the initialization branches testable without leaking state between tests.

6. Exercise branch-heavy logic through public surfaces first.
   - Cypher parsing and normalization were tested through exported functions.
   - theme parsing was tested through the parser entry points
   - store behavior was tested through public actions and public state
   - no new production seam extraction was required in Wave 1

7. Run the full Wave 1 frontend slice.
   - the first run exposed three expectation errors in the new tests
   - no production bug fix was needed for those failures
   - the assertions were corrected to match the actual public behavior:
     - quoted tag lists remain unchanged in the normalizer
     - graph filtering requires supported predicate syntax
     - inline-code stripping preserves the full span width with spaces

8. Re-run the exact same verification command until the whole Wave 1 slice passed.
   - final result: `13` test files passed and `54` tests passed

9. Write the standards-aligned QA documentation using the implemented scope and fresh evidence.
   - `docs/qa/2026-04-28-wave1-frontend-shared-logic-standards.md`

## Implementation Notes

- The test suite stayed independent by construction.
- Dynamic re-imports were used only where module initialization depended on stored state.
- Production code was left unchanged in Wave 1 because the shared-logic slice was already testable through its public interfaces.

## Reuse Guidance For Later Waves

- keep wave boundaries explicit before writing tests
- group tests by behavior so assertions stay readable
- use public entry points before extracting new seams
- reserve aggressive restructuring for files that cannot be tested cleanly through public state transitions
- rerun the full wave command after every assertion or seam change, not only the individual failing file
