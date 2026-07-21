# Wave 2 Frontend Operational Logic Test Design

**Goal:** Add isolated, branch-oriented tests for the next frontend logic slice: operational hooks, clipboard domain logic, graph utilities, and small non-visual state helpers that sit above the Wave 1 shared-logic layer but below heavy UI orchestration.

**Scope:** Wave 2 covers runtime logic in `src/` that still has clear public surfaces but coordinates DOM state, clipboard behavior, or operational helpers. It intentionally avoids the editor-extension surface, file-tree orchestration, plugin runtime APIs, and cross-store navigation/theme scheduling for now.

## In-Scope Files

### Clipboard Domain

- `src/features/clipboard/clipboardSelection.ts`
- `src/features/clipboard/clipboardImportNaming.ts`
- `src/features/clipboard/clipboardCopyShortcut.ts`
- `src/features/clipboard/clipboardFileCopy.ts`
- `src/features/clipboard/clipboardImport.ts`
- `src/features/clipboard/useClipboardFileCopy.ts`
- `src/features/clipboard/useClipboardFilePaste.ts`

### Graph Utility Logic

- `src/utils/graphUtils.ts`

### Operational Hooks

- `src/hooks/useApplyAppearanceSettings.ts`
- `src/hooks/useApplySpellCheckSettings.ts`

### Small Logic Helpers Under UI Directories

- `src/components/Layout/useResizableSidebarWidth.ts`
- `src/components/Sidebar/sidebarContextMenuItems.ts`
- `src/components/TrashModal/state.ts`
- `src/components/TrashModal/formatTrashLabel.ts`

## Out Of Scope

- editor extension and editor hook modules
- file-tree hooks
- plugin runtime classes and plugin APIs
- `useApplyAccessibilitySettings.ts`
- `useApplyThemeSchedule.ts`
- `useWorkspaceNavigationHistory.ts`
- `navigationHistoryStore.ts`
- `themeStore.ts`
- rendering-heavy React components

## Design Constraints

- every test remains independent
- branch-oriented assertions take priority over snapshot-only checks
- production seams are added only if the public surface is insufficient for stable testing
- DOM-writing hooks must be verified by observable root state, not internal implementation details
- clipboard tests must avoid real OS clipboard access and rely on injected/mocked boundaries

## Test Architecture

### Test Grouping

- `src/features/clipboard/clipboardDomain.test.tsx`
- `src/utils/graphUtils.test.ts`
- `src/hooks/useApplyAppearanceSettings.test.tsx`
- `src/hooks/useApplySpellCheckSettings.test.tsx`
- `src/components/Layout/useResizableSidebarWidth.test.tsx`
- `src/components/Sidebar/sidebarContextMenuItems.test.ts`
- `src/components/TrashModal/trashModalLogic.test.ts`

### Isolation Strategy

- use the Wave 0 storage and Tauri mock cleanup after each test
- track Zustand stores touched by hook tests
- use fake timers for retry and debounce-like DOM observer flows
- replace translation hooks and toast emitters with module mocks in clipboard hook tests
- verify DOM side effects directly on `document.documentElement` or temporary test nodes

## Branch Focus

- clipboard selection:
  - duplicate selection
  - directory descendant filtering
  - missing selected paths
- clipboard import/copy:
  - success
  - empty clipboard import
  - missing vault
  - thrown native error
  - blocked shortcut target
- graph utilities:
  - tag-derived node coloring
  - fallback CSS variable resolution
  - orphan vs connected node marking
- appearance hook:
  - custom accent palette application
  - custom terminal/syntax/inline-code var toggles
  - repeated identical snapshots should not reapply
- spellcheck hook:
  - root present vs fallback document scan
  - managed node detection
  - observer handling for added nodes and active editor surfaces
  - retry path when `#root` is initially unavailable
- resizable sidebar:
  - persisted width loading
  - clamp lower/upper bounds
  - left vs right calculations
  - cleanup on mouse up
- context menu and trash helpers:
  - directory-only options
  - copy availability
  - trash loading and item removal
  - root vs nested restore label

## Acceptance Criteria

Wave 2 is complete when:

1. every Wave 2 in-scope production file is exercised by at least one independent automated test
2. DOM-writing hooks are validated through observable side effects
3. clipboard flows are fully mocked and deterministic
4. targeted Wave 2 verification passes with fresh evidence
5. standards-aligned Wave 2 documentation is written after implementation
