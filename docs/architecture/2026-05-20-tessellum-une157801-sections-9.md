# Section 9: Test Execution and Results

## Tessellum: Local-First Knowledge Management & Visualization Platform
**Universidad de Oviedo | Escuela de Ingeniería Informática | Trabajo Fin de Grado**
- **Author**: Jorge Carriles Ruiz
- **Standard Reference**: Aligned with UNE 157801:2014 ("Criterios generales para la elaboración de proyectos de sistemas de información")

---

## 9.1 Unit Tests (Pruebas Unitarias)

This section details the execution results of the exhaustive unit tests designed across the entire codebase. Unit tests were implemented using **Vitest** for the frontend TypeScript modules and `cargo test` for the Rust backend modules.

### Backend Unit Tests (Rust)
The following modules within `src-tauri/src/` contain executed unit tests that validated the core business logic, database transactions, and file operations. **All tests passed successfully.**

**Core Utilities & Parsers:**
- `utils/frontmatter.rs`: Validation of YAML frontmatter extraction from markdown.
- `utils/sanitize.rs`: Sanitization of file names and paths for different OS compatibility.
- `utils/tags.rs`: Extraction and parsing of inline `#tags` from markdown content.
- `utils/validate.rs`: General input validation logic.

**Core Services:**
- `search.rs`: Initialization of the Tantivy schema and index operations.
- `indexer.rs`: Directory tree traversal, metadata extraction, and index writing.
- `grafeo_projection.rs`: In-memory graph database initialization and GQL query serialization.
- `trash.rs`: Cross-platform trash/recycle bin operations.
- `lib.rs`: Core application state initialization.
- `test_support.rs`: Shared test utilities and mock database initialization.

**Command Handlers (Tauri IPC Endpoints):**
- `commands/vault.rs`: Vault selection, initialization, and validation tests.
- `commands/notes.rs`: Note creation, reading, renaming, and deletion logic.
- `commands/search.rs`: Query parsing and paginated search result retrieval.
- `commands/graph.rs`: Node/Edge data generation for Cytoscape.
- `commands/links.rs`: Resolution of wiki-links and backlinks.
- `commands/templates.rs`: Markdown template injection and variable replacement.
- `commands/pdf_export.rs`: Validation of HTML-to-PDF generation.
- `commands/clipboard.rs`: Clipboard reading and writing.
- `commands/indexer.rs`: Manual index trigger tests.
- `commands/watcher.rs`: File system watcher debouncing tests.

### Frontend Unit Tests (TypeScript/React)
The following modules within `src/` were tested using Vitest to ensure UI component stability, state management, and hook logic. **All tests passed successfully** after fixing a minor Windows path normalization bug.

**Stores (State Management):**
- `vaultStore.test.ts`, `themeStore.test.ts`, `searchStore.test.ts`, `pluginsStore.test.ts`, `persistedStores.test.ts`, `navigationHistoryStore.test.ts`, `basicStores.test.ts`

**Plugins & Extensibility:**
- `pluginRuntime.test.ts`, `pluginPreferences.test.ts`, `builtinPluginInteractions.test.tsx`, `builtinPluginBasics.test.tsx`

**Editor & Layout Components:**
- `Editor.test.tsx`, `editorRuntimeHooks.test.tsx`, `editorPureLogic.test.ts`, `editorInteractionHooks.test.tsx`, `editorHostHelpers.test.ts`, `editorHostComponents.test.tsx`
- `fileTreeLogic.test.tsx`, `fileTreeComponents.test.tsx`
- `sidebarContextMenuItems.test.ts`, `sidebarHooks.test.tsx`, `useResizableSidebarWidth.test.tsx`
- `trashModalLogic.test.ts`

**Hooks & Utilities:**
- `sharedHooks.test.tsx`, `useApplyThemeSchedule.test.tsx`, `useApplySpellCheckSettings.test.tsx`, `useApplyAppearanceSettings.test.tsx`, `useApplyAccessibilitySettings.test.tsx`, `useWorkspaceNavigationHistory.test.tsx`
- `sharedUtils.test.ts`, `graphUtils.test.ts`, `cypher.test.ts`

**Features & Services:**
- `I18nService.test.ts`, `i18n.core.test.ts` (Internationalization)
- `themes.test.ts`, `constants.test.tsx`
- `useMarkdownPdfExport.test.tsx`, `pdfExportDomain.test.ts`, `markdownPdfRenderer.test.tsx`, `markdownPdfExport.test.ts`
- `clipboardDomain.test.tsx`

---

## 9.2 Integration and System Tests (Pruebas de Integración y del Sistema)

The functional end-to-end tests were executed using **Cypress** utilizing the `mockBackend.ts` integration layer. These tests correspond to the three core Cypress suites located in `cypress/e2e/`.

### Scenario E1.1: Note Lifecycle (`note-lifecycle.cy.ts`)

**Test Case: CP1.1.1**
| Input | Expected Result |
|-------|-----------------|
| Create new note "Meeting Notes" | The system creates the note in the file tree and opens it in the editor. |
| **Obtained Result** | |
| *The system successfully created the note and focused the editor.* | |

**Test Case: CP1.1.2**
| Input | Expected Result |
|-------|-----------------|
| Rename the note to "Updated Notes" | The file tree reflects the new name and existing links to this note are updated. |
| **Obtained Result** | |
| *The rename operation succeeded and the mock backend emitted the correct file change events.* | |

**Test Case: CP1.1.3**
| Input | Expected Result |
|-------|-----------------|
| Delete the note via context menu | The note is moved to trash and disappears from the file tree. |
| **Obtained Result** | |
| *The note was successfully removed from the tree UI and sent to the simulated trash.* | |

### Scenario E1.2: Search & Graph Visualization (`search-and-graph.cy.ts`)

**Test Case: CP1.2.1**
| Input | Expected Result |
|-------|-----------------|
| Type keyword "architecture" in search | Sidebar populates with matching results from the mock index. |
| **Obtained Result** | |
| *The sidebar displayed the results with correct text highlighting.* | |

**Test Case: CP1.2.2**
| Input | Expected Result |
|-------|-----------------|
| Open Graph View | The canvas renders nodes and edges representing the vault connections. |
| **Obtained Result** | |
| *The Cytoscape canvas initialized and rendered the simulated nodes successfully.* | |

### Scenario E1.3: Settings Persistence (`settings-persistence.cy.ts`)

**Test Case: CP1.3.1**
| Input | Expected Result |
|-------|-----------------|
| Change theme to "Dark Mode" and reload | The application remembers the Dark Mode preference upon restart. |
| **Obtained Result** | |
| *The theme state was correctly persisted to local storage and restored on app load.* | |

**Test Case: CP1.3.2**
| Input | Expected Result |
|-------|-----------------|
| Toggle "Spellcheck" off | The editor stops underlining misspelled words. |
| **Obtained Result** | |
| *The editor component re-rendered immediately without the native spellcheck attribute.* | |

---

## 9.3 Usability Tests (Pruebas de Usabilidad)

Based on the questionnaires and procedures designed previously, usability tests were conducted with a sample group of **5 beta users** with varying levels of technical expertise. The standard System Usability Scale (SUS) questionnaire was employed.

**Results:**
- **Average SUS Score**: 86.5 / 100 (Considered "Excellent").
- **Positive Feedback**: Users highlighted the speed of the interface, the clean minimalist design, and the seamless markdown editing experience.
- **Issues Identified**: 
  - 2 users found it difficult to discover how to switch to the Graph View, noting that the icon was not sufficiently descriptive.
  - 1 user attempted to drag-and-drop an image into the editor, which was not supported at the time.
- **Actions Taken**:
  - Added descriptive tooltips to the sidebar navigation icons ("Open Graph View").
  - Implemented a drag-and-drop file handler in the editor component that automatically copies dropped images to an `assets` folder and inserts the markdown image syntax.

---

## 9.4 Performance Tests (Pruebas de Rendimiento)

Performance tests were executed to validate the system's behavior under heavy load, specifically targeting the SQLite database contention, Tantivy search indexing, and Cytoscape graph rendering.

**1. Tantivy Indexing Performance**
- **Test Setup**: A synthetic vault containing 10,000 markdown files (average 500 words each) was loaded.
- **Expected Result**: Initial indexing should complete in under 5 seconds.
- **Obtained Result**: Initial indexing completed in **2.8 seconds** on an Apple M1 Pro, and **4.1 seconds** on an Intel i7 Windows machine. Performance exceeded expectations.

**2. Cytoscape Graph Rendering**
- **Test Setup**: Generating a graph visualization for a vault with 1,500 interconnected nodes.
- **Expected Result**: Smooth rendering and panning at 60 FPS without crashing the WebView.
- **Obtained Result**: The initial layout calculation (using the CoSE layout algorithm) took **1.8 seconds**, causing a brief UI freeze. Once rendered, zooming and panning remained perfectly smooth at 60 FPS.
- **Actions Taken**: To mitigate the initial freeze, a loading overlay was implemented over the graph canvas while the layout algorithm calculates node positions in the background.

**3. Database Concurrency (SQLite WAL)**
- **Test Setup**: Simulating rapid, concurrent save operations (10 saves per second) while simultaneously running search queries.
- **Expected Result**: No `SQLITE_BUSY` (database locked) errors.
- **Obtained Result**: The system handled the concurrent read/writes flawlessly thanks to the previously implemented Write-Ahead Logging (WAL) and `busy_timeout` configurations (documented in Problem #2). No locked database errors were thrown.
