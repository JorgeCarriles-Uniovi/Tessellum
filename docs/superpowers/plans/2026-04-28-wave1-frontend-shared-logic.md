# Wave 1 Frontend Shared Logic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add isolated, branch-oriented tests for the frontend shared-logic slice defined in the Wave 1 design.

**Architecture:** Group related runtime files into focused Vitest suites. Use dynamic re-imports for persisted stores, Wave 0 store tracking for Zustand isolation, and small local fixtures for Cypher, vault, and i18n scenarios. Production changes are allowed only when a public surface cannot be tested cleanly.

**Tech Stack:** `vitest`, React Testing Library, `jsdom`, Zustand, Tauri mocks from `src/test/tauriMocks.ts`

---

### Task 1: Write Wave 1 Scope Docs

**Files:**
- Create: `docs/superpowers/specs/2026-04-28-wave1-frontend-shared-logic-design.md`
- Create: `docs/superpowers/plans/2026-04-28-wave1-frontend-shared-logic.md`

- [ ] **Step 1: Save the Wave 1 design**

- [ ] **Step 2: Save this execution plan**

### Task 2: Add Pure Logic Test Suites

**Files:**
- Create: `src/constants/constants.test.tsx`
- Create: `src/i18n/i18n.core.test.ts`
- Create: `src/i18n/I18nService.test.ts`
- Create: `src/lib/cypher.test.ts`
- Create: `src/themes/themes.test.ts`
- Create: `src/utils/sharedUtils.test.ts`

- [ ] **Step 1: Add tests for constants, i18n helpers, cypher helpers, theme helpers, and shared utilities**

- [ ] **Step 2: Run the new pure-logic suites and inspect failures**

- [ ] **Step 3: Apply only the minimum production refactors needed by failing tests**

- [ ] **Step 4: Re-run the pure-logic suites until green**

### Task 3: Add Hook And Preference Tests

**Files:**
- Create: `src/hooks/sharedHooks.test.tsx`
- Create: `src/plugins/pluginPreferences.test.ts`

- [ ] **Step 1: Add tests for accessibility CSS overrides, debounce timing, and plugin preference persistence**

- [ ] **Step 2: Run the hook/preference suites and inspect failures**

- [ ] **Step 3: Apply only the minimum production refactors needed by failing tests**

- [ ] **Step 4: Re-run the hook/preference suites until green**

### Task 4: Add Store Test Suites

**Files:**
- Create: `src/stores/basicStores.test.ts`
- Create: `src/stores/persistedStores.test.ts`
- Create: `src/stores/pluginsStore.test.ts`
- Create: `src/stores/searchStore.test.ts`
- Create: `src/stores/vaultStore.test.ts`

- [ ] **Step 1: Add tests for non-persisted stores through public actions**

- [ ] **Step 2: Add dynamic-import tests for persisted stores and malformed `localStorage` branches**

- [ ] **Step 3: Add branch-focused tests for plugin toggling, search readiness, and vault tab fallback behavior**

- [ ] **Step 4: Run the store suites and inspect failures**

- [ ] **Step 5: Apply only the minimum production refactors needed by failing tests**

- [ ] **Step 6: Re-run the store suites until green**

### Task 5: Verify And Document

**Files:**
- Create: `docs/qa/2026-04-28-wave1-frontend-shared-logic-standards.md`
- Create: `docs/qa/2026-04-28-wave1-implementation-process.md`

- [ ] **Step 1: Run the full Wave 1 frontend test command**

- [ ] **Step 2: Review the output for fresh pass evidence**

- [ ] **Step 3: Write the IEEE 829 and ISO 29119 aligned Wave 1 QA document**

- [ ] **Step 4: Write the Wave 1 implementation process note**
