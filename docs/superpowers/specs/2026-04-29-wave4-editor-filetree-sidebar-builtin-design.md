# Wave 4 Editor, FileTree, Sidebar, and Builtin Plugin Design

## Objective

Wave 4 completes the remaining frontend logic coverage for the editor runtime, file-tree logic, sidebar hook layer, and builtin plugin registration surface. The wave stays under one umbrella, but implementation is split into internal phases so branch-oriented coverage remains strong and each verification pass stays isolated and reviewable.

## Wave Structure

### Phase 4A: Editor Pure Logic and Low-Coupling Plugin Wrappers

Targets:

- `src/components/Editor/utils/markdownShortcuts.ts`
- `src/components/Editor/hooks/sourceModeExtensions.ts`
- `src/components/Editor/hooks/editorExtensionOrder.ts`
- `src/components/Editor/hooks/editorExtensionsBuilder.ts`
- `src/components/Editor/hooks/codeLanguagesLoader.ts`
- `src/components/Editor/hooks/codeLanguageBundles/*.ts`
- Low-coupling builtin plugin wrappers that only register commands or editor extensions

Intent:

- Cover pure decision logic, list formatting, shortcut matching, extension ordering, locale loading, and plugin registration contracts without requiring a full editor host.

### Phase 4B: Editor Runtime Hooks, Extension Hosts, and Higher-Coupling Editor Logic

Targets:

- `src/components/Editor/hooks/*.ts` that orchestrate editor behavior
- `src/components/Editor/extensions/**/*.ts(x)` with practical runtime branches
- Editor host components whose behavior is primarily logic-bearing rather than purely visual

Intent:

- Cover branch-heavy editor orchestration with targeted mocks for CodeMirror, plugin APIs, and store state.
- Extract seams only where branch coverage is otherwise impractical.

### Phase 4C: FileTree and Sidebar Hook Logic

Targets:

- `src/components/FileTree/**/*.ts(x)`
- `src/components/Sidebar/hooks/*.ts`
- Remaining file-tree and sidebar components where logic is the main responsibility

Intent:

- Cover context-menu behavior, rename/create/delete orchestration, folder expansion behavior, clipboard selection integration, and state transitions around modal workflows.

### Phase 4D: Builtin Plugin Interaction and Remaining Integration-Facing Logic

Targets:

- `src/plugins/builtin/*.ts(x)` not fully exhausted in Phase 4A
- Builtin plugin translation and UI-action registration paths
- Remaining integration-facing files from the editor cluster that need plugin-aware assertions

Intent:

- Prove that builtin plugins register the correct commands, UI actions, translations, and editor extensions, and that failure or no-op branches are still isolated.

## In Scope

- Remaining untested logic-bearing files under:
  - `src/components/Editor`
  - `src/components/FileTree`
  - `src/components/Sidebar/hooks`
  - `src/plugins/builtin`

## Out of Scope

- CSS files
- `index` files
- Pure asset files
- Files that are strictly type-only with no behavioral logic

## Testability Strategy

1. Keep tests independent through shared store resets, Tauri mock resets, timer resets, and DOM cleanup.
2. Prefer grouped suites that exercise multiple closely related files through the same contract when that reduces duplication without hiding assertions.
3. Use black-box assertions on public behavior first, then white-box branch probes only when a branch would otherwise stay unverified.
4. Extract targeted helper seams from very large editor files only if a branch cannot be tested through existing public hooks or components.

## Branch Targets

### Editor Logic

- Markdown wrap vs unwrap vs collapsed selection
- List formatting toggle branches
- Source-mode plugin filtering
- Vim-mode and line-number ordering
- Locale bundle cache hit vs miss
- Code-language load success vs failure
- Editor hook cancellation and stale update guards

### FileTree and Sidebar

- Root vs contextual creation behavior
- Rename success vs failure
- Clipboard copy selection fallback vs selected-path branch
- Paste guarded by directory checks
- Delete modal lifecycle and confirm/cancel paths

### Builtin Plugins

- Command registration loops
- UI action registration by region
- Palette command keywords and translation lookup
- Event-triggered re-registration
- Vault-required no-op paths

## Acceptance Criteria

- Every remaining logic-bearing file in the requested directories is assigned to one Wave 4 phase and receives direct automated coverage.
- Each phase has a targeted verification command.
- Tests demonstrate specification-based, structure-based, and error-guessing techniques.
- Coverage is branch-oriented rather than smoke-oriented.
