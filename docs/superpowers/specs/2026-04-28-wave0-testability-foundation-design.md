# Wave 0 Testability Foundation Design

**Goal:** Build the shared testing foundation required to later add isolated, branch-oriented tests for every in-scope logic-bearing file in `src` and `src-tauri/src`.

**Scope:** Wave 0 only covers shared test infrastructure, proof tests, and seam extraction needed to make later coverage waves practical. It does not attempt repo-wide coverage.

## Context

Tessellum has a large mixed frontend/backend surface:

- React + Zustand + Tauri APIs on the frontend
- Rust + Tauri commands + filesystem/search/indexing logic on the backend
- high coupling in some frontend hooks and backend command modules

The later coverage program requires:

- independent tests
- strong branch-oriented coverage
- aggressive restructuring where testability demands it

That combination makes a foundation wave mandatory. Without one, later waves would duplicate harness code and create inconsistent isolation rules.

## In-Scope Deliverables

### 1. Frontend foundation

- `vitest` runner configuration integrated into the Vite project
- `jsdom` test environment
- shared setup file for cleanup and matcher registration
- global Tauri module mocks
- reusable helpers for:
  - `localStorage` reset
  - store reset registration
  - component rendering
  - stable async cleanup

### 2. Backend foundation

- repeatable `cargo test` conventions for temporary vault and filesystem fixtures
- reusable test-support helpers for seeded vault creation
- representative proof tests using those helpers

### 3. Production seam extraction

- extract branch-heavy pure helpers from `src/components/Sidebar/hooks/useDeleteFile.ts`
- keep React hook behavior unchanged while making its decision logic independently testable

### 4. Documentation

- implementation plan
- implementation process note
- standards-aligned Wave 0 test documentation using the requested ISO/IEEE framing

## Design Constraints

- keep cognitive complexity low
- prefer pure helper extraction over deep mocking
- avoid behavior changes unrelated to testability
- use one temporary directory per backend test
- reset all shared frontend state after each test
- no tests for `index.*`, `mod.rs`, or CSS-only files

## Architecture

## Frontend foundation architecture

Create a dedicated `src/test/` area with four responsibilities:

- `setup.ts`
  - register `@testing-library/jest-dom`
  - clear mocks after each test
  - reset tracked stores
  - clear `localStorage`
  - reset shared Tauri mocks
- `tauriMocks.ts`
  - central fake implementations for:
    - `@tauri-apps/api/core`
    - `@tauri-apps/api/event`
    - `@tauri-apps/plugin-fs`
    - `@tauri-apps/api/window`
  - expose typed setter/reset helpers for individual tests
- `storeIsolation.ts`
  - track touched Zustand stores
  - capture per-test initial state snapshots
  - restore them in `afterEach`
- `renderWithProviders.tsx`
  - thin wrapper for future provider-based component tests

## Backend foundation architecture

Create one small backend support module that:

- creates temp vault roots
- writes seeded files using relative paths
- returns normalized path helpers for assertions

This support layer must stay minimal. It is a fixture builder, not an abstraction over the application.

## Seam extraction architecture

Move pure delete-flow helpers out of `useDeleteFile.ts` into a standalone module:

- descendant path detection
- target normalization
- removal checks
- fallback active-note resolution
- tree pruning
- error message normalization
- failed-target summary generation

This gives later waves direct branch coverage targets without needing full hook rendering for every branch.

## Proof Strategy

Wave 0 proves the foundation with a small but meaningful set of tests:

- frontend pure logic proof:
  - delete-flow helper branches
- frontend component proof:
  - `InputModal`
  - `DeleteConfirmModal`
- backend proof:
  - temp-vault helper
  - existing validation/trash behavior exercised through isolated tests

## Acceptance Criteria

Wave 0 is complete when:

1. `npm`-based frontend tests run in `vitest`.
2. shared frontend isolation helpers exist and are used by proof tests.
3. shared backend fixture helpers exist and are used by proof tests.
4. `useDeleteFile.ts` decision logic is extracted into a pure module with independent tests.
5. standards-aligned documentation exists for the implemented wave.
6. verification commands pass with fresh evidence.

## Risks

- over-engineering helper layers
- hidden coupling through shared mocks
- store reset logic that misses imported Zustand state
- proof tests that are too trivial to validate the foundation

## Mitigations

- keep helpers focused on repeated setup pain only
- prove each helper with a real test file
- prefer pure helper extraction over broad integration mocks
- document the isolation contract explicitly
