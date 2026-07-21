# Wave 5 Editor Host and File Tree Standards Package

## 1. Test Plan Summary (IEEE 829)

### 1.1 Test Plan Identifier

- `TP-W5-FE-HOSTTREE-2026-04-29`

### 1.2 Introduction

Wave 5 covers the remaining editor host and file-tree component logic that was still untested after the earlier shared-logic, orchestration, and Wave 4 slices. The emphasis is on branch-heavy frontend behavior: menu coordination, keyboard control, state guards, preview metadata generation, and tree selection semantics.

### 1.3 Test Items

- `src/components/Editor/Editor.tsx`
- `src/components/Editor/editorViewHelpers.ts`
- `src/components/Editor/CalloutPicker.tsx`
- `src/components/Editor/SlashMenu.tsx`
- `src/components/Editor/TableSizePicker.tsx`
- `src/components/Editor/TabStrip.tsx`
- `src/components/Editor/WikiLinkSuggestionsMenu.tsx`
- `src/components/Editor/workspaceOverview/WorkspaceOverview.tsx`
- `src/components/Editor/hooks/useEditorExtensions.ts`
- `src/components/Editor/hooks/usePropertyAutocomplete.ts`
- `src/components/Editor/hooks/useSlashCommand.ts`
- `src/components/Editor/hooks/useTagAutocomplete.ts`
- `src/components/Editor/hooks/useWikiLinkSuggestions.ts`
- `src/components/Editor/hooks/slashCommandLogic.ts`
- `src/components/Editor/hooks/wikiLinkSuggestionsLogic.ts`
- `src/components/FileTree/FileTree.tsx`
- `src/components/FileTree/FileNode.tsx`

### 1.4 Features To Be Tested

- Editor empty-state action selection
- Markdown preview metadata generation and relative-time formatting
- Slash and wikilink context parsing
- Editor extension assembly with cache-hit, load-success, and load-failure paths
- Property and tag autocomplete loading branches
- Menu keyboard navigation, hover selection, outside-click close, and confirm flows
- Tab drag-reorder activation and cleanup
- Workspace overview navigation and close behavior
- File-tree selection, range selection, keyboard expansion, and context-menu behavior

### 1.5 Features Not To Be Tested

- CSS-only files
- `index` barrel files
- Files assigned to later frontend or backend waves
- Full end-to-end flows

### 1.6 Approach

- ISO/IEC/IEEE 29119 governs the overall test process and traceability.
- IEEE 829 governs the structure of this test plan summary, the test design specification, and the test case specification.
- IEEE 1008 principles are applied to the isolated helper and hook tests where unit behavior must be verified without shared runtime state.
- Strong branch-oriented coverage is required. The suites target keyboard branches, guard clauses, action routing, and interaction-state transitions.

### 1.7 Item Pass/Fail Criteria

- All targeted Wave 5 tests pass.
- Each in-scope file above has direct automated coverage.
- No test depends on execution order or leaked singleton/store state.

### 1.8 Suspension and Resumption Criteria

- Suspend if a host component cannot be tested without behavior-changing refactors.
- Resume after introducing a minimal seam that preserves production behavior.

### 1.9 Test Deliverables

- Wave 5 Vitest suites
- Wave 5 design and plan artifacts
- This standards package
- Wave 5 implementation-process log

### 1.10 Environmental Needs

- `vitest`
- `@testing-library/react`
- `jsdom`
- Shared Tauri mocks from `src/test/tauriMocks.ts`
- Shared Zustand reset support from `src/test/storeIsolation.ts`

### 1.11 Responsibilities

- Codex authored the Wave 5 tests and documentation.
- Repository maintainers review branch adequacy and approve later waves.

### 1.12 Risks and Contingencies

- Large host components can hide pure logic inside hard-to-mock closures.
- Keyboard-driven UI branches can become flaky if focus and scroll behavior are not controlled.
- Singleton app state can leak between tests if not reset.

Mitigation:

- Extract pure helper seams before deep component tests
- Replace unstable runtime surfaces with lightweight deterministic mocks
- Reset tracked stores and singleton app state after each case

## 2. Test Design Specification (IEEE 829)

### 2.1 Test Design Identifier

- `TDS-W5-FE-HOSTTREE-2026-04-29`

### 2.2 Features To Be Tested

1. Editor host helpers
2. Editor interaction hooks
3. Editor menu and host components
4. File-tree component logic

### 2.3 Approach Refinement

- Specification-based:
  - ECP partitions open-vault vs open-note empty states, valid vs invalid slash/wikilink triggers, populated vs empty menu datasets, and selected vs unselected tree nodes.
  - BVA targets zero/one-minute time boundaries, drag activation threshold, and menu-grid size bounds.
- Structure-based:
  - Basis-path style tests cover slash context guards, wikilink alias branches, code-language loader success/failure, read-only editor guards, and file-tree keyboard/control-flow branches.
- Error guessing:
  - Backend autocomplete failure, invalid slash/wikilink context, empty folder paths, and non-draggable tab movement are covered explicitly.

### 2.4 Feature-to-Suite Mapping

- `src/components/Editor/editorViewHelpers.ts`
- `src/components/Editor/hooks/slashCommandLogic.ts`
- `src/components/Editor/hooks/wikiLinkSuggestionsLogic.ts`
  - [src/components/Editor/editorHostHelpers.test.ts](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src/components/Editor/editorHostHelpers.test.ts)
- `src/components/Editor/hooks/useEditorExtensions.ts`
- `src/components/Editor/hooks/usePropertyAutocomplete.ts`
- `src/components/Editor/hooks/useSlashCommand.ts`
- `src/components/Editor/hooks/useTagAutocomplete.ts`
- `src/components/Editor/hooks/useWikiLinkSuggestions.ts`
  - [src/components/Editor/editorInteractionHooks.test.tsx](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src/components/Editor/editorInteractionHooks.test.tsx)
- `src/components/Editor/CalloutPicker.tsx`
- `src/components/Editor/SlashMenu.tsx`
- `src/components/Editor/TableSizePicker.tsx`
- `src/components/Editor/TabStrip.tsx`
- `src/components/Editor/WikiLinkSuggestionsMenu.tsx`
- `src/components/Editor/workspaceOverview/WorkspaceOverview.tsx`
  - [src/components/Editor/editorHostComponents.test.tsx](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src/components/Editor/editorHostComponents.test.tsx)
- `src/components/Editor/Editor.tsx`
  - [src/components/Editor/Editor.test.tsx](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src/components/Editor/Editor.test.tsx)
- `src/components/FileTree/FileTree.tsx`
- `src/components/FileTree/FileNode.tsx`
  - [src/components/FileTree/fileTreeComponents.test.tsx](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src/components/FileTree/fileTreeComponents.test.tsx)

## 3. Test Case Specifications (IEEE 829)

| Test ID | Test Item | Input | Expected Outcome | Technique |
|---|---|---|---|---|
| `W5-HELP-001` | `editorViewHelpers` | Frontmatter block tags plus markdown body | Tags are normalized and preview text is stripped and collapsed | ECP Valid Structured Input |
| `W5-HELP-002` | `editorViewHelpers` | Markdown that collapses to empty text | Empty preview fallback is returned | ECP Empty Partition |
| `W5-HELP-003` | `editorViewHelpers` | Timestamp in milliseconds and relative-time boundary inputs | Timestamp is normalized and boundary wording is correct | BVA Time Boundary |
| `W5-HELP-004` | `slashCommandLogic` | Valid slash trigger, invalid spaced trigger | Valid context returns query and absolute position; invalid branch returns `null` | Basis Path |
| `W5-HELP-005` | `wikiLinkSuggestionsLogic` | Simple, aliased, escaped, and closed wikilinks | Only valid open contexts return parse data | Basis Path + Error Guessing |
| `W5-HOOK-001` | `usePropertyAutocomplete` | Successful backend property load | Properties are stored and filtered case-insensitively | ECP Valid Data |
| `W5-HOOK-002` | `useTagAutocomplete` | Backend error | Tags remain empty and failure is contained | Error Guessing |
| `W5-HOOK-003` | `useEditorExtensions` | Cached languages, loaded languages, source-mode plugin set | Visible plugin IDs and language bundles are assembled correctly | Basis Path + ECP |
| `W5-HOOK-004` | `useEditorExtensions` | Bundle loader rejection | Hook falls back to an empty language list | Error Guessing |
| `W5-HOOK-005` | `useSlashCommand` | Valid slash view and invalid non-slash view | Command text is inserted only when slash context exists | Basis Path |
| `W5-HOOK-006` | `useWikiLinkSuggestions` | Simple and aliased wikilink insertion | Text replacement and cursor placement are correct in both branches | ECP + Basis Path |
| `W5-CMP-001` | `CalloutPicker` | Open picker, hover item, press Enter, click outside | Selection updates, chosen callout is emitted, outside click closes picker | Basis Path |
| `W5-CMP-002` | `TableSizePicker` | Keyboard arrow movement and Enter/Escape | Hover dimensions update, selection confirms, escape closes | BVA Grid Boundary |
| `W5-CMP-003` | `SlashMenu` | Populated command list | Hover and click route to the correct command | ECP Valid List |
| `W5-CMP-004` | `WikiLinkSuggestionsMenu` | Empty suggestions then populated suggestions | Empty state renders, highlight appears, selection and close work | ECP Empty/Non-empty Partition |
| `W5-CMP-005` | `TabStrip` | Active tab, close action, drag beyond threshold | Tab changes, closes, overview toggles, reorder dispatches, UI cleanup occurs | Basis Path + BVA Drag Threshold |
| `W5-CMP-006` | `WorkspaceOverview` | Open overview with two cards, keyboard navigation, Enter/Escape | Focus moves, selection fires for the current card, escape closes | Basis Path |
| `W5-CMP-007` | `Editor` | No active note with and without vault path | Correct empty-state action and copy are shown for each branch | ECP Valid/Invalid Precondition |
| `W5-CMP-008` | `Editor` | Media note vs markdown note in reading/live-preview modes | Media branch renders preview; read-only blocks edits; editable mode forwards changes | Basis Path |
| `W5-TREE-001` | `FileNode` | Single click and modifier click | Single click opens/selects; modifier click toggles selection only | Basis Path |
| `W5-TREE-002` | `FileNode` | Context menu and directory arrow keys | Context menu preselects; right/left arrows expand/collapse | Basis Path |
| `W5-TREE-003` | `FileNode` | Empty directory branch | Empty directory label renders when folder is open | ECP Empty Collection |
| `W5-TREE-004` | `FileTree` | Shift-click across visible nodes | Range selection covers all visible nodes in order | Basis Path |
| `W5-TREE-005` | `FileTree` | Drag-intent mouse down on rendered node | Drag handler is forwarded with node and selection context | ECP Valid Drag Start |

## 4. ISO/IEC/IEEE 29119 Sub-process Mapping

| ISO 29119 Sub-process | Wave 5 Application |
|---|---|
| Test Monitoring and Control | Wave 5 scope was fixed to editor host and file-tree component logic only |
| Test Analysis | Remaining host-level logic files were inventoried from `src/components/Editor` and `src/components/FileTree` |
| Test Design | Branch targets were defined around keyboard control, state guards, selection semantics, and host action routing |
| Test Implementation | Pure helper seams were extracted and isolated Vitest suites were authored |
| Test Execution | Targeted Vitest command executed against only the Wave 5 suites |
| Test Completion | Scope, results, and traceability were recorded in this standards package and the implementation log |

## 5. Representative Code Samples

- Editor helper sample: [src/components/Editor/editorHostHelpers.test.ts](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src/components/Editor/editorHostHelpers.test.ts)
- Editor hook sample: [src/components/Editor/editorInteractionHooks.test.tsx](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src/components/Editor/editorInteractionHooks.test.tsx)
- Editor host component sample: [src/components/Editor/Editor.test.tsx](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src/components/Editor/Editor.test.tsx)
- File-tree component sample: [src/components/FileTree/fileTreeComponents.test.tsx](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src/components/FileTree/fileTreeComponents.test.tsx)
