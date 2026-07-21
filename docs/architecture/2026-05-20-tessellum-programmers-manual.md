---
tags: ["documentation", "programmers-manual", "developer-manual", "une-157801"]
type: "programmers_manual"
suite: "une_157801"
document_role: "programmer"
app: "tessellum"
language: "en"
---
# Tessellum Programmer's Manual

## Formal Programmer's Manual
**Universidad de Oviedo | Escuela de Ingenieria Informatica | Trabajo Fin de Grado**  
**Application**: Tessellum  
**Document purpose**: Programmer's manual for maintenance, extension, and technical understanding  
**Reference context**: UNE 157801 documentation set

> [!info] Purpose of this manual
> This document is part of the Tessellum UNE 157801 documentation set. It explains how Tessellum works internally and how a programmer can maintain, improve, and extend the software without breaking the local-first execution model.

---

## 1. Introduction

Tessellum is a local-first desktop knowledge-management application built with:

- React
- TypeScript
- Tauri
- Rust
- SQLite
- Tantivy
- Grafeo

From the programmer's point of view, Tessellum is not just a note editor. It is a coordinated system with:

- a filesystem-based source of truth;
- a React frontend for interaction and rendering;
- a Rust backend for side effects and derived data;
- a plugin runtime for editor and UI extensibility;
- several local indexes and projections for search and graph behavior.

This manual answers four practical questions:

1. How is Tessellum organized internally?
2. How does the application work at runtime?
3. Where should a developer add or modify functionality?
4. How should new changes be validated safely?

---

## 2. Main Technical Principles

Before editing Tessellum, the developer should understand the design constraints that shape the repository.

### Local-first architecture

The user vault is the source of truth. Notes are stored as plain Markdown files inside a folder selected by the user.

This means:

- note content must remain portable outside Tessellum;
- operational caches must never replace the vault as the authoritative data source;
- any derived model must be rebuildable from the filesystem.

### Backend as the system boundary

The frontend should not directly own filesystem logic, indexing, or persistence rules. These responsibilities belong to the Rust backend and are accessed through Tauri commands.

As a result:

- side-effect-heavy behavior should be added in Rust when possible;
- frontend code should orchestrate interaction, not duplicate backend logic;
- filesystem writes and derived-index updates should follow established backend paths.

### Disposable derived data

SQLite, Tantivy, and Grafeo are derived operational representations.

This means:

- they can be rebuilt;
- they should accelerate queries and visualizations;
- they should not become the only place where important user semantics live.

### Focused state boundaries

The frontend uses specialized Zustand stores instead of one giant global store.

This is important because:

- state remains easier to reason about;
- features can evolve with lower cognitive complexity;
- changes can stay localized.

### Extension over monoliths

Rich editor and UI features are intentionally implemented through plugins and structured APIs rather than through a single oversized component.

If a feature can be isolated as a plugin contribution, that is usually the preferred direction.

---

## 3. Repository Structure

The most important repository areas are:

| Path | Responsibility |
| --- | --- |
| `src/` | React and TypeScript frontend |
| `src/components/` | UI surfaces such as editor, graph, search, sidebar, settings, and layout |
| `src/stores/` | Focused Zustand stores |
| `src/plugins/` | Plugin runtime, APIs, manifests, and built-in plugins |
| `src/themes/` | Theme tokens, built-in themes, and parsing |
| `src/i18n/` | Localization resources and i18n behavior |
| `src/features/` | Cross-cutting feature modules, such as clipboard and PDF export |
| `src/utils/` | Frontend utility functions |
| `src-tauri/src/` | Rust backend |
| `src-tauri/src/commands/` | Tauri command handlers |
| `src-tauri/src/models/` | Shared backend types and runtime structures |
| `src-tauri/src/db.rs` | SQLite persistence layer |
| `src-tauri/src/indexer.rs` | Vault indexing pipeline |
| `src-tauri/src/search.rs` | Tantivy-backed search behavior |
| `src-tauri/src/grafeo_projection.rs` | Graph projection synchronization and query layer |
| `src-tauri/src/trash.rs` | Trash lifecycle logic |
| `docs/architecture/` | Architecture and formal technical documentation |
| `.github/workflows/` | CI and release automation |

> [!tip] Practical reading order
> For a new contributor, the most useful first files are:
> - [README.md](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/README.md)
> - [src/App.tsx](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src/App.tsx)
> - [src-tauri/src/lib.rs](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src-tauri/src/lib.rs)
> - [src/plugins/PluginRegistry.ts](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src/plugins/PluginRegistry.ts)
> - [src-tauri/src/indexer.rs](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src-tauri/src/indexer.rs)

---

## 4. High-Level Runtime Architecture

At runtime, Tessellum is composed of four layers:

1. the vault layer;
2. the frontend layer;
3. the backend layer;
4. the derived-data layer.

### 4.1 Vault layer

The vault contains:

- Markdown notes;
- folders;
- assets such as images and PDFs;
- `.trash`;
- `.tessellum/templates`;
- `.tessellum/.themes`;
- `.tessellum/config.json`.

### 4.2 Frontend layer

The frontend:

- renders the application;
- coordinates view state;
- reacts to backend events;
- hosts the plugin runtime;
- drives the editor, graph, sidebar, search, and settings surfaces.

### 4.3 Backend layer

The backend:

- owns filesystem access;
- creates and updates local metadata structures;
- handles note reads and writes;
- manages search indexing;
- manages graph projection;
- protects the vault path boundary.

### 4.4 Derived-data layer

Derived runtime structures include:

- `vault.db`
- `search_index/`
- `graph.grafeo`

These are stored in the application data directory, not in the vault.

---

## 5. Core Runtime Flow

The most important execution sequence in Tessellum is:

1. the user opens a vault;
2. the frontend calls `set_vault_path`;
3. the backend expands file scope and prepares local runtime services;
4. the frontend starts `watch_vault`;
5. the backend watches filesystem changes;
6. the frontend refreshes visible state and triggers syncs;
7. the backend updates SQLite, Tantivy, and Grafeo as needed.

This architecture is described in [README.md](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/README.md) and implemented mainly through:

- [src/App.tsx](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src/App.tsx)
- [src-tauri/src/lib.rs](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src-tauri/src/lib.rs)
- [src-tauri/src/commands/watcher.rs](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src-tauri/src/commands/watcher.rs)
- [src-tauri/src/commands/indexer.rs](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src-tauri/src/commands/indexer.rs)
- [src-tauri/src/indexer.rs](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src-tauri/src/indexer.rs)

---

## 6. Frontend Architecture

### Main composition entry point

[src/App.tsx](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src/App.tsx) is the main orchestration file.

It is responsible for:

- restoring workspace state;
- opening and watching the vault;
- coordinating search readiness;
- switching between editor and graph views;
- applying persisted configuration;
- wiring large-scale UI behavior together.

When a feature affects the application shell or the vault lifecycle, `App.tsx` is usually part of the change.

### UI surface organization

The main user-facing areas are split into separate components:

- `src/components/Editor/`
- `src/components/Sidebar/`
- `src/components/GraphView/`
- `src/components/Search/`
- `src/components/Settings/`
- `src/components/TitleBar/`
- `src/components/Layout/`

This division matters when adding functionality:

- editor behaviors belong in editor modules or editor plugins;
- graph behavior belongs in graph view modules and related stores/utilities;
- settings belong in settings components and persisted stores;
- global workflow actions may belong in the sidebar, title bar, or plugin-contributed UI actions.

### Frontend state model

The store exports are grouped in [src/stores/index.ts](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src/stores/index.ts).

Important stores include:

- `useVaultStore`
- `useEditorContentStore`
- `useEditorModeStore`
- `useSettingsStore`
- `useAppearanceStore`
- `useThemeStore`
- `useAccessibilityStore`
- `useUiStore`
- `useGraphStore`
- `useSearchStore`
- `usePluginsStore`
- `useNavigationHistoryStore`

### How to use stores correctly

- Add state only to the store that logically owns it.
- Do not create cross-store coupling if an event or API boundary is enough.
- Avoid using one store as an ad hoc dumping ground for unrelated flags.
- Prefer small, composable state transitions over large multi-purpose setters.

> [!warning] Common anti-pattern
> If a new feature requires touching many unrelated stores, that is often a signal that the feature boundary is wrong or that a plugin/API abstraction should be introduced first.

---

## 7. Backend Architecture

### Backend entry point

[src-tauri/src/lib.rs](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src-tauri/src/lib.rs) is the runtime entry point.

It performs:

- application-data directory resolution;
- startup logging;
- SQLite initialization;
- Tantivy index initialization;
- Grafeo initialization and initial sync;
- Tauri command registration.

If a new backend capability needs to be callable from the frontend, it normally requires:

1. implementation in a backend module;
2. registration in `tauri::generate_handler!`;
3. frontend invocation through `invoke(...)`.

### Command modules

The Tauri command layer is organized by responsibility:

- `notes.rs`
- `vault.rs`
- `watcher.rs`
- `graph.rs`
- `search.rs`
- `templates.rs`
- `folders.rs`
- `links.rs`
- `assets.rs`
- `clipboard.rs`
- `pdf_export.rs`
- `indexer.rs`

This is the main API surface between frontend and backend.

### Rule for new commands

Add a new command only when:

- the behavior requires privileged local access;
- the behavior performs filesystem, DB, or index side effects;
- the logic belongs naturally to Rust rather than React.

Do not add a backend command for purely presentational frontend behavior.

### Database layer

[src-tauri/src/db.rs](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src-tauri/src/db.rs) manages SQLite persistence.

Its role is to support:

- note metadata lookup;
- link relationships;
- tag normalization;
- indexed file tracking;
- query performance for graph and backlinks.

When changing note metadata semantics, backlinks, tags, or graph-related queries, the DB layer is usually involved.

### Indexer

[src-tauri/src/indexer.rs](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src-tauri/src/indexer.rs) is one of the most important backend files.

It:

- scans the vault;
- filters paths;
- reads Markdown files;
- parses frontmatter;
- extracts tags;
- extracts wiki-links;
- updates SQLite;
- updates Tantivy search documents.

If a feature changes the meaning of Markdown-derived metadata, the indexer often needs to be updated.

### Search layer

[src-tauri/src/search.rs](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src-tauri/src/search.rs) manages:

- full-text search;
- tag search;
- readiness logic;
- index rebuild behavior.

Any improvement to search queries, snippets, readiness handling, or indexing coherence should begin there.

### Graph layer

[src-tauri/src/grafeo_projection.rs](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src-tauri/src/grafeo_projection.rs) and [src-tauri/src/commands/graph.rs](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src-tauri/src/commands/graph.rs) implement graph-related behavior.

There are two graph concerns:

- the default graph data returned to the UI;
- the Grafeo projection used for query execution.

When changing visual graph semantics, inspect `graph.rs` first.  
When changing graph-query semantics or synchronization, inspect `grafeo_projection.rs`.

---

## 8. Plugin Architecture

The plugin system is one of the best extension paths for Tessellum.

### Plugin lifecycle

[src/plugins/PluginRegistry.ts](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src/plugins/PluginRegistry.ts) manages:

- registration;
- instantiation;
- load/unload;
- enable/disable;
- failure isolation.

This gives a key guarantee: one failing plugin should not collapse the whole runtime.

### Plugin manifest shape

[src/plugins/types.ts](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src/plugins/types.ts) defines the manifest:

- `id`
- `name`
- `description`
- `version`
- `source`

Built-in plugins live in `src/plugins/builtin/`.

### Main plugin-facing APIs

Important APIs include:

- [UIAPI.ts](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src/plugins/api/UIAPI.ts)
- [EditorAPI.ts](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src/plugins/api/EditorAPI.ts)
- [WorkspaceAPI.ts](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src/plugins/api/WorkspaceAPI.ts)

### What each API is for

- `UIAPI`: register command palette entries, settings tabs, title bar actions, sidebar actions, UI-region actions, and custom callout types
- `EditorAPI`: attach CodeMirror extensions using per-plugin compartments
- `WorkspaceAPI`: access active note, vault path, editor mode, navigation, backlinks, and workspace-level behavior without importing stores directly

### When to use a plugin instead of editing a component directly

Prefer a plugin when the feature is:

- editor-specific;
- optional or modular;
- a reusable UI action;
- a command-palette contribution;
- a settings contribution;
- a feature that should be enableable or disableable at runtime.

Prefer direct component changes when the feature is:

- fundamental shell behavior;
- deep layout behavior;
- a core state change with no plugin boundary;
- a backend-only infrastructural change.

---

## 9. How to Add New Functionality

This section explains the preferred change paths for common types of improvements.

### Add a new editor capability

Examples:

- new Markdown syntax support;
- new callout behavior;
- new CodeMirror decoration;
- new slash-command helper.

Preferred path:

1. determine whether the feature fits the plugin model;
2. add or update a built-in plugin under `src/plugins/builtin/`;
3. register the necessary editor extensions through `EditorAPI`;
4. add any supporting utility code under `src/components/Editor/` or `src/utils/` as needed;
5. add tests for the editor behavior.

Use existing built-in plugins as patterns:

- [WikiLinkPlugin.ts](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src/plugins/builtin/WikiLinkPlugin.ts)
- [MermaidPlugin.ts](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src/plugins/builtin/MermaidPlugin.ts)
- [TaskListPlugin.ts](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src/plugins/builtin/TaskListPlugin.ts)

### Add a new command palette action

Preferred path:

1. register a palette command through `UIAPI.registerPaletteCommand(...)`;
2. connect it to an existing workflow or implement the required new behavior;
3. add translations if the command label should be localized;
4. test keyboard-driven access when relevant.

### Add a new sidebar or title-bar action

Preferred path:

1. choose the correct action region;
2. register the action through `UIAPI.registerUIAction(...)` or `registerSidebarAction(...)`;
3. connect it to a backend command or a workspace action;
4. ensure the label and tooltip are localized.

Relevant regions are defined in [UIAPI.ts](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src/plugins/api/UIAPI.ts).

### Add a new settings section or option

Preferred path:

1. decide whether the feature belongs in an existing settings tab or a plugin-contributed tab;
2. store the value in the correct persisted store;
3. apply the value through a dedicated hook or runtime bridge;
4. add labels to localization files;
5. test persistence and fallback behavior.

Examples already present in the codebase:

- language and spellcheck in `settingsStore`
- appearance values in `appearanceStore`
- accessibility values in `accessibilityStore`

### Add a new backend capability

Preferred path:

1. identify the correct backend module;
2. implement the Rust behavior;
3. add or update shared backend models if needed;
4. register the command in `lib.rs`;
5. call it from the frontend with `invoke(...)`;
6. add Rust tests and relevant frontend integration coverage.

### Add a new note-derived metadata feature

Examples:

- new frontmatter-derived field;
- new inline annotation type;
- new relation extraction behavior.

Preferred path:

1. extend parsing or extraction logic in the backend;
2. update the DB representation if persistent query support is needed;
3. update the search document shape if the feature affects search;
4. update graph projection if the feature affects relationships;
5. surface the result in the UI only after the backend model is coherent.

This type of feature often touches:

- `indexer.rs`
- `db.rs`
- `search.rs`
- `graph.rs`
- frontend rendering and stores

### Add a new graph feature

Decide first whether the change belongs to:

- the visual graph payload;
- the graph query engine;
- the frontend graph canvas.

Then change the corresponding area:

- visual graph payload: `src-tauri/src/commands/graph.rs`
- graph query projection: `src-tauri/src/grafeo_projection.rs`
- graph rendering and interaction: `src/components/GraphView/`

### Add a new theme or visual token behavior

If the feature is built-in:

1. update theme token definitions;
2. update built-in theme values;
3. update appearance application logic;
4. test both default and custom-theme paths.

Relevant areas:

- `src/themes/`
- `src/stores/themeStore.ts`
- `src/hooks/useApplyAppearanceSettings.ts`

### Add new user templates or daily-note behavior

Template handling and daily notes already have dedicated backend and plugin paths.

Relevant files:

- [src-tauri/src/commands/templates.rs](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src-tauri/src/commands/templates.rs)
- [src-tauri/src/utils/config.rs](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src-tauri/src/utils/config.rs)
- [src/plugins/builtin/DailyNotesPlugin.tsx](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src/plugins/builtin/DailyNotesPlugin.tsx)

---

## 10. How to Improve Existing Code Safely

When modifying existing functionality, use this sequence.

### First identify the ownership boundary

Ask:

- is the feature primarily frontend, backend, or cross-layer?
- is it plugin-driven or shell-driven?
- is the source of truth the vault, or is this only derived data?

This avoids making changes in the wrong layer.

### Prefer the narrowest valid change

Change only the modules that logically own the behavior.

For example:

- do not patch multiple unrelated stores if one store owns the state;
- do not add a frontend-only workaround for a backend data-model problem;
- do not add a backend command if the feature is only a presentational toggle.

### Preserve local-first semantics

Any improvement that affects content, metadata, or synchronization should preserve:

- vault portability;
- rebuildability of derived data;
- safe handling of external filesystem changes.

### Preserve plugin isolation

When modifying the plugin system:

- avoid leaking plugin state into unrelated shell code;
- prefer API additions over direct store imports inside plugins;
- keep cleanup paths correct so enable/disable remains safe.

---

## 11. Testing and Validation

Tessellum uses multiple test layers.

### Frontend tests

Frontend tests use Vitest.

Commands:

```bash
npm test
```

or

```bash
npm run test:watch
```

Frontend tests cover:

- stores;
- hooks;
- UI logic;
- plugin interactions;
- editor-related frontend behavior.

### Backend tests

Rust backend tests run through Cargo.

Command:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

These tests cover:

- backend modules;
- filesystem-related logic;
- extraction logic;
- indexing and related support code;
- integration-style backend behavior.

### E2E workflow

The repository also defines E2E scripts:

```bash
npm run e2e
```

or

```bash
npm run e2e:open
```

E2E depends on the local web-first testing path used by the project.

### Build validation

A feature is not complete until the app still builds.

Frontend build:

```bash
npm run build
```

Full desktop bundle build:

```bash
npm run tauri build
```

### Release and CI awareness

CI is defined in:

- [tauri-ci.yml](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/.github/workflows/tauri-ci.yml)
- [tauri-release.yml](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/.github/workflows/tauri-release.yml)

The CI pipeline builds on:

- Windows
- macOS
- Ubuntu

Any change that depends on OS-specific behavior should be considered against those targets.

---

## 12. Recommended Development Workflow

For a normal feature or improvement, the recommended sequence is:

1. understand which layer owns the behavior;
2. inspect the closest existing implementation pattern;
3. make the smallest correct structural change;
4. add or update tests;
5. run the relevant validation commands;
6. verify that the change still respects the local-first model.

### Practical examples

- A new editor interaction usually starts in a built-in plugin.
- A new filesystem-derived behavior usually starts in a Rust command or indexing path.
- A new persisted preference usually starts in a store and settings component pair.
- A new graph relationship rule usually starts in the backend metadata and graph path, not in the Cytoscape renderer.

---

## 13. Common Extension Scenarios

### Add a new built-in plugin

Typical steps:

1. create a plugin class in `src/plugins/builtin/`;
2. define its static manifest;
3. register its editor/UI/workspace contributions in `onload()`;
4. add translations if needed;
5. include the plugin in the built-in plugin registration path;
6. test enabling, disabling, and failure isolation.

### Add a new Tauri command

Typical steps:

1. choose the correct file under `src-tauri/src/commands/`;
2. implement the command function;
3. use shared utilities and models instead of duplicating logic;
4. register the command in `lib.rs`;
5. call it from the frontend;
6. add tests.

### Add a new file-derived query

Typical steps:

1. decide whether the query needs SQLite support;
2. add the corresponding DB or index update path;
3. expose the result through a command;
4. render it in the UI or expose it through a plugin API.

### Add a new settings-controlled visual feature

Typical steps:

1. add the persisted setting in the correct store;
2. add the control in the settings UI;
3. apply the value through an appearance/accessibility hook or component path;
4. verify persistence across sessions.

---

## 14. Common Risks When Modifying Tessellum

Developers should pay particular attention to the following risks.

### Breaking source-of-truth assumptions

If a feature stores critical semantics only in SQLite, Tantivy, or Grafeo, it risks violating the vault-first model.

### Creating frontend-backend duplication

If the frontend and backend each implement separate versions of the same rule, the system will drift.

### Overloading `App.tsx`

`App.tsx` is already a central orchestration file. New behavior should only be added there if it truly belongs to application-shell orchestration.

### Increasing store coupling

A change that forces many stores to know about each other often indicates weak boundaries.

### Skipping cleanup in plugins

Plugins must clean up their contributions correctly so runtime enabling/disabling stays safe.

### Ignoring large-vault behavior

Features that appear correct in a tiny vault may fail or become slow in large vaults.

---

## 15. How to Read the Codebase Efficiently

If a programmer is trying to understand Tessellum quickly, the following reading route is recommended:

1. [README.md](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/README.md)
2. [src/App.tsx](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src/App.tsx)
3. [src-tauri/src/lib.rs](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src-tauri/src/lib.rs)
4. [src/plugins/PluginRegistry.ts](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src/plugins/PluginRegistry.ts)
5. [src/plugins/api/UIAPI.ts](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src/plugins/api/UIAPI.ts)
6. [src/plugins/api/EditorAPI.ts](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src/plugins/api/EditorAPI.ts)
7. [src/plugins/api/WorkspaceAPI.ts](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src/plugins/api/WorkspaceAPI.ts)
8. [src-tauri/src/indexer.rs](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src-tauri/src/indexer.rs)
9. [src-tauri/src/search.rs](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src-tauri/src/search.rs)
10. [src-tauri/src/commands/graph.rs](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/src-tauri/src/commands/graph.rs)

This route gives a developer the shortest path to understanding:

- application startup;
- vault lifecycle;
- plugin extension points;
- indexing;
- search;
- graph behavior.

---

## 16. Relationship with Companion Manuals

This programmer's manual complements the other end-user and operational manuals:

- [installation manual](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/docs/architecture/2026-05-20-tessellum-installation-manual.md)
- [execution manual](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/docs/architecture/2026-05-20-tessellum-execution-manual.md)
- [user manual](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/docs/architecture/2026-05-20-tessellum-user-manual.md)

It also relates closely to:

- [architecture chapter](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/docs/architecture/2026-05-11-tessellum-une157801-architecture-chapter.md)
- [test results](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/docs/architecture/2026-05-20-tessellum-une157801-test-results.md)
- [testing plan](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/docs/architecture/2026-05-20-tessellum-une157801-testing-plan.md)

Together, these documents cover:

- deployment;
- execution;
- user operation;
- internal architecture;
- quality validation;
- developer maintenance.

---

## 17. Final Notes

Tessellum should be maintained with a clear architectural discipline:

- keep the vault as the source of truth;
- keep the backend as the owner of side-effect-heavy logic;
- keep the frontend focused on orchestration and rendering;
- keep extension logic modular through plugins and focused stores;
- keep derived data rebuildable;
- keep changes small, testable, and aligned with the existing layer boundaries.

For most improvements, the safest guiding rule is:

1. identify the real owner of the behavior;
2. change that owner first;
3. propagate the result through the existing interfaces instead of bypassing them.

That approach preserves correctness, reduces accidental complexity, and keeps Tessellum extensible as the codebase grows.
