# Wave 0 Test Foundation Documentation

## Standards Alignment Note

- `ISO/IEC/IEEE 29119` governs the Wave 0 process framing, entry/exit criteria, and deliverables.
- `IEEE 829` shapes the documentation structure used below.
- `IEEE 1008` governs the backend unit-test isolation rules used for the Rust fixture support and proof tests.

Wave 0 is a foundation wave. It does not attempt repository-wide coverage. It establishes the infrastructure, isolation rules, and representative proof tests required for later branch-oriented coverage waves.

## Test Plan Summary (IEEE 829 Format)

### Test Plan Identifier

- `TESS-W0-TP-001`

### Introduction

Wave 0 establishes the automated testing foundation for Tessellum. The purpose is to make later per-file tests isolated, repeatable, and strong enough to support branch-oriented coverage across the logic-bearing files in `src` and `src-tauri/src`.

### Test Items

- Frontend foundation:
  - `package.json`
  - `vite.config.ts`
  - `src/test/setup.ts`
  - `src/test/tauriMocks.ts`
  - `src/test/storeIsolation.ts`
  - `src/test/renderWithProviders.tsx`
- Frontend seam extraction:
  - `src/components/Sidebar/hooks/deleteFileLogic.ts`
  - `src/components/Sidebar/hooks/useDeleteFile.ts`
- Frontend proof tests:
  - `src/components/Sidebar/hooks/deleteFileLogic.test.ts`
  - `src/components/InputModal.test.tsx`
  - `src/components/DeleteConfirmModal.test.tsx`
  - `src/test/storeIsolation.test.ts`
  - `src/test/tauriMocks.test.ts`
- Backend foundation:
  - `src-tauri/src/test_support.rs`
  - `src-tauri/src/lib.rs`

### Features To Be Tested

- frontend test runner initialization
- shared Tauri API mocking
- shared Zustand store reset support
- shared component render helper
- extracted delete-flow branch logic
- backend temporary vault fixture creation
- backend validation against seeded fixture paths

### Features Not To Be Tested

- full repository coverage
- end-to-end desktop flows
- visual regression
- performance characteristics

### Approach

- Frontend:
  - `Vitest` with `jsdom`
  - React Testing Library for component proof tests
  - central setup file for cleanup and isolation
- Backend:
  - `cargo test`
  - minimal fixture builder using one temp directory per test

Applied techniques:

- Specification-based:
  - ECP for blank vs valid input and default vs overridden mock behavior
  - BVA for bulk-delete preview truncation
- Structure-based:
  - branch-oriented tests for delete-flow helpers
  - backend fixture validation path
- Error guessing:
  - blank modal submit
  - reset of mutated shared mocks
  - reset of mutated store state

### Item Pass/Fail Criteria

- All Wave 0 proof tests pass.
- Frontend setup can execute targeted test files without ad hoc per-file environment code.
- Backend fixture support can seed a vault and support real validation logic.
- The extracted delete-flow module preserves hook behavior and exposes branchable pure functions.

### Suspension Criteria And Resumption Requirements

- Suspend when:
  - frontend runner cannot boot
  - test mocks leak state between tests
  - backend fixture helper cannot create isolated temp vaults
- Resume when:
  - runner configuration is corrected
  - reset helpers are fixed
  - temp fixture support is restored

### Deliverables

- shared frontend test harness
- shared backend test fixture support
- proof tests
- implementation process note
- this standards-aligned Wave 0 document

## Frontend Test Design Specification (IEEE 829)

### Test Design Specification Identifier

- `TESS-W0-FE-TDS-001`

### Features To Be Tested

- delete-flow helper branching
- blank vs trimmed modal input
- bulk-delete preview rendering
- keyboard callback behavior
- reset behavior for tracked stores
- reset behavior for shared Tauri mocks

### Test Case Specifications

| Test ID | Input | Expected Outcome | Technique Applied |
| --- | --- | --- | --- |
| `W0-FE-001` | folder target plus descendant note target | descendant is removed from normalized target set | `Basis path` |
| `W0-FE-002` | active note in last tab with only one removable target | previous non-removed tab becomes fallback note | `Basis path` |
| `W0-FE-003` | four preview names plus one extra | preview shows first four names and `"and 1 more"` | `BVA - Preview cutoff` |
| `W0-FE-004` | `InputModal` with whitespace-only value | `onSubmit` is not called | `ECP - Invalid class` |
| `W0-FE-005` | `InputModal` with `"  Daily Note  "` | `onSubmit("Daily Note")` and close callback | `ECP - Valid class` |
| `W0-FE-006` | tracked selection store mutated after snapshot | `resetTrackedStores()` restores initial empty selection | `Error guessing - Shared state reset` |
| `W0-FE-007` | mocked Tauri invoke/exists overridden then reset | defaults restored after `resetTauriMocks()` | `Error guessing - Shared mock reset` |

## Backend Unit Test Notes (IEEE 1008)

### Test Design Specification Identifier

- `TESS-W0-BE-TDS-001`

### Unit Isolation Rules Applied

- each backend proof test creates its own temp vault root
- the filesystem fixture is local to the test and disposed automatically
- the validation test uses a real seeded path inside the temp vault
- assertions compare observed behavior to the helper contract, not implementation details

### Backend Test Case Specifications

| Test ID | Input | Expected Outcome | Technique Applied |
| --- | --- | --- | --- |
| `W0-BE-001` | `TestVault::new().with_markdown("Inbox/Note.md", "# Note")` | file exists at seeded relative path after build | `Specification-based - Valid class` |
| `W0-BE-002` | seeded file path plus vault root path | `validate_path_in_vault()` returns `Ok(...)` | `Structure-based + Unit isolation` |

## ISO/IEC/IEEE 29119 Process Mapping

| ISO 29119 Activity | Wave 0 Application |
| --- | --- |
| Test Planning | define Wave 0 scope, entry/exit criteria, and proof targets |
| Test Monitoring and Control | use targeted frontend and backend verification commands |
| Test Analysis | identify harness gaps, shared-state risks, and seam-extraction target |
| Test Design | define proof tests for harness behavior and extracted logic |
| Test Implementation | add shared setup, mocks, fixture builder, and extracted pure helper |
| Test Execution | run targeted frontend proof tests and backend fixture tests |
| Test Completion | document implementation and verification evidence |

## Representative Code Snippets

```tsx
renderWithProviders(
  <InputModal
    isOpen
    onClose={onClose}
    onSubmit={onSubmit}
    defaultValue="   "
  />,
);
```

```rust
let vault = TestVault::new()
    .with_markdown("Inbox/Note.md", "# Note")
    .build();
assert!(vault.path().join("Inbox/Note.md").exists());
```

## Wave 0 Exit Statement

Wave 0 is complete when the shared frontend/backend testability infrastructure exists, the proof tests pass, and the isolation contract is established for later subsystem waves.
