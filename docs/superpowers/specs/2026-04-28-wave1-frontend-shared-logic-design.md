# Wave 1 Frontend Shared Logic Test Design

**Goal:** Add isolated, branch-oriented frontend tests for the next repo-wide coverage slice: shared logic modules that do not require full editor, graph canvas, or plugin-runtime orchestration.

**Scope:** Wave 1 covers frontend shared logic files in `src/` that carry reusable behavior and can be tested independently on top of the Wave 0 harness. It does not cover UI-heavy components, editor extensions, graph canvas rendering, plugin runtime APIs, or cross-store orchestration files.

## In-Scope Files

### Constants

- `src/constants/callout-types.ts`
- `src/constants/editorModes.tsx`
- `src/constants/shortcuts.ts`

### I18n Core

- `src/i18n/types.ts`
- `src/i18n/spellcheck.ts`
- `src/i18n/resources.ts`
- `src/i18n/formatters.ts`
- `src/i18n/I18nService.ts`

### Shared Library Modules

- `src/lib/utils.ts`
- `src/lib/cypherQuerySamples.ts`
- `src/lib/cypherQueryNormalizer.ts`
- `src/lib/cypherGraphFilter.ts`

### Theme Logic

- `src/themes/themeTokens.ts`
- `src/themes/themeUtils.ts`
- `src/themes/builtinThemes.ts`

### Shared Utilities

- `src/utils/pathUtils.ts`
- `src/utils/noteUtils.ts`
- `src/utils/fileType.ts`
- `src/utils/outline.ts`
- `src/utils/tagExtraction.ts`

### Shared Hooks

- `src/hooks/accessibilityCssVars.ts`
- `src/hooks/useDebouncedValue.ts`

### Low-Coupling Stores

- `src/stores/accessibilityStore.ts`
- `src/stores/appearanceStore.ts`
- `src/stores/editorContentStore.ts`
- `src/stores/editorModeStore.ts`
- `src/stores/graphStore.ts`
- `src/stores/pluginsStore.ts`
- `src/stores/searchStore.ts`
- `src/stores/selectionStore.ts`
- `src/stores/settingsStore.ts`
- `src/stores/uiStore.ts`
- `src/stores/vaultStore.ts`

### Supporting Production Logic Needed By Store Tests

- `src/plugins/pluginPreferences.ts`

## Out Of Scope

- `index.*`, `main.tsx`, CSS-only files, and type-only files with no runtime logic
- `src/App.tsx`
- editor surface components and editor extension modules
- graph rendering modules such as `src/utils/graphUtils.ts`
- plugin runtime classes and APIs outside `pluginPreferences.ts`
- cross-store orchestration files such as `navigationHistoryStore.ts`, `themeStore.ts`, and `useWorkspaceNavigationHistory.ts`

## Design Constraints

- every test must be independent
- branch-oriented assertions take priority over snapshot-style tests
- keep cognitive complexity low by grouping related assertions around a single module family
- prefer dynamic module reloads over mutating imported singleton state when initialization depends on `localStorage`
- only extract production seams if a file cannot be tested cleanly through its public surface

## Test Architecture

### Test Grouping

Wave 1 uses grouped test files so the coverage slice stays manageable without mixing unrelated state:

- `src/constants/constants.test.tsx`
- `src/i18n/i18n.core.test.ts`
- `src/i18n/I18nService.test.ts`
- `src/lib/cypher.test.ts`
- `src/themes/themes.test.ts`
- `src/utils/sharedUtils.test.ts`
- `src/hooks/sharedHooks.test.tsx`
- `src/plugins/pluginPreferences.test.ts`
- `src/stores/basicStores.test.ts`
- `src/stores/persistedStores.test.ts`
- `src/stores/pluginsStore.test.ts`
- `src/stores/searchStore.test.ts`
- `src/stores/vaultStore.test.ts`

### Isolation Strategy

- use `vi.resetModules()` before re-importing modules whose initial state depends on `localStorage`
- register each Zustand store with the Wave 0 `trackStore()` helper before mutating it
- reset Tauri mocks after every test through the shared Wave 0 setup
- keep graph and search fixtures local to each test function
- use fake timers only within the debounce hook suite

## Branch Focus

Wave 1 emphasizes these branch-heavy areas:

- Cypher normalization and filter parsing:
  - empty input
  - invalid syntax
  - shorthand normalization
  - relation direction handling
  - predicate combinations
- theme parsing:
  - JSON success/failure
  - YAML parsing
  - reserved field stripping
  - fallback variant coercion
- persisted store initialization:
  - valid persisted values
  - malformed persisted values
  - fallback defaults
- store actions with conditional behavior:
  - selection range fallback
  - recent search deduplication
  - vault tab fallback resolution
  - appearance/theme schedule null handling
  - plugin toggle success/error flows
- accessibility CSS override application:
  - high-contrast enable
  - restoration on disable
  - root attribute updates

## Acceptance Criteria

Wave 1 is complete when:

1. every Wave 1 in-scope production file is exercised by at least one independent automated test
2. branch-heavy modules have explicit edge-case assertions, not only happy-path checks
3. no new shared-state leaks appear across tests
4. the targeted Wave 1 frontend suite passes with fresh evidence
5. standards-aligned Wave 1 documentation is written after implementation
