# Wave 3 Frontend Orchestration Design

## Objective

Wave 3 covers the remaining frontend logic files whose main responsibility is orchestration rather than presentational rendering. The wave focuses on plugin runtime lifecycle, cross-store navigation behavior, theme orchestration, and runtime hooks that synchronize browser state with Zustand state.

## In Scope

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

## Out of Scope

- CSS files
- `index` and `mod` files
- Editor extension files already assigned to later waves
- Component rendering already covered in Wave 0 to Wave 2 unless needed as a hook host

## Testability Strategy

1. Keep every test independent by resetting tracked stores, `localStorage`, `sessionStorage`, timers, and Tauri mocks after each test.
2. Test plugin runtime behavior through public APIs instead of asserting internal fields directly.
3. Favor branch-oriented assertions over shallow smoke tests.
4. Extract only minimal seams when required to reduce setup complexity without altering behavior.

## Branch Targets

### Plugin Runtime

- Event subscription and removal
- Command registration replacement vs append
- UI contribution resolution for string and function labels
- Plugin cleanup across editor, commands, UI, i18n, and events
- Registry success, failure, disable, enable, and status reporting paths
- App singleton creation and reuse path

### Theme and Navigation Orchestration

- Built-in theme fallback and persisted theme selection
- User theme merge, invalid file skip, and watch lifecycle
- Navigation record dedupe, replay suppression, invalid entry skip, and graph/editor apply paths
- Workspace history reset and reseed on vault changes

### Runtime Hooks

- Accessibility snapshot dedupe and forced high-contrast reapply
- Theme scheduling for `off`, `system`, `sun`, and `custom`
- Geolocation success and fallback
- Timer scheduling and listener cleanup

## Acceptance Criteria

- All in-scope files have direct tests in this wave except files deferred explicitly to a later wave.
- Tests demonstrate specification-based, structure-based, and error-guessing techniques.
- Strong branch-oriented coverage is achieved for lifecycle and orchestration decisions.
- No test depends on execution order or leaked state.
