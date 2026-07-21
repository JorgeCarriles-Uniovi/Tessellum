# Wave 1 Frontend Shared Logic Test Documentation

## Standards Alignment Note

- `ISO/IEC/IEEE 29119` governs the Wave 1 planning, analysis, design, implementation, execution, and completion framing.
- `IEEE 829` governs the document structure used for the Wave 1 Test Plan Summary and Test Design Specification.
- `IEEE 1008` unit-isolation principles are applied to the Wave 1 frontend unit-level tests through test independence, controlled inputs, and repeatable setup and cleanup.

Wave 1 is a frontend shared-logic coverage wave. It builds on the Wave 0 harness and covers the next file-complete frontend slice without extending into UI-heavy editor surfaces, plugin runtime orchestration, or desktop E2E flows.

## Test Plan Summary (IEEE 829 Format)

### Test Plan Identifier

- `TESS-W1-FE-TP-001`

### Introduction

Wave 1 adds independent, branch-oriented automated tests for the frontend shared-logic layer in `src/`. The purpose is to establish strong unit-level confidence in reusable runtime modules before later waves move into heavier UI orchestration, plugin runtime integration, and backend command coverage.

### Test Items

- Constants:
  - `src/constants/callout-types.ts`
  - `src/constants/editorModes.tsx`
  - `src/constants/shortcuts.ts`
- I18n core:
  - `src/i18n/types.ts`
  - `src/i18n/spellcheck.ts`
  - `src/i18n/resources.ts`
  - `src/i18n/formatters.ts`
  - `src/i18n/I18nService.ts`
- Shared library modules:
  - `src/lib/utils.ts`
  - `src/lib/cypherQuerySamples.ts`
  - `src/lib/cypherQueryNormalizer.ts`
  - `src/lib/cypherGraphFilter.ts`
- Theme logic:
  - `src/themes/themeTokens.ts`
  - `src/themes/themeUtils.ts`
  - `src/themes/builtinThemes.ts`
- Shared utilities:
  - `src/utils/pathUtils.ts`
  - `src/utils/noteUtils.ts`
  - `src/utils/fileType.ts`
  - `src/utils/outline.ts`
  - `src/utils/tagExtraction.ts`
- Shared hooks:
  - `src/hooks/accessibilityCssVars.ts`
  - `src/hooks/useDebouncedValue.ts`
- Low-coupling stores:
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
- Supporting production logic:
  - `src/plugins/pluginPreferences.ts`

### Features To Be Tested

- constant registry integrity and guard helpers
- locale validation, namespace generation, resource bundling, and translation lookup
- Cypher normalization, parsing, filtering, and unsupported syntax rejection
- theme token mapping and user-theme parsing
- path, note, file-type, outline, and tag-scan helpers
- accessibility CSS override behavior and debounce timing
- persisted and non-persisted Zustand state transitions
- recent-search single-flight behavior
- plugin preference persistence and plugin toggle error handling
- vault tab fallback, reorder, close, rename, and dedupe behavior

### Features Not To Be Tested

- editor rendering components
- graph canvas DOM rendering
- plugin runtime APIs and editor extension modules
- cross-store orchestration files excluded from Wave 1 scope
- backend Rust modules
- end-to-end desktop workflows

### Approach

- test runner:
  - `Vitest` with `jsdom`
- component and hook tooling:
  - React Testing Library
- state isolation:
  - Wave 0 `trackStore()` reset support
  - `localStorage` and `sessionStorage` cleanup after every test
  - dynamic module re-import for storage-backed initialization branches
- Tauri integration isolation:
  - shared mocked `invoke()` surface from `src/test/tauriMocks.ts`

Applied techniques:

- Specification-based:
  - `ECP` for supported vs unsupported locales, valid vs invalid persisted values, valid vs invalid plugin storage payloads, and valid vs invalid file extensions
  - `BVA` for search recent-history cap, editor font clamping, and debounce timing threshold
- Structure-based:
  - branch-oriented tests for Cypher parsing, theme parsing, accessibility override restoration, selection fallback, vault tab fallback, and readiness single-flight behavior
- Error guessing:
  - malformed JSON in storage
  - unsupported query syntax
  - empty vault-path no-op handling
  - storage write failures
  - unsupported locale and missing translation keys

### Item Pass/Fail Criteria

- all Wave 1 targeted test files pass
- every Wave 1 in-scope production file is exercised by at least one automated test
- store-backed tests remain independent and order-insensitive
- no ad hoc environment setup is required beyond the shared Wave 0 harness

### Suspension Criteria And Resumption Requirements

- suspend when:
  - Vitest cannot boot
  - module-level state leaks across tests
  - Tauri mocks or store resets stop restoring clean defaults
- resume when:
  - the runner is operational
  - the isolation leak is corrected
  - the shared mocks and storage cleanup are restored

### Deliverables

- Wave 1 grouped frontend test suites
- Wave 1 design and implementation plan documents
- this Wave 1 standards-aligned test document
- Wave 1 implementation process note

## Frontend Test Design Specification (IEEE 829)

### Test Design Specification Identifier

- `TESS-W1-FE-TDS-001`

### File Coverage Map

| Production file | Covering test file |
| --- | --- |
| `src/constants/callout-types.ts` | `src/constants/constants.test.tsx` |
| `src/constants/editorModes.tsx` | `src/constants/constants.test.tsx` |
| `src/constants/shortcuts.ts` | `src/constants/constants.test.tsx` |
| `src/i18n/types.ts` | `src/i18n/i18n.core.test.ts` |
| `src/i18n/spellcheck.ts` | `src/i18n/i18n.core.test.ts` |
| `src/i18n/resources.ts` | `src/i18n/i18n.core.test.ts`, `src/i18n/I18nService.test.ts` |
| `src/i18n/formatters.ts` | `src/i18n/i18n.core.test.ts` |
| `src/i18n/I18nService.ts` | `src/i18n/I18nService.test.ts` |
| `src/lib/utils.ts` | `src/lib/cypher.test.ts` |
| `src/lib/cypherQuerySamples.ts` | `src/lib/cypher.test.ts` |
| `src/lib/cypherQueryNormalizer.ts` | `src/lib/cypher.test.ts` |
| `src/lib/cypherGraphFilter.ts` | `src/lib/cypher.test.ts` |
| `src/themes/themeTokens.ts` | `src/themes/themes.test.ts` |
| `src/themes/themeUtils.ts` | `src/themes/themes.test.ts` |
| `src/themes/builtinThemes.ts` | `src/themes/themes.test.ts` |
| `src/utils/pathUtils.ts` | `src/utils/sharedUtils.test.ts` |
| `src/utils/noteUtils.ts` | `src/utils/sharedUtils.test.ts` |
| `src/utils/fileType.ts` | `src/utils/sharedUtils.test.ts` |
| `src/utils/outline.ts` | `src/utils/sharedUtils.test.ts` |
| `src/utils/tagExtraction.ts` | `src/utils/sharedUtils.test.ts` |
| `src/hooks/accessibilityCssVars.ts` | `src/hooks/sharedHooks.test.tsx` |
| `src/hooks/useDebouncedValue.ts` | `src/hooks/sharedHooks.test.tsx` |
| `src/plugins/pluginPreferences.ts` | `src/plugins/pluginPreferences.test.ts` |
| `src/stores/accessibilityStore.ts` | `src/stores/persistedStores.test.ts` |
| `src/stores/appearanceStore.ts` | `src/stores/persistedStores.test.ts` |
| `src/stores/editorContentStore.ts` | `src/stores/persistedStores.test.ts` |
| `src/stores/editorModeStore.ts` | `src/stores/basicStores.test.ts` |
| `src/stores/graphStore.ts` | `src/stores/basicStores.test.ts` |
| `src/stores/pluginsStore.ts` | `src/stores/pluginsStore.test.ts` |
| `src/stores/searchStore.ts` | `src/stores/searchStore.test.ts` |
| `src/stores/selectionStore.ts` | `src/stores/basicStores.test.ts` |
| `src/stores/settingsStore.ts` | `src/stores/persistedStores.test.ts` |
| `src/stores/uiStore.ts` | `src/stores/basicStores.test.ts` |
| `src/stores/vaultStore.ts` | `src/stores/vaultStore.test.ts` |

### Features To Be Tested

- constant lookup and grouping helpers
- i18n service lifecycle and plugin bundle registration
- Cypher normalization and filter evaluation
- theme parsing and built-in theme integrity
- utility helpers for paths, note creation metadata, outline parsing, and tag scanning
- high-contrast CSS override application and restoration
- debounce timing behavior
- public store actions and persisted-state initialization

### Test Case Specifications

| Test ID | Input | Expected Outcome | Technique Applied |
| --- | --- | --- | --- |
| `W1-FE-001` | `getCalloutType("NOTE")` and `getCalloutType("missing")` | case-insensitive hit for known id and `undefined` for unknown id | `ECP - Valid/invalid identifier` |
| `W1-FE-002` | valid editor modes plus `null`, `undefined`, and `"preview"` | only the supported modes satisfy the type guard | `ECP - Supported/unsupported class` |
| `W1-FE-003` | `I18nService` in dev mode with `missing.key` | throws missing-translation error for the active locale | `Error guessing - Missing resource key` |
| `W1-FE-004` | plugin translation registration without English bundle | registration throws required-English error | `ECP - Invalid bundle class` |
| `W1-FE-005` | `MATCH (a) -- (b)` | undirected relation shorthand normalizes and missing `RETURN` is synthesized | `Basis path` |
| `W1-FE-006` | `MATCH (n) WHERE n.tags = rust, backend` | shorthand becomes two `IN` predicates | `ECP - Multi-tag valid class` |
| `W1-FE-007` | `CREATE (n)` or unsupported `RETURN` clause | parser rejects unsupported syntax | `Error guessing - Invalid query form` |
| `W1-FE-008` | flat YAML theme text with comments, quotes, and empty value | parser returns structured theme fields and preserves empty string field | `ECP - Mixed valid tokens` |
| `W1-FE-009` | invalid JSON theme text | parser returns `null` instead of throwing | `Error guessing - Malformed serialization` |
| `W1-FE-010` | note path with Windows separators and empty path | filename extraction succeeds for valid path and returns `null` for empty input | `ECP - Path shape partitions` |
| `W1-FE-011` | markdown with visible headings and fenced hidden headings | outline only contains non-fenced headings with correct line numbers | `Basis path` |
| `W1-FE-012` | high-contrast accessibility snapshot then normal snapshot | CSS override values apply, attributes update, and previous inline values restore | `Basis path` |
| `W1-FE-013` | debounced hook before and after delay threshold | value stays old before boundary and updates after threshold | `BVA - Time threshold` |
| `W1-FE-014` | invalid accessibility storage values | store falls back to defaults and coerces invalid action inputs | `ECP - Invalid persisted class` |
| `W1-FE-015` | editor font sizes below minimum and above maximum | store and helper functions clamp to supported bounds | `BVA - Lower/upper bounds` |
| `W1-FE-016` | duplicate and overflow recent searches | store deduplicates normalized queries and caps history to seven items | `BVA - Capacity limit` |
| `W1-FE-017` | two concurrent readiness sync calls for the same vault path | single Tauri readiness request is issued and shared by both callers | `Control flow / basis path` |
| `W1-FE-018` | plugin toggle failure result | plugin list still refreshes and an error toast is shown | `Error guessing - Downstream failure` |
| `W1-FE-019` | removed active vault tab with previous tab still available | store falls back to previous remaining tab | `Basis path` |
| `W1-FE-020` | malformed plugin-preference JSON and storage write exception | read falls back to empty array and write logs error without throwing | `Error guessing - Corrupt storage / write failure` |

## ISO/IEC/IEEE 29119 Process Mapping

| ISO 29119 Activity | Wave 1 Application |
| --- | --- |
| Test Planning | define Wave 1 as the frontend shared-logic slice and freeze explicit in-scope files |
| Test Monitoring and Control | run the targeted Vitest command for all Wave 1 suites and iterate on failing expectations |
| Test Analysis | identify branch-heavy modules, persisted-state modules, and storage-backed initialization paths |
| Test Design | group files into coherent suites and map each in-scope production file to at least one test file |
| Test Implementation | add grouped tests, dynamic re-import patterns, and store-tracking setup usage |
| Test Execution | execute the 13-file Wave 1 frontend slice and review individual failures |
| Test Completion | record passing evidence and publish this standards-aligned documentation |

## Representative Code Snippets

```ts
const relationFilter = runCypherGraphFilter(
  'MATCH (a) --> (b) WHERE "rust" IN a.tags AND b.label CONTAINS "brain"',
  graphData,
);
expect([...relationFilter.edgeIds]).toEqual(["notes/a.md->notes/b.md"]);
```

```tsx
const { result, rerender } = renderHook(
  ({ value, delayMs }) => useDebouncedValue(value, delayMs),
  { initialProps: { value: "alpha", delayMs: 300 } },
);
rerender({ value: "beta", delayMs: 300 });
act(() => {
  vi.advanceTimersByTime(299);
});
expect(result.current).toBe("alpha");
```

```ts
const first = useSearchStore.getState().syncReadiness("/vault");
const second = useSearchStore.getState().syncReadiness("/vault");
expect(invokeMock).toHaveBeenCalledTimes(1);
await Promise.all([first, second]);
```

## Verification Evidence

- command:
  - `cmd /c npm test -- src\constants\constants.test.tsx src\i18n\i18n.core.test.ts src\i18n\I18nService.test.ts src\lib\cypher.test.ts src\themes\themes.test.ts src\utils\sharedUtils.test.ts src\hooks\sharedHooks.test.tsx src\plugins\pluginPreferences.test.ts src\stores\basicStores.test.ts src\stores\persistedStores.test.ts src\stores\pluginsStore.test.ts src\stores\searchStore.test.ts src\stores\vaultStore.test.ts`
- result:
  - `13` test files passed
  - `54` tests passed

## Wave 1 Exit Statement

Wave 1 is complete when the frontend shared-logic slice is covered by independent automated tests, the branch-heavy behaviors in that slice are explicitly asserted, and the targeted verification command passes with fresh evidence.
