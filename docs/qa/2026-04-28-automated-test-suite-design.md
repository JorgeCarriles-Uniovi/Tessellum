# Tessellum Automated Test Suite Design

## Standards Alignment Note

- Overall governance follows `ISO/IEC/IEEE 29119-2:2021` for test processes and `ISO/IEC/IEEE 29119-3:2021` for test documentation outputs.
- The document structure below intentionally preserves the `IEEE 829` shape requested in the task for the Test Plan Summary, Test Design Specifications, and Test Case Specifications.
- Backend unit-test isolation rules intentionally follow `IEEE 1008` principles for documented unit scope, controlled fixtures, deterministic data, and explicit pass/fail checks.
- `IEEE 829-2008` is a superseded standard and was replaced by the ISO/IEC/IEEE 29119 series. The design below keeps the `IEEE 829` document format because you explicitly requested it.

## Test Plan Summary (IEEE 829 Format)

### Test Plan Identifier

- `TESS-TP-001`

### Introduction

This plan defines three coordinated automation suites for Tessellum, a local-first Tauri desktop application built with React, TypeScript, Zustand, SQLite, Tantivy, and Rust. The intent is to validate correctness at UI, service, and system-integration levels while keeping each suite focused, low in cognitive complexity, and reusable.

### Test Items

- Frontend items:
  - `src/stores/settingsStore.ts`
  - `src/stores/editorContentStore.ts`
  - `src/components/InputModal.tsx`
  - `src/components/DeleteConfirmModal.tsx`
  - `src/components/TrashModal/state.ts`
  - `src/components/Sidebar/hooks/useDeleteFile.ts`
  - `src/components/Editor/utils/markdownShortcuts.ts`
- Backend items:
  - `src-tauri/src/utils/validate.rs`
  - `src-tauri/src/trash.rs`
  - `src-tauri/src/commands/notes.rs`
  - `src-tauri/src/commands/search.rs`
  - `src-tauri/src/commands/graph.rs`
  - `src-tauri/src/db.rs`
- System-integration items:
  - vault open flow
  - note creation and persistence
  - search readiness and full-text search
  - trash and restore lifecycle
  - graph rendering and query flow
  - settings persistence across sessions

### Features To Be Tested

- UI rendering, modal accessibility, form submission, keyboard behavior, and Zustand state transitions.
- Input validation by equivalence partitions and boundary values.
- Path validation, trash naming and restoration, controller branching, and search/index coherence.
- Database constraints, vault synchronization, and graph/search integration.
- Critical end-user journeys from vault selection to note lifecycle and graph/search discovery.

### Features Not To Be Tested

- Visual pixel-perfect regression of themes and animations.
- Third-party library internals such as CodeMirror, Tantivy, Grafeo, or Tauri framework code.
- OS-specific installer packaging, updater delivery, and store distribution behavior.

### Approach

- `Frontend suite`: `Vitest + React Testing Library` with `jsdom`, focused on unit and component tests.
- `Backend suite`: `cargo test`, split into isolated unit tests and temporary-resource integration tests.
- `E2E suite`: `Playwright` as the test runner plus `tauri-driver` as the desktop automation transport.

Applied techniques across all suites:

- Specification-based:
  - Equivalence Class Partitioning
  - Boundary Value Analysis
- Structure-based:
  - Basis path and branch-oriented tests for controller and state paths
- Error guessing:
  - null/empty input
  - invalid vault path
  - duplicate names
  - stale index conditions
  - driver startup failure
  - search timeout or readiness retry

### Item Pass/Fail Criteria

- Frontend:
  - `>= 90%` statement coverage on pure state/utility modules
  - `>= 85%` branch coverage on modal and hook decision paths
- Backend:
  - `>= 90%` statement coverage on `trash.rs`, `validate.rs`, and search coherence helpers
  - all controller branches for delete/restore/search/graph success and failure paths exercised
- E2E:
  - all critical journeys pass on Windows
  - smoke execution on Linux where `tauri-driver` prerequisites are available
  - no blocker defects in note lifecycle, search, trash, or graph flows

### Suspension Criteria And Resumption Requirements

- Suspend a suite when:
  - Tauri app boot fails
  - Edge Driver version does not match installed Edge on Windows
  - test vault fixture cannot be created
  - search index or database fixture bootstrap is corrupted
- Resume when:
  - environment mismatch is corrected
  - fixture setup completes successfully
  - failing external dependency is isolated or replaced with a deterministic stub

### Test Deliverables

- frontend test source files and coverage report
- backend test source files and `cargo test` results
- E2E specs, trace bundles, screenshots, and HTML report
- defect log linked to failing test IDs
- execution summary mapped back to this plan

### Testing Tasks

1. Add the frontend runner, shared setup file, and reusable render/store helpers.
2. Expand Rust unit coverage around validation, trash lifecycle, search coherence, and graph assembly.
3. Create temporary-vault integration fixtures for backend commands and search/index flows.
4. Build the desktop E2E harness with a seeded test vault and driver lifecycle fixture.
5. Add CI execution gates for frontend, backend, and E2E suites.

### Environmental Needs

- Node.js `20+`
- Rust stable
- Tauri prerequisites
- Windows:
  - `tauri-driver`
  - matching `msedgedriver.exe`
- Linux CI:
  - `tauri-driver`
  - `WebKitWebDriver`
  - virtual display support when headless

### Responsibilities

- QA automation:
  - maintain suite architecture
  - triage failing tests
  - publish reports
- frontend owner:
  - expose stable selectors and pure helper boundaries where needed
- backend owner:
  - preserve unit-testable functions and deterministic command seams

### Risks And Contingencies

- The current official Tauri documentation supports `tauri-driver` through WebDriver and documents Selenium/WebdriverIO examples, not a Playwright-specific adapter. This design therefore assumes a thin internal bridge that lets Playwright orchestrate the desktop session while `tauri-driver` handles transport.
- If strict official tooling is required with zero custom bridge code, replace the Playwright runner with WebdriverIO while keeping the same scenario catalog and test IDs.

## Recommended Test Repository Layout

```text
docs/qa/
  2026-04-28-automated-test-suite-design.md
src/
  test/
    setup.ts
    renderWithProviders.tsx
  stores/
    settingsStore.test.ts
    editorContentStore.test.ts
  components/
    InputModal.test.tsx
    DeleteConfirmModal.test.tsx
  components/Sidebar/hooks/
    useDeleteFile.test.ts
src-tauri/src/
  utils/validate.rs
  trash.rs
  commands/notes.rs
  commands/search.rs
  commands/graph.rs
e2e/
  fixtures/
    tauriApp.ts
    vaultFactory.ts
  specs/
    note-lifecycle.spec.ts
    search-and-graph.spec.ts
    settings-persistence.spec.ts
```

## Frontend Suite Test Design Specification (IEEE 829)

### Test Design Specification Identifier

- `TESS-FE-TDS-001`

### Features To Be Tested

- persisted settings reads and writes
- editor font-size clamping and state transitions
- modal rendering and keyboard interactions
- delete target normalization and tree pruning
- markdown shortcut toggling logic

### Refinements

- Prefer pure-function extraction before testing hooks with multiple store dependencies.
- Reuse one `renderWithProviders` helper and one `resetBrowserState` helper.
- Keep component assertions user-visible: text, roles, keyboard outcomes, callbacks.

### Technique Allocation

- ECP:
  - valid vs invalid locale values
  - blank vs non-blank modal input
  - single-item vs multi-item delete selection
- BVA:
  - editor font size at `11`, `12`, `24`, `25`
  - preview-name truncation at `4` items
- Structure-based:
  - `toggleMarkdownWrap`
  - `normalizeDeleteTargets`
  - `confirmDelete` success/failure branches
- Error guessing:
  - corrupted `localStorage`
  - empty submission
  - missing vault path
  - failed `invoke("trash_items")`

### Frontend Test Case Specifications

| Test ID | Input | Expected Outcome | Technique Applied |
| --- | --- | --- | --- |
| `FE-UT-001` | `localStorage["tessellum:locale"]="es"` | `readStoredLocale()` returns `es` | `ECP - Valid class` |
| `FE-UT-002` | `localStorage["tessellum:locale"]="de"` | fallback locale is `en` | `ECP - Invalid class` |
| `FE-UT-003` | `nextEditorFontSizePx(16, -10)` | value clamps to `12` | `BVA - Lower boundary` |
| `FE-UT-004` | `nextEditorFontSizePx(16, 20)` | value clamps to `24` | `BVA - Upper boundary` |
| `FE-UT-005` | `toggleMarkdownWrap("abc", { from: 1, to: 1 }, "**")` | paired markers inserted and caret lands inside marker pair | `Basis path - Empty selection branch` |
| `FE-UT-006` | nested selected delete targets containing folder + child note | descendants are removed from delete target set | `Basis path - Folder branch pruning` |
| `FE-CT-001` | `InputModal` opened with whitespace-only value then submit | `onSubmit` is not called and modal remains open | `ECP - Invalid input class` |
| `FE-CT-002` | `InputModal` opened with non-empty value then submit | trimmed value sent to `onSubmit` and `onClose` called | `ECP - Valid input class` |
| `FE-CT-003` | `DeleteConfirmModal` with `5` target names | first `4` names shown, remaining count message shown | `BVA - Preview cutoff` |
| `FE-CT-004` | open delete modal, press `Escape`, then `Enter` in separate tests | close callback fires on `Escape`; confirm callback fires on `Enter` | `Basis path + Error guessing - Keyboard paths` |
| `FE-HT-001` | `useDeleteFile.confirmDelete()` with successful backend response | tree pruned, files removed, success toast shown | `Basis path - Success branch` |
| `FE-HT-002` | `useDeleteFile.confirmDelete()` with thrown invoke error | store untouched, error toast shown | `Error guessing - IPC failure` |

### Representative Frontend Code Snippet

```tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { InputModal } from "../InputModal";
import {
  DEFAULT_EDITOR_FONT_SIZE_PX,
  nextEditorFontSizePx,
} from "../../stores/editorContentStore";
import { readStoredLocale } from "../../stores/settingsStore";

describe("settingsStore", () => {
  it("falls back to the default locale for unsupported values", () => {
    localStorage.setItem("tessellum:locale", "de");
    expect(readStoredLocale()).toBe("en");
  });

  it("clamps editor font size at the supported upper bound", () => {
    expect(DEFAULT_EDITOR_FONT_SIZE_PX).toBe(16);
    expect(nextEditorFontSizePx(16, 20)).toBe(24);
  });
});

describe("InputModal", () => {
  it("rejects blank input and accepts trimmed valid input", async () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();

    render(
      <InputModal
        isOpen
        onClose={onClose}
        onSubmit={onSubmit}
        defaultValue="   "
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /create/i }));
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "  Daily Note  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /create/i }));

    expect(onSubmit).toHaveBeenCalledWith("Daily Note");
    expect(onClose).toHaveBeenCalled();
  });
});
```

## Backend Suite Test Design Specification (IEEE 829 + IEEE 1008)

### Test Design Specification Identifier

- `TESS-BE-TDS-001`

### Unit-Test Methodology Constraints From IEEE 1008

- Each unit test must identify the exact unit under test and isolate external state.
- Filesystem and database interactions use temporary directories or temporary databases.
- Noncritical collaborators are stubbed or bypassed where the branch under test does not need them.
- Assertions must compare actual behavior to documented unit requirements, not implementation accidents.
- Integration tests are separate from unit tests even when they run under `cargo test`.

### Features To Be Tested

- path traversal rejection
- hidden/special path detection
- trash naming, restore collisions, and purge retention boundaries
- daily note path generation
- note search filtering and matching
- search index coherence thresholds
- graph node/edge assembly for orphan and broken-link cases
- database schema behavior for indexed files and search metadata

### Technique Allocation

- ECP:
  - valid vault path vs outside-vault path
  - markdown vs non-markdown files
  - empty query vs partial query vs unmatched query
- BVA:
  - purge retention exactly at `30` days and at `30 days + 1 ms`
  - mismatch threshold at `0`, `100`, and `101`
- Structure-based:
  - `build_graph_data`
  - `search_notes`
  - restore/delete controller paths
- Error guessing:
  - malformed trash filenames
  - corrupted timestamps
  - duplicate destination names
  - invalid canonicalization targets

### Backend Test Case Specifications

| Test ID | Input | Expected Outcome | Technique Applied |
| --- | --- | --- | --- |
| `BE-UT-001` | path inside canonicalized vault | `validate_path_in_vault` returns resolved path | `ECP - Valid class` |
| `BE-UT-002` | path using `..` to escape vault | validation fails with security error | `Error guessing - Path traversal` |
| `BE-UT-003` | purge timestamp exactly at retention boundary | item is kept | `BVA - Exact boundary` |
| `BE-UT-004` | purge timestamp one millisecond older than retention boundary | item is deleted | `BVA - Just outside boundary` |
| `BE-UT-005` | restore when original destination exists | restored file gets `"(Restored)"` suffix | `ECP - Collision class` |
| `BE-UT-006` | malformed trash filename with missing timestamp | parser returns `None` and purge counts invalid item | `Error guessing - Malformed input` |
| `BE-UT-007` | `CoherenceResult` at threshold | `needs_rebuild()` returns `true` | `BVA - Threshold crossing` |
| `BE-CT-001` | graph with existing note, orphan note, and broken target | existing nodes marked correctly; ghost node added for broken target; orphan flagged | `Basis path - Branch coverage` |
| `BE-CT-002` | search query matches title and relative path branches | matching suggestions returned for both branches | `Basis path - Controller branches` |
| `BE-IT-001` | temp DB with indexed files then rebuild search index | DB search metadata updated for current files only | `Integration + ECP` |
| `BE-IT-002` | graph projection after note delete and relink flow | removed links disappear and new graph state is consistent | `Integration + Basis path` |

### Representative Backend Code Snippet

```rust
#[cfg(test)]
mod tests {
    use crate::trash::{
        build_restored_destination_path,
        parse_trash_entry_name,
    };
    use crate::utils::validate::validate_path_in_vault;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn rejects_paths_outside_the_vault() {
        let dir = tempdir().unwrap();
        let vault = dir.path().join("vault");
        let outside = dir.path().join("outside.md");
        fs::create_dir_all(&vault).unwrap();
        fs::write(&outside, "x").unwrap();

        let result = validate_path_in_vault(
            outside.to_str().unwrap(),
            vault.to_str().unwrap(),
        );

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Security Error"));
    }

    #[test]
    fn invalid_trash_names_are_rejected() {
        assert!(parse_trash_entry_name("bad-name.md", false).is_none());
        assert!(parse_trash_entry_name("Note (Root) not-a-timestamp.md", false).is_none());
    }

    #[test]
    fn restore_destination_uses_a_collision_safe_name() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("Note.md"), "existing").unwrap();

        let restored = build_restored_destination_path(dir.path(), "Note.md").unwrap();
        assert_eq!(restored, dir.path().join("Note (Restored).md"));
    }
}
```

## End-to-End Suite Test Design Specification (IEEE 829 + ISO 29119 System Integration Mapping)

### Test Design Specification Identifier

- `TESS-E2E-TDS-001`

### Scope

This suite verifies cross-layer user journeys where frontend state, Tauri commands, filesystem updates, search readiness, and graph data must all remain consistent from the user's perspective.

### ISO 29119 Dynamic Test Sub-Process Mapping

| ISO 29119 Sub-Process | E2E Application In Tessellum |
| --- | --- |
| `Test Planning` | define critical journeys: open vault, create note, search, trash/restore, graph, settings persistence |
| `Test Monitoring and Control` | collect Playwright report, traces, screenshots, driver logs, app logs |
| `Test Analysis` | derive scenarios from README behavior and command boundaries |
| `Test Design` | define seeded vault data, selectors, expected UI and backend outcomes |
| `Test Implementation` | build temp-vault fixture, driver lifecycle fixture, reusable page objects |
| `Test Execution` | run on Windows primary lane and Linux secondary lane |
| `Test Completion` | publish execution summary, failed IDs, traces, and blocker classification |

### E2E Coverage Focus

- Happy path:
  - open seeded vault
  - create and save note
  - discover note by search
  - create wiki link and verify graph visibility
- Edge cases:
  - duplicate note names
  - restore note after trashing
  - empty or delayed search readiness
  - settings persistence after restart

### E2E Test Case Specifications

| Test ID | Input | Expected Outcome | Technique Applied |
| --- | --- | --- | --- |
| `E2E-001` | seeded vault, create note `"Daily Note"` | note appears in file tree, opens in editor, persists after refresh | `Happy path + ECP valid class` |
| `E2E-002` | create second note with duplicate title in same folder | app resolves naming safely and remains responsive | `Error guessing - Duplicate resource` |
| `E2E-003` | search query `content:graph #feature` against seeded notes | matching note list shown with tag-aware filtering | `ECP - Multi-token query class` |
| `E2E-004` | trash active note then restore it from trash modal | note disappears from tree, then returns with content preserved | `Basis path - Delete/restore branches` |
| `E2E-005` | create wiki link between two notes and open graph view | graph shows both nodes and one edge; broken links render as ghost nodes when target missing | `Basis path + Error guessing` |
| `E2E-006` | change language or spellcheck setting and restart app | persisted preference is restored on next launch | `BVA - Session boundary` |
| `E2E-007` | launch with delayed or rebuilding search readiness | UI remains usable and search eventually becomes available without crash | `Error guessing - Timeout/retry` |

### Representative E2E Code Snippet

```ts
import { test, expect } from "@playwright/test";

// Assumption:
// `createTauriApp()` is a thin project fixture that starts `tauri-driver`,
// launches the desktop app, and exposes a Playwright-like page surface.
// This bridge is required because current official Tauri docs document
// WebDriver transport, not a native Playwright adapter.

test("E2E-004 trashes and restores the active note", async ({}, testInfo) => {
  const app = await createTauriApp({
    seedVault: {
      "Inbox/Note A.md": "# Note A\nbody",
    },
    trace: testInfo.outputPath("trace.zip"),
  });

  await app.getByRole("treeitem", { name: "Note A" }).click();
  await app.getByRole("button", { name: /move to trash/i }).click();
  await app.getByRole("button", { name: /move to trash/i }).click();

  await expect(app.getByRole("treeitem", { name: "Note A" })).toHaveCount(0);

  await app.getByRole("button", { name: /trash/i }).click();
  await app.getByRole("button", { name: /restore/i }).click();

  await expect(app.getByRole("treeitem", { name: "Note A" })).toBeVisible();
  await app.getByRole("treeitem", { name: "Note A" }).click();
  await expect(app.getByRole("textbox")).toContainText("body");

  await app.close();
});
```

## Implementation Rollout

1. Add frontend dependencies and a shared Vitest setup with `jsdom` and cleanup hooks.
2. Convert the pure frontend utilities and store slices listed above into first-wave unit targets.
3. Expand Rust `#[cfg(test)]` modules first, then add separate integration-style tests that allocate temporary vault and DB fixtures.
4. Add a seeded-vault factory for desktop E2E tests so every scenario starts from deterministic content.
5. Add CI stages in this order: `cargo test`, frontend unit/component tests, E2E desktop smoke.

## Representative Execution Commands

```bash
# Frontend
npx vitest run --coverage

# Backend
cargo test --manifest-path src-tauri/Cargo.toml

# E2E
cargo install tauri-driver --locked
npx playwright test
```

## Design Outcome

This design gives Tessellum three layered suites with low overlap:

- Frontend tests catch rendering, validation, and state regressions close to the source.
- Backend tests protect business rules, path safety, trash behavior, search coherence, and graph assembly.
- E2E tests verify that the desktop application still behaves correctly when all layers interact through Tauri.
