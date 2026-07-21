# Wave 2 Frontend Operational Logic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add isolated frontend tests for the operational-logic slice defined in the Wave 2 design.

**Architecture:** Group the Wave 2 files by domain. Clipboard logic is tested through injected dependencies and mocked hooks, graph utilities through pure data fixtures plus DOM CSS variables, and DOM-writing hooks through observable root state and controlled timers. Production changes are permitted only if a module cannot be tested reliably through its public interface.

**Tech Stack:** `vitest`, React Testing Library, `jsdom`, Wave 0 Tauri mocks, Zustand store reset helpers

---

### Task 1: Save Wave 2 Scope Docs

**Files:**
- Create: `docs/superpowers/specs/2026-04-29-wave2-frontend-operational-logic-design.md`
- Create: `docs/superpowers/plans/2026-04-29-wave2-frontend-operational-logic.md`

- [ ] **Step 1: Save the Wave 2 design**

- [ ] **Step 2: Save this Wave 2 implementation plan**

### Task 2: Add Clipboard And Graph Suites

**Files:**
- Create: `src/features/clipboard/clipboardDomain.test.tsx`
- Create: `src/utils/graphUtils.test.ts`

- [ ] **Step 1: Add clipboard domain tests for selection, naming, shortcut targeting, importer/copy flows, and wrapper hooks**

- [ ] **Step 2: Add graph utility tests for color derivation, element mapping, stylesheet fallback reads, and orphan marking**

- [ ] **Step 3: Run the clipboard and graph suites and inspect failures**

- [ ] **Step 4: Apply only the minimum production refactors needed by failing tests**

### Task 3: Add Operational Hook Suites

**Files:**
- Create: `src/hooks/useApplyAppearanceSettings.test.tsx`
- Create: `src/hooks/useApplySpellCheckSettings.test.tsx`

- [ ] **Step 1: Add hook tests for root dataset/CSS var writes, custom var clearing, spellcheck propagation, and observer retry behavior**

- [ ] **Step 2: Run the hook suites and inspect failures**

- [ ] **Step 3: Apply only the minimum production refactors needed by failing tests**

### Task 4: Add Small Helper Suites

**Files:**
- Create: `src/components/Layout/useResizableSidebarWidth.test.tsx`
- Create: `src/components/Sidebar/sidebarContextMenuItems.test.ts`
- Create: `src/components/TrashModal/trashModalLogic.test.ts`

- [ ] **Step 1: Add tests for persisted width clamping, context menu item composition, trash loading logic, item removal, and restore-label formatting**

- [ ] **Step 2: Run the helper suites and inspect failures**

- [ ] **Step 3: Apply only the minimum production refactors needed by failing tests**

### Task 5: Verify And Document

**Files:**
- Create: `docs/qa/2026-04-29-wave2-frontend-operational-logic-standards.md`
- Create: `docs/qa/2026-04-29-wave2-implementation-process.md`

- [ ] **Step 1: Run the full Wave 2 frontend test command**

- [ ] **Step 2: Review the output for fresh pass evidence**

- [ ] **Step 3: Write the IEEE 829 and ISO 29119 aligned Wave 2 QA document**

- [ ] **Step 4: Write the Wave 2 implementation process note**
