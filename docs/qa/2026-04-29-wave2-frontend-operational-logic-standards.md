# Wave 2 Frontend Operational Logic Test Documentation

## Standards Alignment Note

- `ISO/IEC/IEEE 29119` governs the Wave 2 planning, analysis, design, implementation, execution, and completion framing.
- `IEEE 829` governs the document structure used for the Wave 2 Test Plan Summary and Test Design Specification.
- `IEEE 1008` unit-isolation principles are applied to the Wave 2 unit and hook suites through controlled dependencies, deterministic setup/cleanup, and independent test execution.

Wave 2 is a frontend operational-logic coverage wave. It sits above the Wave 1 shared-logic layer and focuses on clipboard flows, DOM-writing hooks, graph utilities, and small state helpers that still expose stable public interfaces.

## Test Plan Summary (IEEE 829 Format)

### Test Plan Identifier

- `TESS-W2-FE-TP-001`

### Introduction

Wave 2 adds independent tests for operational frontend logic that coordinates browser APIs, DOM state, or injected application boundaries without yet entering the heavy editor-extension or plugin-runtime surfaces.

### Test Items

- Clipboard domain:
  - `src/features/clipboard/clipboardSelection.ts`
  - `src/features/clipboard/clipboardImportNaming.ts`
  - `src/features/clipboard/clipboardCopyShortcut.ts`
  - `src/features/clipboard/clipboardFileCopy.ts`
  - `src/features/clipboard/clipboardImport.ts`
  - `src/features/clipboard/useClipboardFileCopy.ts`
  - `src/features/clipboard/useClipboardFilePaste.ts`
- Graph utilities:
  - `src/utils/graphUtils.ts`
- Operational hooks:
  - `src/hooks/useApplyAppearanceSettings.ts`
  - `src/hooks/useApplySpellCheckSettings.ts`
- Small logic helpers:
  - `src/components/Layout/useResizableSidebarWidth.ts`
  - `src/components/Sidebar/sidebarContextMenuItems.ts`
  - `src/components/TrashModal/state.ts`
  - `src/components/TrashModal/formatTrashLabel.ts`

### Features To Be Tested

- clipboard selection pruning, copy shortcut targeting, auto-renaming, and import/copy success/failure handling
- hook wrappers around translated messages, toasts, and mocked Tauri `invoke()`
- graph element mapping, stylesheet construction, and orphan-node marking
- appearance hook DOM dataset and CSS variable writes
- spellcheck hook application, observer handling, and retry path
- persisted sidebar resize behavior and mouse-driven width clamping
- sidebar context menu composition
- trash loading and restore-label formatting

### Features Not To Be Tested

- editor extension modules
- file-tree orchestration hooks
- plugin runtime classes and APIs
- theme scheduling and navigation history orchestration
- heavy React rendering components
- backend Rust modules
- end-to-end desktop workflows

### Approach

- test runner:
  - `Vitest` with `jsdom`
- hook tooling:
  - React Testing Library `renderHook`
- isolation strategy:
  - Wave 0 store reset tracking
  - Wave 0 Tauri mocks
  - fake timers where retry behavior or resize timing is relevant
  - mocked translation hooks and toast emitters for wrapper hooks

Applied techniques:

- Specification-based:
  - `ECP` for valid vs invalid clipboard targets, present vs missing vault paths, managed vs unmanaged spellcheck elements, and file vs directory context menu composition
  - `BVA` for sidebar width clamp bounds and resize edge calculations
- Structure-based:
  - branch-oriented tests for clipboard importer success/error paths, spellcheck observer branches, appearance custom-var toggles, and graph orphan marking
- Error guessing:
  - native clipboard write failure
  - clipboard import failure
  - root-missing observer retry
  - barrel-import cycle exposure

### Item Pass/Fail Criteria

- all Wave 2 targeted test files pass
- every Wave 2 in-scope production file is exercised by at least one automated test
- clipboard and DOM-writing flows remain deterministic under mocks and local fixtures
- the cycle-breaking hook import refactor does not break Wave 2 verification

### Suspension Criteria And Resumption Requirements

- suspend when:
  - Vitest cannot boot
  - DOM-writing hooks leak state across tests
  - mocked clipboard/Tauri boundaries stop resetting
- resume when:
  - runner access is restored
  - leaked DOM state is cleaned up
  - mocks and store reset behavior are restored

### Deliverables

- Wave 2 grouped frontend test suites
- Wave 2 design and implementation plan documents
- this Wave 2 standards-aligned test document
- Wave 2 implementation process note

## Frontend Test Design Specification (IEEE 829)

### Test Design Specification Identifier

- `TESS-W2-FE-TDS-001`

### File Coverage Map

| Production file | Covering test file |
| --- | --- |
| `src/features/clipboard/clipboardSelection.ts` | `src/features/clipboard/clipboardDomain.test.tsx` |
| `src/features/clipboard/clipboardImportNaming.ts` | `src/features/clipboard/clipboardDomain.test.tsx` |
| `src/features/clipboard/clipboardCopyShortcut.ts` | `src/features/clipboard/clipboardDomain.test.tsx` |
| `src/features/clipboard/clipboardFileCopy.ts` | `src/features/clipboard/clipboardDomain.test.tsx` |
| `src/features/clipboard/clipboardImport.ts` | `src/features/clipboard/clipboardDomain.test.tsx` |
| `src/features/clipboard/useClipboardFileCopy.ts` | `src/features/clipboard/clipboardDomain.test.tsx` |
| `src/features/clipboard/useClipboardFilePaste.ts` | `src/features/clipboard/clipboardDomain.test.tsx` |
| `src/utils/graphUtils.ts` | `src/utils/graphUtils.test.ts` |
| `src/hooks/useApplyAppearanceSettings.ts` | `src/hooks/useApplyAppearanceSettings.test.tsx` |
| `src/hooks/useApplySpellCheckSettings.ts` | `src/hooks/useApplySpellCheckSettings.test.tsx` |
| `src/components/Layout/useResizableSidebarWidth.ts` | `src/components/Layout/useResizableSidebarWidth.test.tsx` |
| `src/components/Sidebar/sidebarContextMenuItems.ts` | `src/components/Sidebar/sidebarContextMenuItems.test.ts` |
| `src/components/TrashModal/state.ts` | `src/components/TrashModal/trashModalLogic.test.ts` |
| `src/components/TrashModal/formatTrashLabel.ts` | `src/components/TrashModal/trashModalLogic.test.ts` |

### Features To Be Tested

- clipboard domain selection, naming, copy/import, and wrapper-hook behavior
- graph data mapping and stylesheet fallback construction
- appearance root datasets, palette application, and custom var clearing
- spellcheck propagation across existing nodes, dynamic nodes, and root retry timing
- sidebar resize width persistence and clamp logic
- menu item composition and trash helper logic

### Test Case Specifications

| Test ID | Input | Expected Outcome | Technique Applied |
| --- | --- | --- | --- |
| `W2-FE-001` | selected directory, descendant file, duplicate file, and missing path | selection result is unique and descendant file is excluded | `ECP - Mixed selection classes` |
| `W2-FE-002` | conflicting destination file names | importer naming increments copy suffix until a free candidate is found | `Basis path` |
| `W2-FE-003` | file-tree target vs null target vs unrelated target | copy shortcut handler only accepts file-tree targets | `ECP - Valid/invalid target class` |
| `W2-FE-004` | clipboard copy native success | native writer is called and success notification is emitted | `Specification-based - Valid class` |
| `W2-FE-005` | clipboard copy native failure | failure is logged, error notification is emitted, and result is `false` | `Error guessing - Native failure` |
| `W2-FE-006` | clipboard import with missing vault path | import is rejected and open-vault error is emitted | `ECP - Missing prerequisite` |
| `W2-FE-007` | clipboard import with zero imported paths | import returns `false` and no-files error is emitted | `ECP - Empty result class` |
| `W2-FE-008` | blocked shortcut target such as `INPUT` | shortcut paste is not handled | `ECP - Blocked target class` |
| `W2-FE-009` | graph node tags and orphan flag | mapped element carries color data and orphan class | `Basis path` |
| `W2-FE-010` | stylesheet generation with graph CSS variables | stylesheet rules use the DOM CSS variables and selector-specific fallbacks | `Control flow / branch coverage` |
| `W2-FE-011` | orphan node and connected node | only the node with zero edges gets orphan styling | `Basis path` |
| `W2-FE-012` | valid custom accent color and invalid accent color | palette vars are written for valid input and unchanged for invalid input | `ECP - Valid/invalid color class` |
| `W2-FE-013` | custom appearance vars enabled then disabled | terminal, syntax, and inline-code CSS vars are set then cleared | `Basis path` |
| `W2-FE-014` | repeated identical appearance snapshot | hook skips redundant DOM writes | `Structure-based - Repeated state branch` |
| `W2-FE-015` | managed spellcheck nodes with store change from `false` to `true` | textarea, text-like input, and contenteditable target update attributes | `Basis path` |
| `W2-FE-016` | nodes added after observer attachment and editor-surface attribute mutation | newly added node and editor input receive spellcheck updates | `Control flow / observer branch` |
| `W2-FE-017` | mount before `#root` exists, then attach root later | fallback document scan works and retry path attaches the observer | `Error guessing - Delayed root availability` |
| `W2-FE-018` | persisted width above max and mouse move below min | sidebar width clamps within bounds and persists the clamped value | `BVA - Lower/upper bounds` |
| `W2-FE-019` | directory menu with all callbacks vs file menu | directory-only actions appear only when appropriate | `ECP - File/directory partitions` |
| `W2-FE-020` | trash loading flag and restore parent label | loading shows only on empty pending state and root label gets vault-root wording | `ECP - State partition` |

## ISO/IEC/IEEE 29119 Process Mapping

| ISO 29119 Activity | Wave 2 Application |
| --- | --- |
| Test Planning | define Wave 2 as clipboard, graph, DOM-writing hook, and helper logic |
| Test Monitoring and Control | run the 7-file Wave 2 frontend command and iterate on real failures |
| Test Analysis | identify operational hooks, injected boundaries, and DOM-state branch points |
| Test Design | group the in-scope files into clipboard, graph, hook, and helper suites |
| Test Implementation | add grouped tests and perform the minimum import-boundary refactor required for stability |
| Test Execution | execute the full Wave 2 slice and inspect each failing suite |
| Test Completion | record the passing evidence and publish this standards-aligned document |

## Representative Code Snippets

```tsx
const { result } = renderHook(() => useClipboardFilePaste({
  vaultPath: "Vault",
  refreshVault,
}));

await act(async () => {
  await result.current.handleShortcutPaste(nonBlockedTarget, "Inbox");
});
```

```ts
applyAppearanceCustomCssVars({
  terminalHeaderBg: "#111111",
  terminalLineBg: "#222222",
  terminalBorder: "#333333",
  terminalText: "#444444",
  terminalMuted: "#555555",
  terminalCustom: true,
  syntaxComment: "#666666",
  syntaxKeyword: "#777777",
  syntaxOperator: "#888888",
  syntaxString: "#999999",
  syntaxNumber: "#aaaaaa",
  syntaxVariable: "#bbbbbb",
  syntaxFunction: "#cccccc",
  syntaxCustom: true,
  inlineCodeColor: "#dddddd",
  inlineCodeCustom: true,
});
```

```tsx
act(() => {
  result.current.onResizeStart({ preventDefault() {} } as never);
  window.dispatchEvent(new MouseEvent("mousemove", { clientX: 100 }));
});
expect(result.current.sidebarWidth).toBe(240);
```

## Verification Evidence

- command:
  - `cmd /c npm test -- src\features\clipboard\clipboardDomain.test.tsx src\utils\graphUtils.test.ts src\hooks\useApplyAppearanceSettings.test.tsx src\hooks\useApplySpellCheckSettings.test.tsx src\components\Layout\useResizableSidebarWidth.test.tsx src\components\Sidebar\sidebarContextMenuItems.test.ts src\components\TrashModal\trashModalLogic.test.ts`
- result:
  - `7` test files passed
  - `25` tests passed

## Wave 2 Exit Statement

Wave 2 is complete when the operational frontend slice is covered by independent tests, DOM-writing side effects are verified through observable state, and the targeted verification command passes with fresh evidence.
