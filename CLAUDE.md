# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Frontend
- `npm run dev`: Start the Vite development server.
- `npm run build`: Build the frontend application (`tsc && vite build`).
- `npm run tauri dev`: Run the full application in development mode (Tauri + Vite).
- `npm run tauri build`: Build the production application bundle.
- `npm test`: Run all frontend unit tests once (Vitest).
- `npm run test:watch`: Run frontend tests in watch mode.
- `npm run e2e`: Run Cypress E2E tests (starts dev server, then runs specs).
- `npm run e2e:open`: Open Cypress interactive UI.

### Backend (Rust)
- `cd src-tauri && cargo test`: Run all Rust backend tests.
- `cd src-tauri && cargo test <name>`: Run a specific Rust test by name.

### Running a single frontend test file
```
npx vitest run src/path/to/file.test.ts
```

## Architecture

Tessellum is a local-first knowledge management application with a decoupled React frontend and Rust backend communicating via Tauri IPC commands.

### Data Flow
1. The **Vault** (user's filesystem directory of `.md` files) is the source of truth.
2. On open/change, the **Indexer** (`src-tauri/src/indexer.rs`) scans the vault and populates **SQLite** (metadata, tags, wikilinks) and **Tantivy** (full-text search index).
3. The frontend reads state via **Tauri commands** (`src-tauri/src/commands/`) and writes back through the same IPC boundary.
4. A filesystem **watcher** (`commands/watcher.rs`) re-triggers indexing on file changes.

### Plugin System
Features are implemented as plugins registered with `PluginRegistry` (`src/plugins/`). Each plugin can subscribe to the `EventBus`, declare UI components, and call Tauri commands via the plugin API layer (`src/plugins/api/`). The builtin plugin (`src/plugins/builtin/`) is the main feature plugin shipping with the app.

### Frontend State
Zustand stores are split by domain in `src/stores/`: vault, editor content, editor mode, selection, search, graph, UI, settings (appearance, accessibility), navigation history, and plugins. Stores are individually persisted where appropriate.

### Key Non-Obvious Boundaries
- `src/features/`: Self-contained feature slices (currently `clipboard`, `pdfExport`) with their own domain logic, hooks, and tests — prefer adding new features here rather than inside `components/`.
- `src/plugins/api/`: The only sanctioned way for plugins to call Tauri commands; do not call `invoke` directly from component code.
- `src-tauri/src/test_support.rs`: Shared test helpers (`TestVault`, `TestVaultBuilder`) used by integration tests.

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS v4, Zustand, CodeMirror 6, Cytoscape, react-i18next.
- **Backend**: Rust, Tauri v2, SQLite (`sqlx`), Tantivy, Grafeo.
- **Testing**: Vitest + Testing Library (frontend), Cargo test (backend), Cypress (E2E).
- **CI/CD**: GitHub Actions (Windows, macOS, Ubuntu).
