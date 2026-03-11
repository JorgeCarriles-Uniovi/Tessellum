# Tessellum

Local-first knowledge management app built with Tauri, React, and TypeScript. Tessellum manages a folder of Markdown notes ("vault"), indexes links/tags/metadata in a local SQLite database, and provides an editor plus graph views for navigation.

## Architecture

### Frontend (React + Vite)

- **UI shell**: `src/App.tsx` wires the layout (TitleBar, Sidebar, Editor, GraphView) and handles vault selection, background sync, and file watcher events.
- **State**: `src/stores/editorStore.ts` (Zustand) stores vault path, file tree, active note, view mode (editor/graph), and UI state.
- **Editor**: `src/components/Editor/Editor.tsx` uses CodeMirror 6 with slash commands, wikilink suggestions, callouts, and table pickers. Editor behavior is extended by plugins through a shared API.
- **Graph views**: `src/components/GraphView` renders a global graph via Cytoscape and an optional local graph panel.
- **Sidebar + FileTree**: `src/components/Sidebar` and `src/components/FileTree` handle navigation, note creation, context menus, and template-based note creation.
- **Plugin system**: `src/plugins` provides the plugin registry, event bus, and APIs for editor/vault/workspace/commands/UI.

### Backend (Tauri + Rust)

- **Command layer**: `src-tauri/src/commands` exposes all backend functionality to the frontend via Tauri commands.
- **Database**: `src-tauri/src/db.rs` manages a SQLite database with `notes` and `links` tables used for metadata, tags, and graph relationships.
- **Indexer**: `src-tauri/src/indexer.rs` performs a full sync by scanning the vault, extracting links/tags/frontmatter, and updating the DB.
- **Watcher**: `src-tauri/src/commands/watcher.rs` listens for filesystem changes and emits debounced `file-changed` events.
- **Shared state**: `src-tauri/src/models/app_state.rs` keeps the DB handle, watcher, and a cached in-memory file index for link resolution.

### Data Flow (High Level)

1. User selects a vault folder.
2. The backend starts watching the vault and performs periodic syncs.
3. On file changes or saves, the backend indexes file metadata, tags, frontmatter, and resolved wikilinks.
4. The frontend queries the backend for files, tree structure, backlinks, graph data, and templates.
5. Graph view renders nodes/edges using backend-resolved paths to avoid inconsistencies.

## Main Functionality

- **Local-first Markdown vault** stored on disk. No cloud dependency.
- **Note creation and renaming** with collision-safe filenames and backlink rewriting on rename.
- **Wikilinks** (`[[Note]]` and `[[Note|Alias]]`) with resolution to full paths.
- **Graph view** built from resolved links, including broken-link ghost nodes and orphan detection.
- **Templates** stored at `{vault}/.tessellum/templates/` with placeholders:
  - `{{date}}`, `{{time}}`, `{{datetime}}`, `{{title}}`, `{{vault}}`
- **Frontmatter + inline tags** indexing for metadata and tag-driven UI.
- **Slash commands and pickers** for callouts and table insertion.
- **Plugin-driven editor extensions** including callouts, mermaid, inline tags, code blocks, math, tables, and markdown preview.

## Built-in Plugins

Registered in `src/plugins/builtin/index.ts` in order of CodeMirror extension priority:

- `MarkdownPreviewPlugin`
- `DividerPlugin`
- `MathPlugin`
- `CalloutPlugin`
- `TablePlugin`
- `WikiLinkPlugin`
- `CoreCommandsPlugin`
- `CodePlugin`
- `MermaidPlugin`
- `FrontmatterPlugin`
- `InlineTagsPlugin`

## Project Structure

- `src/` frontend React app
- `src/components/` UI components (Editor, Sidebar, GraphView, etc.)
- `src/plugins/` plugin system and built-in plugins
- `src/stores/` global app state (Zustand)
- `src-tauri/` Tauri backend (Rust commands, DB, indexer)

## Development

- `npm run tauri dev` runs the full Tauri app
```bash
# 1. Clone the repository
git clone https://github.com/your-username/your-repo-name.git
cd your-repo-name

# 2. Install frontend dependencies
npm install  # or yarn/pnpm

# 3. Run the app in development mode
npm run tauri dev
```
## TODO

- add image and pdf support
- add styles support
- add cypher for the graph
- add full text search and search by tags
- add support for editor type niri
- resize the editor
- view and editing mode
- toggle plugins in settings
- improve keyboard use in template modal
