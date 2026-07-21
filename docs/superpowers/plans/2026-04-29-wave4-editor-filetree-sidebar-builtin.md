# Wave 4 Editor, FileTree, Sidebar, and Builtin Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete automated branch-oriented coverage for the remaining editor, file-tree, sidebar-hook, and builtin-plugin frontend logic.

**Architecture:** Execute one umbrella wave in four internal phases. Start with pure editor logic and low-coupling plugin registration, then move into editor runtime orchestration, file-tree/sidebar logic, and finally builtin-plugin interaction coverage that depends on the earlier harness work.

**Tech Stack:** `vitest`, `@testing-library/react`, shared Zustand reset helpers, shared Tauri mocks, lightweight CodeMirror/runtime mocks

---

### Task 1: Phase 4A Coverage

**Files:**
- Modify: `src/test/tauriMocks.ts`
- Create: `src/components/Editor/editorPureLogic.test.ts`
- Create: `src/plugins/builtin/builtinPluginBasics.test.tsx`

- [ ] Write failing tests for pure editor helpers and low-coupling builtin plugin wrappers.
- [ ] Run targeted Phase 4A tests and confirm the intended failures.
- [ ] Add only the minimal mock extensions or tiny seams needed to make Phase 4A practical.
- [ ] Re-run Phase 4A tests until green.

Verification command:

```powershell
cmd /c npm test -- src\components\Editor\editorPureLogic.test.ts src\plugins\builtin\builtinPluginBasics.test.tsx
```

### Task 2: Phase 4B Coverage

**Files:**
- Create: `src/components/Editor/editorRuntimeHooks.test.tsx`
- Create: `src/components/Editor/editorExtensions.test.ts`
- Modify: editor runtime files only if small seam extraction is required

- [ ] Write failing tests for editor hooks, extension hosts, and higher-coupling editor logic.
- [ ] Verify red state with the targeted Phase 4B command.
- [ ] Add minimal implementation or seam extractions where tests expose branch-access gaps.
- [ ] Re-run the targeted Phase 4B suite until green.

Verification command:

```powershell
cmd /c npm test -- src\components\Editor\editorRuntimeHooks.test.tsx src\components\Editor\editorExtensions.test.ts
```

### Task 3: Phase 4C Coverage

**Files:**
- Create: `src/components\FileTree\fileTreeLogic.test.tsx`
- Create: `src/components\Sidebar\hooks\sidebarHooks.test.tsx`

- [ ] Write failing tests for file-tree hooks, file-tree components with logic-bearing behavior, and sidebar hooks.
- [ ] Verify red state for contextual create/rename/delete/clipboard branches.
- [ ] Add only the minimal extraction needed if a file cannot be isolated cleanly.
- [ ] Re-run the targeted Phase 4C suite until green.

Verification command:

```powershell
cmd /c npm test -- src\components\FileTree\fileTreeLogic.test.tsx src\components\Sidebar\hooks\sidebarHooks.test.tsx
```

### Task 4: Phase 4D Coverage

**Files:**
- Create: `src\plugins\builtin\builtinPluginInteractions.test.tsx`
- Create or extend: remaining editor integration-facing test files created in Tasks 1 to 3

- [ ] Write failing tests for builtin plugin UI interactions, translations, and remaining integration-facing branches.
- [ ] Verify red state with the targeted Phase 4D command.
- [ ] Implement any final seam needed to keep plugin-interaction tests deterministic.
- [ ] Re-run the targeted Phase 4D suite until green.

Verification command:

```powershell
cmd /c npm test -- src\plugins\builtin\builtinPluginInteractions.test.tsx
```

### Task 5: Wave 4 Documentation and Final Verification

**Files:**
- Create: `docs/qa/2026-04-29-wave4-editor-filetree-sidebar-builtin-standards.md`
- Create: `docs/qa/2026-04-29-wave4-implementation-process.md`

- [ ] Run the full Wave 4 targeted suite across all phase files.
- [ ] Write the IEEE 829 and ISO 29119 aligned documentation.
- [ ] Run a placeholder scan on Wave 4 docs and test files.

Verification command:

```powershell
cmd /c npm test -- src\components\Editor\editorPureLogic.test.ts src\plugins\builtin\builtinPluginBasics.test.tsx src\components\Editor\editorRuntimeHooks.test.tsx src\components\Editor\editorExtensions.test.ts src\components\FileTree\fileTreeLogic.test.tsx src\components\Sidebar\hooks\sidebarHooks.test.tsx src\plugins\builtin\builtinPluginInteractions.test.tsx
```
