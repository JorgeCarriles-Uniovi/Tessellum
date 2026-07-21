# Wave 3 Frontend Orchestration Standards Package

## 1. Test Plan Summary (IEEE 829)

### 1.1 Test Plan Identifier

- `TP-W3-FE-ORCH-2026-04-29`

### 1.2 Introduction

Wave 3 covers frontend orchestration logic and plugin runtime behavior that remained after Wave 0 to Wave 2. The wave targets non-presentational logic files whose correctness depends on lifecycle control, state synchronization, branch-heavy scheduling, and plugin contribution cleanup.

### 1.3 Test Items

- `src/plugins/EventBus.ts`
- `src/plugins/Plugin.ts`
- `src/plugins/PluginRegistry.ts`
- `src/plugins/TessellumApp.ts`
- `src/plugins/api/CommandAPI.ts`
- `src/plugins/api/I18nAPI.ts`
- `src/plugins/api/UIAPI.ts`
- `src/plugins/api/VaultAPI.ts`
- `src/plugins/api/WorkspaceAPI.ts`
- `src/stores/themeStore.ts`
- `src/stores/navigationHistoryStore.ts`
- `src/hooks/useApplyAccessibilitySettings.ts`
- `src/hooks/useApplyThemeSchedule.ts`
- `src/hooks/useWorkspaceNavigationHistory.ts`

### 1.4 Features To Be Tested

- Plugin event registration, removal, and fault isolation
- Plugin lifecycle cleanup and registry enable/disable flows
- App singleton creation and runtime API availability
- Command dispatch branches
- UI contribution resolution and ordering
- Workspace and vault API branch behavior
- Theme loading, fallback selection, persistence, and watch lifecycle
- Navigation history replay, dedupe, reset, and invalid-entry skipping
- Accessibility reapplication after appearance and theme changes
- Theme scheduling for `off`, `system`, `sun`, and `custom`
- Workspace history synchronization with vault restoration

### 1.5 Features Not To Be Tested

- CSS-only files
- `index` and `mod` barrel files
- Editor extension modules assigned to later waves
- Full E2E flows covered by later suites

### 1.6 Approach

- ISO/IEC/IEEE 29119 is used as the governing process and traceability model.
- IEEE 829 is used for the test plan summary, test design content, and test case specification format.
- IEEE 1008 principles are applied where unit isolation is relevant, especially around plugin APIs, stores, and hooks.
- Strong branch-oriented coverage is required. Tests target control-flow forks, guard clauses, failure handling, and replay/scheduling branches.

### 1.7 Item Pass/Fail Criteria

- All targeted Wave 3 test files pass.
- Each in-scope logic file has direct branch-oriented assertions through its public contract.
- No test fails due to shared mutable state or test ordering.

### 1.8 Suspension and Resumption Criteria

- Suspend if module-level state cannot be isolated without behavior-changing refactors.
- Resume after adding a seam or shared mock that preserves runtime behavior.

### 1.9 Test Deliverables

- Wave 3 Vitest suites
- Wave 3 design specification
- Wave 3 plan
- This standards package
- Wave 3 implementation process record

### 1.10 Environmental Needs

- `vitest`
- `@testing-library/react`
- `jsdom`
- Shared Tauri mocks from `src/test/tauriMocks.ts`
- Shared Zustand reset support from `src/test/storeIsolation.ts`

### 1.11 Responsibilities

- Codex authored the Wave 3 automated suite and documentation.
- Repository maintainers review branch adequacy and approve later waves.

### 1.12 Risks and Contingencies

- Module-scoped singletons can leak state between tests.
- Tauri adapters can hide filesystem/path branches if mocks are incomplete.
- Scheduling hooks can become flaky without fixed time and geolocation control.

Mitigation:

- Reset tracked stores after each test
- Mock Tauri path and fs APIs centrally
- Use fake timers and deterministic time sources

## 2. Test Design Specification (IEEE 829)

### 2.1 Test Design Identifier

- `TDS-W3-FE-ORCH-2026-04-29`

### 2.2 Features To Be Tested

1. Plugin runtime core
2. Theme orchestration
3. Navigation orchestration
4. Accessibility orchestration
5. Theme scheduling orchestration
6. Workspace history orchestration

### 2.3 Approach Refinement

- Specification-based:
  - ECP partitions valid vs invalid plugin states, present vs missing vault paths, known vs unknown theme names, and enabled vs disabled scheduling modes.
  - BVA targets cursor boundaries, schedule minute boundaries, and empty/non-empty collections.
- Structure-based:
  - Basis-path style tests cover registry failure cleanup, command dispatch branches, watcher guards, replay suppression, and schedule-mode branching.
- Error guessing:
  - Listener exceptions, missing vault path, invalid theme files, geolocation failure, and duplicate registration paths are covered.

### 2.4 Feature-to-Suite Mapping

- `src/plugins/*.ts` and `src/plugins/api/*.ts`: [src/plugins/pluginRuntime.test.ts](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src/plugins/pluginRuntime.test.ts)
- `src/stores/navigationHistoryStore.ts`: [src/stores/navigationHistoryStore.test.ts](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src/stores/navigationHistoryStore.test.ts)
- `src/stores/themeStore.ts`: [src/stores/themeStore.test.ts](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src/stores/themeStore.test.ts)
- `src/hooks/useApplyAccessibilitySettings.ts`: [src/hooks/useApplyAccessibilitySettings.test.tsx](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src/hooks/useApplyAccessibilitySettings.test.tsx)
- `src/hooks/useApplyThemeSchedule.ts`: [src/hooks/useApplyThemeSchedule.test.tsx](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src/hooks/useApplyThemeSchedule.test.tsx)
- `src/hooks/useWorkspaceNavigationHistory.ts`: [src/hooks/useWorkspaceNavigationHistory.test.tsx](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src/hooks/useWorkspaceNavigationHistory.test.tsx)

## 3. Test Case Specifications (IEEE 829)

| Test ID | Test Item | Input | Expected Outcome | Technique |
|---|---|---|---|---|
| `W3-PLG-001` | EventBus | Two listeners for same event, one throws | Good listener still receives event, error is contained, refs removable | Basis Path + Error Guessing |
| `W3-PLG-002` | CommandAPI | Duplicate command IDs, insert-text command, callback command | Duplicate replaces prior command; insert dispatches with correct cursor; callbacks route correctly | ECP Valid Registration + Basis Path |
| `W3-PLG-003` | UIAPI | Mixed string/function labels and ordered actions | Resolved labels are returned and sorted deterministically | ECP Valid Inputs |
| `W3-PLG-004` | Plugin cleanup | Registered commands, events, UI contributions, translations | Cleanup removes all plugin-owned contributions and calls unload hook | Basis Path |
| `W3-PLG-005` | PluginRegistry | Good plugin, failing plugin, disabled seed | Failed plugin is disabled after cleanup; good plugin can be re-enabled; status report is accurate | Basis Path + Error Guessing |
| `W3-PLG-006` | TessellumApp | Access before create, repeated create | Pre-init access throws; later calls reuse singleton | ECP Invalid State |
| `W3-API-001` | VaultAPI | Missing and present vault path | Missing path returns empty list or throws where required; present path invokes correct commands | ECP Valid/Invalid State |
| `W3-API-002` | WorkspaceAPI | Active note changes, editor mode changes, history navigation | Store state updates and events are emitted through public API | Basis Path |
| `W3-THM-001` | themeStore | Valid JSON theme file, ignored text file, invalid YAML file | Valid theme merges, invalid files are skipped, selected theme persists | ECP + Error Guessing |
| `W3-THM-002` | themeStore | Missing stored theme name, custom accent source | Default theme is selected, theme accent is not applied until forced selection | ECP Invalid Name |
| `W3-THM-003` | themeStore | Repeated watcher start and stop | Watcher installs once, change callback reloads themes, stop calls unwatch | BVA Guard Branch |
| `W3-NAV-001` | navigationHistoryStore | Duplicate entries and back/forward transitions | Duplicate records are skipped and forward history is trimmed on new branch | Basis Path |
| `W3-NAV-002` | navigationHistoryStore | Replay mode and missing file entry | Replay suppresses append; invalid file entries are skipped | Error Guessing + Basis Path |
| `W3-HOOK-001` | useApplyAccessibilitySettings | Repeated and changed accessibility snapshots | Initial apply occurs, duplicate snapshot is ignored, changed snapshot reapplies | ECP + Basis Path |
| `W3-HOOK-002` | useApplyAccessibilitySettings | High-contrast active plus appearance/theme changes | Overlay reapplies after queued microtask | Error Guessing |
| `W3-HOOK-003` | useApplyThemeSchedule | `off` and `system` schedule modes | `off` performs no updates; `system` applies variant and unregisters listener | ECP + Basis Path |
| `W3-HOOK-004` | useApplyThemeSchedule | `sun` mode with geolocation success and failure | Successful lookup stores coordinates; failure falls back to custom schedule | Error Guessing + Basis Path |
| `W3-HOOK-005` | useApplyThemeSchedule | `custom` mode around boundary times | Next boundary timer is scheduled and variant changes when boundary is crossed | BVA Time Boundary |
| `W3-HOOK-006` | useWorkspaceNavigationHistory | Restored and not-restored workspace states | History seeds only after restore | ECP Valid/Invalid Precondition |
| `W3-HOOK-007` | useWorkspaceNavigationHistory | Vault change during replay | History resets for new vault, replay completes without duplicate append | Basis Path |

## 4. ISO/IEC/IEEE 29119 Sub-process Mapping

| ISO 29119 Sub-process | Wave 3 Application |
|---|---|
| Test Monitoring and Control | Wave scope was fixed to frontend orchestration and plugin runtime only |
| Test Analysis | Candidate files were inventoried from `src` and filtered to logic-bearing modules |
| Test Design | Branch targets were defined per plugin lifecycle, store flow, and scheduling branch |
| Test Implementation | Shared mocks were extended for Tauri path APIs and isolated Vitest suites were authored |
| Test Execution | Targeted Vitest command executed against only Wave 3 suites |
| Test Completion | Results, scope, and traceability were written into this standards package and the implementation log |

## 5. Representative Code Samples

- Plugin runtime sample: [src/plugins/pluginRuntime.test.ts](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src/plugins/pluginRuntime.test.ts)
- Theme orchestration sample: [src/stores/themeStore.test.ts](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src/stores/themeStore.test.ts)
- Scheduling hook sample: [src/hooks/useApplyThemeSchedule.test.tsx](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src/hooks/useApplyThemeSchedule.test.tsx)
