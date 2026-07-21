# Wave 0 Implementation Process

This document records the step-by-step implementation used for the Wave 0 testability foundation.

## 1. Wrote the design and plan

- Created the Wave 0 design spec in `docs/superpowers/specs/2026-04-28-wave0-testability-foundation-design.md`.
- Created the Wave 0 implementation plan in `docs/superpowers/plans/2026-04-28-wave0-testability-foundation.md`.

## 2. Added the frontend test toolchain

- Installed `vitest`, `jsdom`, `@testing-library/react`, and `@testing-library/jest-dom`.
- Added `npm test` and `npm run test:watch` scripts.
- Extended `vite.config.ts` with a `vitest` configuration section.

## 3. Built the shared frontend isolation layer

- Created `src/test/setup.ts` to centralize:
  - DOM cleanup
  - store reset
  - Tauri mock reset
  - browser storage cleanup
- Created `src/test/tauriMocks.ts` to provide deterministic global mocks for:
  - `@tauri-apps/api/core`
  - `@tauri-apps/api/event`
  - `@tauri-apps/plugin-fs`
  - `@tauri-apps/plugin-dialog`
  - `@tauri-apps/api/window`
- Created `src/test/storeIsolation.ts` to snapshot and restore Zustand store state.
- Created `src/test/renderWithProviders.tsx` as the shared component-render entry point.

## 4. Extracted a testability seam from the delete flow

- Moved the branch-heavy pure logic out of `src/components/Sidebar/hooks/useDeleteFile.ts`.
- Created `src/components/Sidebar/hooks/deleteFileLogic.ts`.
- Preserved hook behavior while exposing pure helpers for independent testing:
  - descendant detection
  - target normalization
  - path removal checks
  - fallback active-note resolution
  - tree pruning
  - delete error normalization
  - failure summary generation

## 5. Added representative frontend proof tests

- Added `deleteFileLogic.test.ts` for branch-oriented helper coverage.
- Added `InputModal.test.tsx` for blank and trimmed-submit behavior.
- Added `DeleteConfirmModal.test.tsx` for preview cutoff and keyboard callbacks.
- Added `storeIsolation.test.ts` to prove tracked Zustand reset behavior.
- Added `tauriMocks.test.ts` to prove deterministic Tauri mock reset behavior.

## 6. Added backend fixture support

- Declared `src-tauri/src/test_support.rs` behind `#[cfg(test)]`.
- Implemented a minimal `TestVault` builder using `tempfile::TempDir`.
- Added tests proving:
  - seeded markdown files are created
  - seeded vault paths work with `validate_path_in_vault`

## 7. Verified the implemented foundation

- Ran the focused frontend proof tests through `npm test`.
- Ran the backend fixture proof test through `cargo test`.
- Prepared this standards-aligned documentation after the implementation and verification steps.

## Result

Wave 0 now provides a repeatable starting point for later subsystem coverage waves. The repo has a shared frontend harness, a shared backend temp-vault fixture, an extracted pure seam from the delete flow, and proof tests that validate the foundation itself.
