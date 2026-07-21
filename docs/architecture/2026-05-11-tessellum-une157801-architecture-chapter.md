# Tessellum Architecture Chapter Aligned with UNE 157801

## 1. Chapter Objective and Scope

This chapter documents the current implementation of Tessellum by applying the architectural logic commonly expected by UNE 157801 to a single thesis-oriented chapter. Instead of reproducing the full documentary package of the standard, the chapter uses its underlying discipline: define the object of study, justify the adopted solution, identify the participating components, and describe the operational behavior of the system in a precise and unambiguous way.

The scope of this chapter is limited to the implemented software architecture of Tessellum as it exists in the repository at the time of writing. The focus is not on future improvements, alternative designs, or prospective refactoring. It is centered on three architectural epics that organize the system:

1. Foundational Infrastructure
2. Core Editor and Knowledge Management
3. Discovery and Visualization

Within these epics, special attention is given to three core runtime flows that explain the practical behavior of the application:

1. The React-Rust bridge over Tauri IPC
2. The reactive local-first synchronization pipeline
3. The knowledge graph projection used by the graph view

## 2. Architectural Context

Tessellum is a local-first desktop application built with Tauri, React, TypeScript, and Rust. The application stores user knowledge as plain Markdown files inside a vault selected by the user. Around that vault, Tessellum constructs several derived local models that accelerate navigation and discovery without replacing the vault as the authoritative source of truth.

The architecture is divided into four clearly differentiated layers:

1. The vault layer, which contains notes, assets, templates, themes, and trash entries in the filesystem.
2. The frontend layer, implemented in React and TypeScript, which is responsible for interaction, view composition, and state orchestration.
3. The backend layer, implemented in Rust and exposed through Tauri commands, which is responsible for filesystem coordination, indexing, metadata persistence, search, and graph-related services.
4. The derived data layer, composed of SQLite, Tantivy, and Grafeo, which stores optimized representations of vault content.

This architectural split is deliberate. The vault remains portable and human-readable, while the application-owned data structures are disposable operational projections that can be rebuilt from the filesystem state.

### 2.1. Main Architectural Components

On the frontend, the main orchestration point is [`src/App.tsx`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src\App.tsx), which restores workspace state, starts vault watching, coordinates synchronization, and switches between editor and graph surfaces. Client state is divided into focused Zustand stores such as [`src/stores/vaultStore.ts`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src\stores\vaultStore.ts), [`src/stores/searchStore.ts`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src\stores\searchStore.ts), and [`src/stores/graphStore.ts`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src\stores\graphStore.ts).

On the backend, the entry point is [`src-tauri/src/lib.rs`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src-tauri\src\lib.rs), which initializes the application state, opens the database, creates the search index, initializes the graph database, and registers all Tauri commands. The command layer is decomposed into focused modules such as search, watcher, notes, vault, graph, and indexer commands.

The local derived data model is split by responsibility:

1. [`src-tauri/src/db.rs`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src-tauri\src\db.rs) maintains SQLite tables for notes, links, indexed search files, and normalized tags.
2. [`src-tauri/src/search.rs`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src-tauri\src\search.rs) and the internal search engine manage Tantivy-backed full-text retrieval.
3. [`src-tauri/src/grafeo_projection.rs`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src-tauri\src\grafeo_projection.rs) synchronizes a graph projection used for graph querying.

## 3. Epic I: Foundational Infrastructure

### 3.1. Purpose of the Epic

The foundational infrastructure epic provides the operational substrate of Tessellum. Its purpose is to ensure that a local Markdown vault can be treated as the source of truth while still supporting responsive interaction, cached metadata, and resilient synchronization. This epic includes the Tauri IPC boundary, the filesystem watcher, the SQLite metadata cache, and the search-index coordination logic.

### 3.2. Architectural Components Involved

The main components of this epic are:

1. The frontend invocation points based on `invoke(...)`, mainly in [`src/App.tsx`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src\App.tsx) and [`src/components/Search/SearchPanel.tsx`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src\components\Search\SearchPanel.tsx).
2. The Tauri command registration in [`src-tauri/src/lib.rs`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src-tauri\src\lib.rs).
3. The watcher commands in [`src-tauri/src/commands/watcher.rs`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src-tauri\src\commands\watcher.rs).
4. The vault synchronization command in [`src-tauri/src/commands/indexer.rs`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src-tauri\src\commands\indexer.rs).
5. The indexing engine in [`src-tauri/src/indexer.rs`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src-tauri\src\indexer.rs).
6. The SQLite persistence layer in [`src-tauri/src/db.rs`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src-tauri\src\db.rs).
7. The search readiness logic in [`src-tauri/src/search.rs`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src-tauri\src\search.rs).

### 3.3. React-Rust Bridge: IPC Pattern and Non-Blocking Execution

The most important infrastructural behavior in Tessellum is not a visible interface element but the communication contract between the React frontend and the Rust backend. Because the application is built on Tauri, the frontend does not directly manipulate the filesystem, SQLite, or the search engine. Instead, it issues asynchronous commands through the IPC bridge.

This pattern appears throughout the frontend. For example, when the application opens a vault, refreshes files, warms the search index, or executes a graph query, the frontend uses `invoke(...)` to call backend commands such as `watch_vault`, `sync_vault`, `ensure_search_ready`, `search_full_text`, `get_graph_data`, and `execute_graph_query`. The frontend keeps responsibility for presentation and interaction, while the backend becomes the system boundary for all operations with side effects or derived persistence.

The backend handlers are implemented as asynchronous Tauri commands. Their design avoids blocking the user interface thread during heavy work. This is especially visible in search-related logic. In [`src-tauri/src/search.rs`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src-tauri\src\search.rs), expensive operations over the search index are delegated to `tauri::async_runtime::spawn_blocking(...)`. This means that full-text retrieval and index inspection are executed outside the main asynchronous command path, allowing the frontend to remain interactive while the backend performs CPU-intensive work.

The same principle is applied during indexing and file writes. In [`src-tauri/src/commands/notes.rs`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src-tauri\src\commands\notes.rs), writing a note triggers immediate persistence to disk, metadata extraction, SQLite updates, and an asynchronous update of the search index. This design turns the IPC boundary into a technical contract: the frontend requests an operation, the backend performs it safely and asynchronously, and the result is returned without freezing the interface.

#### Runtime sequence of a search request

The execution of a search request can be summarized as follows:

1. The user types a query in the search panel.
2. [`src/components/Search/SearchPanel.tsx`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src\components\Search\SearchPanel.tsx) debounces the input and checks the readiness state stored in [`src/stores/searchStore.ts`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src\stores\searchStore.ts).
3. If the search subsystem is ready, the frontend invokes `search_full_text`.
4. The backend handler delegates the Tantivy query to a blocking worker through `spawn_blocking`.
5. Search results are transformed into serializable hits containing path, relative path, title, score, optional snippet, and tags.
6. The response crosses the IPC boundary back to React.
7. The frontend renders the result list without any direct dependency on search-engine internals.

This pattern is architecturally important because it keeps concerns separate and allows the application to handle filesystem, indexing, and retrieval logic with desktop-level performance while preserving frontend responsiveness.

### 3.4. Reactive Data Pipeline: Local-First Synchronization

The second critical flow inside this epic is the synchronization pipeline that keeps the application aligned with the filesystem. In a local-first system such as Tessellum, data may change from inside the app or outside it. Therefore, the core problem is not simply how to save a note, but how to converge toward a consistent runtime model after arbitrary vault changes.

This behavior begins in [`src-tauri/src/commands/watcher.rs`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src-tauri\src\commands\watcher.rs). When the frontend calls `watch_vault`, the backend creates a recursive `notify` watcher over the current vault. Each accepted filesystem event invalidates the in-memory file and asset caches stored in `AppState` and emits the `file-changed` event back to the frontend. The event is debounced so that event storms from rapid filesystem activity do not overwhelm the UI.

On the frontend, [`src/App.tsx`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src\App.tsx) listens for `file-changed`. When it receives the event, it performs two coordinated actions. First, it refreshes the visible file list and file tree by calling `list_files` and `list_files_tree`. Second, it schedules a delayed `sync_vault` invocation. This delay prevents excessive re-indexing during bursts of external changes.

The actual synchronization logic is implemented in [`src-tauri/src/commands/indexer.rs`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src-tauri\src\commands\indexer.rs) and [`src-tauri/src/indexer.rs`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src-tauri\src\indexer.rs). The indexer scans the vault, ignores hidden or special paths, classifies markdown and non-markdown files, compares filesystem modification times against the `search_files` table in SQLite, and then updates only what is needed. For Markdown notes, it reads the file, parses frontmatter, extracts inline tags, resolves wiki links through the file index, updates the `notes`, `links`, `note_tags`, and `search_files` tables, and prepares a `SearchDoc` for the full-text index. For deleted files, it removes stale rows from SQLite and deletes the corresponding documents from the search index.

The result is a reactive convergence pipeline in which the filesystem remains the authoritative source, SQLite becomes the normalized relational cache, Tantivy becomes the searchable projection, and the frontend becomes the visible consumer of the refreshed state.

#### Runtime sequence of an external file edit

The current implementation of the local-first flow can be described as follows:

1. A Markdown file is modified outside Tessellum.
2. The recursive watcher detects the filesystem event.
3. The backend debounces the signal, invalidates runtime caches, and emits `file-changed`.
4. The frontend receives the event and refreshes the flat file list and the tree representation.
5. The frontend schedules `sync_vault`.
6. The backend scans the vault and detects that the modified file requires re-indexing.
7. The file content is parsed again to extract frontmatter, inline tags, and resolved wiki links.
8. SQLite is updated with the new note metadata, tag normalization, and link relationships.
9. The Tantivy index is updated with the new search document.
10. If the sync affected a sufficiently large number of items, the Grafeo projection is also refreshed through `sync_full`.
11. The frontend now reflects the new filesystem state, and subsequent search and graph operations use the updated derived data.

This pipeline is the practical expression of the local-first principle in Tessellum. The application does not attempt to prevent external changes; instead, it is designed to absorb them and rebuild a consistent local model.

### 3.5. SQLite as Metadata Cache

Inside this epic, SQLite is not the source of truth but the central metadata cache. The database schema in [`src-tauri/src/db.rs`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src-tauri\src\db.rs) shows this clearly. The `notes` table stores note path, modification time, size, frontmatter, and inline tags. The `links` table stores resolved relationships between notes. The `note_tags` table normalizes tag membership. The `search_files` table tracks which filesystem entries have been incorporated into the local search model.

This design gives the application fast relational queries for backlinks, orphan detection, tag lookups, and search readiness checks without requiring the frontend to traverse raw files repeatedly.

## 4. Epic II: Core Editor and Knowledge Management

### 4.1. Purpose of the Epic

The second epic transforms plain Markdown files into navigable knowledge objects. Its purpose is to give semantic structure to otherwise simple text documents by combining editing, metadata extraction, wiki-linking, and tag systems. This epic defines how notes are authored, interpreted, and connected.

### 4.2. Main Components Involved

The main components of this epic are:

1. The editor surface in [`src/components/Editor/Editor.tsx`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src\components\Editor\Editor.tsx).
2. The built-in editor plugin system under [`src/plugins/builtin/`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src\plugins\builtin).
3. The wiki-link support under [`src/components/Editor/extensions/wikilink/`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src\components\Editor\extensions\wikilink).
4. The note write and indexing flow in [`src-tauri/src/commands/notes.rs`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src-tauri\src\commands\notes.rs).
5. The file index model used for wiki-link resolution in [`src-tauri/src/models/file_index.rs`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src-tauri\src\models\file_index.rs).

### 4.3. Markdown Rendering and Editing Model

Tessellum treats Markdown as the persistent format of the knowledge base. The editor layer enriches this format with behaviors such as callouts, tables, task lists, inline code, math, Mermaid diagrams, frontmatter handling, media embedding, and preview-oriented plugins. These capabilities are intentionally implemented through the plugin system instead of being hard-coded into a single editor module. This preserves separation of concerns and keeps editor behavior extensible.

From an architectural point of view, the editor does not own the truth of the note. It provides a structured interface for viewing and modifying Markdown, but the persisted representation remains the file content stored in the vault. Once a note is written, the backend extracts the knowledge-relevant structures from that content.

### 4.4. Bi-Directional Linking

Bi-directional linking in Tessellum is not stored as an explicit pair of forward and reverse references in the Markdown files. Instead, it is derived from resolved outgoing links and later queried in reverse through SQLite.

When a note is indexed or rewritten, the backend uses `extract_wikilinks(...)` to parse the body content and detect wiki-link targets. These targets are then resolved against the current vault file index so that the stored relationships are canonical filesystem paths rather than ambiguous display names. The result is written into the `links` table as `(source_path, target_path)` pairs.

This means that backlinks are not authored directly by the user. They are computed from the same normalized relation set by asking which notes point to the current note. The relational model therefore supports both outgoing links and backlinks while keeping only one canonical link representation.

This design has two important consequences:

1. Links remain stable even when different notes use short or path-qualified wiki-link forms, because the backend resolves them to full normalized paths.
2. Knowledge relationships can be reused consistently by both the graph view and note-level backlink queries.

### 4.5. Tagging and Metadata Normalization

Tessellum supports two complementary metadata sources inside a note: frontmatter properties and inline tags. During indexing, both sources are parsed and normalized.

Frontmatter is parsed and stored as JSON in the `notes` table. Inline tags are extracted from the content and stored both in serialized form inside the note record and in the normalized `note_tags` table. This split supports two different needs. The serialized note metadata preserves the original note-level context, while the normalized table allows efficient cross-note tag queries.

The result is that knowledge-management features do not need to parse files on demand every time they need tags or metadata. The editor remains centered on Markdown authoring, while the backend turns note content into structured queryable knowledge.

### 4.6. Knowledge Flow During a Note Write

The current write path of a note can be summarized as follows:

1. The frontend sends a `write_file` request through Tauri IPC.
2. The backend writes the Markdown content to disk.
3. The backend parses frontmatter, strips it from the searchable body when necessary, and extracts inline tags.
4. Wiki links are parsed from the body content and resolved against the current file index.
5. SQLite updates the note row, normalized tags, and canonical outgoing links.
6. The search index receives an updated `SearchDoc`.
7. The graph projection receives an incremental synchronization of the changed note and its added or removed link relations.

This flow shows that the editor epic is not isolated from the infrastructural one. Authoring actions immediately propagate into the derived knowledge model.

## 5. Epic III: Discovery and Visualization

### 5.1. Purpose of the Epic

The third epic is responsible for transforming stored knowledge into navigable discovery surfaces. Its purpose is to make vault content retrievable through search, explorable through graph views, and extendable through the plugin model. This epic therefore covers three complementary capabilities: textual discovery, relational visualization, and controlled extensibility.

### 5.2. Full-Text Search

Full-text search in Tessellum combines frontend readiness orchestration with backend indexing and retrieval. The frontend maintains a dedicated store for search state in [`src/stores/searchStore.ts`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src\stores\searchStore.ts). That store does not execute search by itself; instead, it manages recent queries, readiness status, retry behavior, and the distinction between warming and ready states.

On the backend, [`src-tauri/src/search.rs`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src-tauri\src\search.rs) verifies whether the Tantivy index is coherent with the Markdown files recorded in SQLite. If the mismatch between the expected set and the indexed set crosses a threshold, the backend rebuilds the search index. This behavior ensures that the textual discovery layer remains aligned with the underlying vault even after partial drift.

Search results are therefore the output of a multi-stage process:

1. Vault content is indexed into SQLite and Tantivy.
2. Readiness checks confirm that the search projection is usable.
3. The frontend sends a full-text request with optional tag filtering.
4. The backend executes the query and returns structured hits.
5. The frontend renders those hits as note-level navigation results.

### 5.3. Knowledge Graph Projection

The graph subsystem is built from two related but distinct representations. The first is the relational metadata model stored in SQLite. The second is the graph projection maintained in Grafeo. This distinction is important because the default visual graph and the advanced query graph are not produced through exactly the same path.

The standard graph view uses the backend command `get_graph_data`, implemented in [`src-tauri/src/commands/graph.rs`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src-tauri\src\commands\graph.rs). This command queries SQLite for:

1. All indexed notes
2. All canonical links
3. Broken links
4. Orphaned files
5. File-associated tags

From these relational results, the backend constructs a serializable `GraphData` object composed of `nodes` and `edges`. Nodes include the normalized identifier, a human-readable label, an `exists` flag, an `orphan` flag, and the note tags. Edges include source, target, and a `broken` flag. If a target is referenced by a broken link but does not exist as a real note, the backend creates a ghost node so that the missing target still appears in the visual model.

This means that the visible graph is not stored as a pre-rendered artifact. It is assembled dynamically from normalized relational metadata.

### 5.4. Graph Rendering Flow

The graph rendering flow can be summarized as follows:

1. The frontend graph surface in [`src/components/GraphView/GraphView.tsx`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src\components\GraphView\GraphView.tsx) requests `get_graph_data`.
2. The backend queries SQLite for notes, links, orphan notes, broken links, and tags.
3. The backend transforms that relational data into a JSON structure composed of graph nodes and graph edges.
4. The JSON crosses the IPC boundary and is stored in frontend component state.
5. The frontend converts the returned structure into Cytoscape element definitions through [`src/utils/graphUtils.ts`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src\utils\graphUtils.ts).
6. [`src/components/GraphView/GraphCanvas.tsx`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src\components\GraphView\GraphCanvas.tsx) renders the graph visually.
7. When the vault changes and the `file-changed` event is emitted, the graph view fetches the graph data again and re-renders the projection.

This flow is the implementation of the knowledge graph projection requested in the project brief. The graph is not an independent source of knowledge. It is a projection of the normalized note-link-tag system.

### 5.5. Grafeo Query Layer

In addition to the default graph view, Tessellum maintains a Grafeo database initialized in [`src-tauri/src/lib.rs`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src-tauri\src\lib.rs) and synchronized through [`src-tauri/src/grafeo_projection.rs`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src-tauri\src\grafeo_projection.rs). In this projection, notes become graph nodes with `id`, `title`, and `tags`, while note relationships become `LINKS_TO` edges.

This layer is used by `execute_graph_query`, which supports Cypher-style querying from the graph interface. The role of Grafeo is therefore not to replace SQLite but to provide a graph-native query model for advanced discovery interactions.

### 5.6. Plugin Extensibility as a Discovery Enabler

Plugin extensibility also belongs to this epic because discovery in Tessellum is not limited to search boxes and graph canvases. The frontend plugin runtime, centered on [`src/plugins/TessellumApp.ts`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src\plugins\TessellumApp.ts) and [`src/plugins/PluginRegistry.ts`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src\plugins\PluginRegistry.ts), allows built-in and future plugins to contribute editor extensions, commands, UI actions, settings tabs, and workspace-aware behaviors.

Architecturally, this means Tessellum does not hard-code every discovery capability into one closed interface. Instead, it provides controlled extension points through APIs such as `EditorAPI`, `WorkspaceAPI`, `CommandAPI`, and `UIAPI`. In the current implementation, many of the advanced editing and navigation capabilities already rely on this model.

## 6. Architectural Synthesis

When viewed through UNE 157801-style architectural logic, Tessellum can be understood as a layered local-first knowledge system whose behavior is defined by the interaction between a portable Markdown vault and several specialized derived models.

The foundational infrastructure epic establishes the system boundary and synchronization discipline. The core editor and knowledge-management epic turns raw Markdown into normalized metadata and canonical note relationships. The discovery and visualization epic projects that normalized knowledge into search and graph interfaces that remain consistent with the vault.

The three critical flows studied in this chapter summarize the current implementation:

1. The React-Rust bridge ensures that expensive operations cross the IPC boundary as asynchronous commands and do not block the interface.
2. The reactive local-first pipeline ensures that filesystem changes, whether internal or external, eventually converge into refreshed UI state, updated SQLite metadata, and synchronized search and graph projections.
3. The graph projection flow transforms relational note metadata into a serializable graph representation that Cytoscape can render and that Grafeo can query more expressively.

The resulting architecture is coherent with the goals of Tessellum as a desktop knowledge-management system. The vault remains the source of truth, while SQLite, Tantivy, and Grafeo act as specialized derived representations that improve responsiveness, discovery, and navigability without compromising data portability.
