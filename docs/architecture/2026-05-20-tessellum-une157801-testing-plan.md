# Testing Plan Design

## Tessellum: Local-First Knowledge Management & Visualization Platform
**Universidad de Oviedo | Escuela de Ingeniería Informática | Trabajo Fin de Grado**
- **Author**: Jorge Carriles Ruiz
- **Standard Reference**: Aligned with UNE 157801:2014 ("Criterios generales para la elaboración de proyectos de sistemas de información")

---

The software testing process is a standard engineering discipline integrated across the system construction lifecycle. In the development of Tessellum, testing functions as a continuous verification activity embedded within each phase of development, incorporating unit verification for core utility models and backend schemas, component-driven testing for user interface states, and automated regression integration gates.

This specification defines the designed test cases and introduces the verification methodologies (specifically Usability and Performance testing) required to validate compliance with functional requirements, performance limits, and user interface specifications.

## 4.2.2.6.1 Testbed Environment

To guarantee the consistency and reproducibility of all test executions, the automated and manual testing processes are conducted under a standardized host configuration:

- **Operating System**: Microsoft Windows 11 Professional (64-bit, Version 22H2 / Build 22621 or higher).
- **Processor (CPU)**: Intel Core i7 (10th Generation or higher) or AMD Ryzen 7 (4000 series or higher).
- **Memory (RAM)**: 16 GB DDR4/DDR5 or higher.
- **Storage**: Solid State Drive (SSD) with a minimum of 10 GB of available disk space.
- **Development Environment and Toolchain**:
  - **Integrated Development Environment (IDE)**: Visual Studio Code (Version 1.88 or higher).
  - **Runtime Environment**: Node.js (Version 20 LTS or higher) and npm (Version 10 or higher).
  - **System Compiler**: Rust Compiler and Cargo toolchain (Version 1.75 Stable or higher).
  - **Desktop Framework**: Tauri CLI (Version 1.6 or higher) utilizing Microsoft Edge WebView2 as the frontend rendering engine.
  - **End-to-End Test Driver**: Cypress (Version 13 or higher) running in a standardized Chromium-based browser context.

### Multi-Process / Localhost Architecture Specification
Tessellum implements a multi-process architecture consisting of independent runtime components: a React frontend client running inside a WebView2 rendering window, a Rust backend core controller process executing system commands, a local SQLite embedded database operating in Write-Ahead Logging (WAL) mode, a Tantivy full-text search engine indexer, and a Grafeo graph projection memory cache.

All automated and manual tests are executed locally on a single host machine. Inter-process communication (IPC) between the frontend client and the backend core is performed via the native Tauri IPC bridge using isolated local system calls. File system modifications, database operations, search indexing, and graph cache calculations are restricted entirely to temporary directories within the local environment (localhost), eliminating external network dependencies and ensuring test isolation.

### Test Execution Sequence
Tests are executed in a sequential, hierarchical order within both local development environments and the Continuous Integration (CI) pipeline to verify lower-level components before testing complex integration workflows:

| Sequence Order | Testing Phase | Description and Tooling |
|---|---|---|
| 1 | Static Analysis & Linting | Automated code quality and syntax verification using ESLint, Clippy, and Prettier. |
| 2 | Subsystem Unit Tests | Isolated verification of individual functions and modules using Vitest and `cargo test`. |
| 3 | Integration Tests | Verification of transactional pipelines and database commands via `cargo test --test`. |
| 4 | End-to-End System Tests | Full application user journey verification using Cypress. |
| 5 | Usability Evaluations | Asynchronous, user-guided verification via standardized questionnaires. |
| 6 | Performance & Load Audits | Verification of resource consumption, database volume limits, and constraint boundaries. |

---

## 4.2.2.6.2 Unit Testing

Unit tests validate the functional correctness of individual software modules in isolation. Each test case targets a single class, function, or state store to verify compliance with specifications prior to subsystem integration.

### Subsystem Division and Implementation Details
The unit testing architecture is divided into two primary subsystems based on the application design:

1. **Frontend Subsystem (React / TypeScript):**
   - **Target Modules**: Zustand state stores (`settingsStore.ts`, `editorContentStore.ts`), interface modals (`InputModal.tsx`, `DeleteConfirmModal.tsx`), custom hook decision paths (`useDeleteFile.ts`), and markdown parsing modules (`markdownShortcuts.ts`).
   - **Data Inputs**: Structured state snapshots, trimmed and untrimmed strings, font size boundaries, and text selection coordinates.
   - **Execution Framework**: Vitest combined with React Testing Library (RTL) within a virtual `jsdom` environment to simulate user interface interactions and state transitions in memory without requiring a compiled desktop binary.

2. **Backend Subsystem (Rust / Tauri Core):**
   - **Target Modules**: Path security filters (`validate.rs`), trash lifecycle managers (`trash.rs`), search query normalizers (`search.rs`), and database utilities (`db.rs`).
   - **Data Inputs**: Mock filesystem directories, invalid paths (including parent directory traversal tokens), database rows, and search tokens.
   - **Execution Framework**: `cargo test` using native Rust test modules isolated via the `#[cfg(test)]` attribute.

### Triggers, Correction Measures, and Regression Strategy
- **Execution Trigger**: Unit tests are executed locally by developers during code modification (via active watching mechanisms) and are automatically triggered in the central repository platform upon every commit and Pull Request.
- **Defect Correction Measures**: A unit test failure automatically blocks code integration in the CI/CD pipeline. The defect is logged, isolated to the specific module, and corrected locally by the developer before re-submitting the code.
- **Regression Testing Strategy**: The entire unit test suite is executed automatically upon any code change to verify that existing features remain operational. Code coverage tools track statement and branch coverage against established quality gates to prevent regression.

### Functional Use Case Testing Coverage
Unit tests directly validate the functional requirements defined in the System Analysis documentation. These tests map to the basic, alternative, and error paths of the 14 system use cases, isolating the respective components and handlers:

- **CU1: Manage Vault**: Verifies that vaultStore initializes correctly, populates file lists from the target directory, manages workspace tab switching, and prevents duplicate tab references.
- **CU2: Manage Notes**: Validates that note creation requests trim whitespace, handles filename collisions according to filesystem rules, and blocks note modifications when read-only conditions are active.
- **CU3: Manage Folders**: Checks that directory creation requests with duplicate names are blocked, and names containing invalid operating system characters are sanitized or rejected.
- **CU4: Search Notes**: Tests query tokenization, multi-token lookups with tag filters (e.g., `content:graph #feature`), and ensures that concurrent initialization requests are coalesced into a single thread.
- **CU5: Manage Trash**: Verifies that trashed items are removed from active navigation views, name collisions on restore receive unique indexing suffixes, and the 30-day retention boundary is enforced down to millisecond precision.
- **CU6: Manage Settings**: Validates font size clamping between the absolute limits of 12 and 24 pixels, verifies fallback to the default English locale on invalid language inputs, and ensures graceful recovery from corrupted browser storage.
- **CU7: Manage Themes**: Validates custom JSON theme schemas, verifies scheduling boundary timers, and checks fallback theme assignment during storage configuration errors.
- **CU8: Manage Plugins**: Audits the initialization and teardown lifecycles of the PluginRegistry, ensuring plugin runtime errors are isolated and that all UI components and commands are unmapped upon disabling.
- **CU9: Manage the Editor**: Tests markdown formatting shortcuts across multi-line selections, verifies slash command (`/`) context parsing, and checks case-insensitive auto-complete string filtering.
- **CU10: Validate Paths and Inputs**: Validates security guards by blocking directory traversal vectors (such as `..` or external system mount paths) inside `validate_path_in_vault` and strips prohibited path characters.
- **CU11: Manage the Knowledge Graph**: Validates wiki-link syntax extraction (including aliased and escaped forms), updates backlink indices, and generates placeholder ghost nodes for broken target references.
- **CU12: Manage the Internationalisation Service**: Verifies that missing translation keys trigger console exceptions during development mode and enforces base translation requirements on plugin registrations.
- **CU13: Clipboard Operations**: Audits file-tree copy and paste commands, verifies runtime UI error notification triggers when the operating system clipboard is locked, and increments filename numerical suffixes on paste conflicts.
- **CU14: Export to PDF**: Validates hierarchical outline tree generation from headings, blocks exports on non-markdown items, and handles empty destination paths or native print driver failures.

---

## 4.2.2.6.3 Integration and System Testing

Integration and System testing verify the interaction between combined subsystems and evaluate the compiled application against end-to-end user workflows under production conditions.

### Application and Methodology

1. **Integration Testing**:
   - **Methodology**: Focuses on transactional paths where the React user interface, Tauri IPC commands, SQLite database schemas, Tantivy indexing threads, and Grafeo graph caches intersect. Tests are implemented via dedicated integration modules running against dynamic test vault structures.
   - **Inputs & Outputs**: Inputs consist of physical filesystem mutations, database transactions, and file modification bursts. Outputs consist of verified database states, search index coherence, and updated graph models.
   - **Execution Trigger**: Automated via the testing toolchain during local validation and pre-merge integration checks.

2. **System Testing (E2E)**:
   - **Methodology**: Verifies end-to-end user journeys by executing the complete frontend and interface flows. Since Tessellum is built as a web-first desktop application using Tauri, the E2E suite is implemented using Cypress as the primary orchestrator. To facilitate fast and robust automation without OS-level desktop window overhead, tests are run under E2E configuration (`cross-env VITE_E2E=1`) against the local React web server (running at `http://localhost:3000`). Native Tauri interfaces (such as filesystem access, file dialogs, and native commands) are mocked dynamically at the boundary via custom Cypress commands, simulating complete frontend-backend system integration.
   - **Inputs & Outputs**: Inputs are simulated user interactions (clicks, drag-and-drop actions, editor content entries, settings adjustments) and mock vault file structures loaded via `cy.openVault`. Outputs are verified UI updates, correct state changes in Zustand stores, valid Markdown rendering, and Cytoscape graph projections.
   - **Execution Trigger**: Triggered via `npm run e2e` automatically on every commit in the CI/CD pipeline and available interactively via `npm run e2e:open` for developer testing.

### Outcomes, Error Handling, and Regression Protection
- **Successful Outcome**: Cypress validates DOM assertions, component configurations, and mock IPC actions. The suite completes successfully, generating automated execution summaries.
- **Failing Outcome**: In case of assertion failure, Cypress automatically captures:
  1. A full high-resolution screenshot at the exact millisecond of failure.
  2. A detailed execution log including command history, stub outputs, and console warning states.
  3. Video recordings of the test execution (when configured) to assist visual debugging.
- A developer reviews the Cypress dashboard logs, reproduces the failure locally by opening the interactive test runner (`npm run e2e:open`), corrects the underlying defect, and re-runs the spec to guarantee regression clearance.

### Integration Use Case Testing Coverage
The integration suite verifies that independent subsystems function together correctly. Tests map directly to the 7 core transactional pipelines defined in the system architecture:

- **CU1: Manage Vault (Vault Watcher & Sync Pipeline)**: Verifies that file modifications, deletions, and external creation bursts are detected by the recursive watcher and synchronized sequentially with the database and search indices.
- **CU2: Manage Notes (Save & Metadata Pipeline)**: Validates the complete note persistence path: saving an active note writes to disk, updates SQLite records, extracts tags, updates outgoing links, and modifies the search index document.
- **CU3: Manage Trash (Trash-and-Restore Lifecycle)**: Coordinates file deletions, trash directory movements, and filename conflict index modifications across both the frontend store and the host filesystem.
- **CU4: Search Notes (Search Readiness & Full-Text Search)**: Verifies search pipeline stability during cold application boots, validating that search queries return accurate matches and exclude deleted paths.
- **CU5: Visualise the Knowledge Graph (Graph Projection Pipeline)**: Validates that the graph data layer processes note modifications accurately, merges duplicate link definitions, and updates backlink counts.
- **CU6: Manage Settings (Appearance & Spellcheck Propagation)**: Verifies that changes to user configurations are propagated immediately as DOM CSS variables and element attribute updates across all active view panels.
- **CU7: Export to PDF (Frontend-Backend Export Flow)**: Validates that active interface themes compile to valid print stylesheets, layout trees are parsed, and the resulting HTML payload is exported into a PDF file via the backend print engine.

### System Use Case Testing Coverage
System testing (E2E) validates the absolute interface coherence and overall operational flow of Tessellum under mock user environments. The automated Cypress test suite is organized into **3 specialized testing specs** which exercise all critical user journeys defined in the Analysis Phase:

- **E2E-001: Note Lifecycle Journey**:
  - **Scope**: Boots from a seeded vault, clicks buttons to create notes (handling automatic duplication increments like `Untitled` and `Untitled (1)`), opens specific notes in the editor, right-clicks folders to delete notes to the Trash, and validates full restoration and tree updates.
- **E2E-002: Search and Graph Discovery Journey**:
  - **Scope**: Seeds multiple test files containing tag metadata, executes queries in the search box, filters results dynamically, and validates cytoscape canvas interactive linking (drawing connections for wiki-links and mapping ghost nodes).
- **E2E-003: Settings Persistence Journey**:
  - **Scope**: Operates settings toggles, switches themes, adjusts editor configurations, and asserts that settings persist correctly across UI updates and reloads.

---

## 4.2.2.6.4 Usability Testing

Usability testing evaluates the application interface, workflow layout, and navigation structures with target users to ensure the system is intuitive and matches specified user productivity criteria.

### Usability Elements
#### Users (Participant Profiles)
Evaluations are conducted across three representative user groups to ensure comprehensive feedback:
- **Profile A (Casual User)**: Low-to-medium experience with advanced text applications; no prior familiarity with Markdown syntax or graph-based structures. Evaluates ease of learning and interface clarity.
- **Profile B (Technical User/Developer)**: High technical literacy; regular experience with Markdown text syntax. Evaluates shortcut consistency, text input performance, and structural reliability.
- **Profile C (Advanced Graph User)**: High familiarity with network-oriented knowledge management applications. Evaluates link generation speeds, slash commands, query execution, and interactive graph behaviors.

#### Location & Setup (Test Environment)
Tests are executed in a remote and unsupervised environment (entorno remoto y no supervisado). Participants install the application executable directly on their personal Windows 11 machines. This approach records feedback under realistic conditions regarding installation behavior, initialization performance, rendering speeds, and interface execution under normal home or office operational conditions.

#### Methodology (Step-by-Step Procedure)
The remote usability evaluation follows a three-step asynchronous methodology:
1. **Step 1: Onboarding and Profiling**: The participant receives the application installation package and the digital evaluation form. They fill out Section 1 (Participant Background) to record age, digital literacy, and tool experience.
2. **Step 2: Evaluation Survey Submission**: After using the system for some time, the participant completes Section 2 through Section 6 of the evaluation form, grading workflows via Likert-scale items, logging encountered errors, and providing qualitative remarks.

### Questionnaire Design
The usability questionnaire is structured to collect quantitative ratings for statistical aggregation and qualitative feedback to isolate specific user interface constraints. The questionnaire layout consists of six distinct sections covering participant profile, feature utilization, workflow efficiency, general system usability, open observations, and overall system recommendations.

### Evaluation Questionnaire
The usability questionnaire contains exactly 43 items structured into the following sections:

**Section 1: Participant Background (Perfil del Participante)**
1. What is your age range?
   `[ ] Under 18 | [ ] 18-24 | [ ] 25-34 | [ ] 35-44 | [ ] 45-54 | [ ] 55 or older`
2. How would you describe your general level of experience with digital applications?
   `[ ] Very low | [ ] Low | [ ] Medium | [ ] High | [ ] Very high`
3. How often do you use note-taking or knowledge management applications?
   `[ ] Never or almost never | [ ] Occasionally | [ ] Weekly | [ ] Several times per week | [ ] Daily`
4. Before using Tessellum, how familiar were you with Markdown?
   `[ ] Not familiar at all | [ ] Slightly | [ ] Moderately | [ ] Very familiar | [ ] Expert`
5. Before using Tessellum, how familiar were you with graph-based knowledge tools?
   `[ ] Not familiar at all | [ ] Slightly | [ ] Moderately | [ ] Very familiar | [ ] Expert`

**Section 2: Application Usage Overview (Visión General del Uso de la Aplicación)**
6. Approximately how long did you use Tessellum before answering this questionnaire?
   `[ ] Less than 15 minutes | [ ] 15-30 minutes | [ ] 30-60 minutes | [ ] 1-2 hours | [ ] More than 2 hours`
7. Which parts of the application did you try? (Select all that apply)
   `[ ] Note creation/editing | [ ] File/note navigation | [ ] Search | [ ] Graph view | [ ] Settings | [ ] Other`
8. Did you feel that you explored enough of the application to form an opinion about it?
   `[ ] Yes | [ ] Partially | [ ] No`
9. Did you encounter any technical problems while using the application?
   `[ ] No | [ ] Yes, minor problems | [ ] Yes, several problems | [ ] Yes, serious problems`
10. If you encountered technical problems, briefly describe them: `[Free text response]`

**Section 3: Workflow Evaluation (Evaluación de Flujos de Uso)**
*(Rating: 1 - Strongly Disagree to 5 - Strongly Agree)*
11. Creating a new note was easy. `[1 - 2 - 3 - 4 - 5]`
12. Editing note content was intuitive. `[1 - 2 - 3 - 4 - 5]`
13. Moving between notes, panels, or sections of the application was clear. `[1 - 2 - 3 - 4 - 5]`
14. The search functionality was easy to understand and use. `[1 - 2 - 3 - 4 - 5]`
15. The graph view was useful and understandable. `[1 - 2 - 3 - 4 - 5]`
16. The settings and customization options were easy to find and understand. `[1 - 2 - 3 - 4 - 5]`
17. The organization of the interface helped me know where to go next. `[1 - 2 - 3 - 4 - 5]`
18. I was able to complete the main tasks I wanted to do without major difficulty. `[1 - 2 - 3 - 4 - 5]`
19. The application gave enough feedback when I performed actions. `[1 - 2 - 3 - 4 - 5]`
20. When something was unclear, I was still able to figure out what to do. `[1 - 2 - 3 - 4 - 5]`

**Section 4: General Usability Assessment (Evaluación General de la Usabilidad)**
*(Rating: 1 - Strongly Disagree to 5 - Strongly Agree)*
21. The application was easy to learn. `[1 - 2 - 3 - 4 - 5]`
22. The interface was visually clear and understandable. `[1 - 2 - 3 - 4 - 5]`
23. The names, labels, and options used in the application were easy to understand. `[1 - 2 - 3 - 4 - 5]`
24. The application behaved in a consistent way across different sections. `[1 - 2 - 3 - 4 - 5]`
25. I felt confident while using the application. `[1 - 2 - 3 - 4 - 5]`
26. The application allowed me to work efficiently. `[1 - 2 - 3 - 4 - 5]`
27. It was easy to recover from mistakes or understand what went wrong. `[1 - 2 - 3 - 4 - 5]`
28. The application met my expectations in terms of usability. `[1 - 2 - 3 - 4 - 5]`
29. Overall, I am satisfied with the experience of using the application. `[1 - 2 - 3 - 4 - 5]`

**Section 5: Difficulties, Problems, and Improvement Opportunities**
*(All Free text responses)*
30. What parts of the application did you find most difficult to use? Why?
31. What parts of the application were hard to understand?
32. Were there any features, controls, or options that were confusing?
33. Did anything fail, behave unexpectedly, or not work as you expected?
34. What would you change first if you could improve the application?
35. What aspects of the application should be improved to make it easier to use?
36. Was there any moment when you felt lost or unsure about what to do next? Please explain.
37. What feature or aspect of the application did you find most useful or valuable?
38. What feature or aspect of the application did you find least useful?
39. Do you have any suggestions to make the application more intuitive or easier to understand for new users?

**Section 6: Final Assessment (Valoración Final)**
40. How would you rate your overall experience with Tessellum?
    `[ ] Very poor | [ ] Poor | [ ] Acceptable | [ ] Good | [ ] Excellent`
41. Would you use this application again?
    `[ ] Definitely not | [ ] Probably not | [ ] Maybe | [ ] Probably yes | [ ] Definitely yes`
42. Would you recommend this application to other users?
    `[ ] Definitely not | [ ] Probably not | [ ] Maybe | [ ] Probably yes | [ ] Definitely yes`
43. Any final comments? `[Free text response]`

### Usability Analysis Framework
The quantitative and qualitative data gathered from the evaluation questionnaire are aggregated and analyzed across four key usability metrics to establish baseline interface quality:
- **Learnability**: Measures the capability of a first-time user to navigate the interface and execute core functions. This metric is evaluated by aggregating scores from tasks 1 through 3 (opening a vault, creating a folder, and creating a note). The target success threshold is set at an average score of `≥ 4.3 / 5.0` on the evaluation matrices (Q21).
- **Efficiency**: Evaluates the operational throughput and user navigation speed during text editing, note-linking, and document export operations once the user is familiar with the system layout. It is monitored via user ratings regarding typing responsiveness, slash-command execution, and panel navigation (Q26). The target performance threshold is `≥ 4.0 / 5.0`.
- **Errors and Safety**: Evaluates the system's fault-tolerance and error-recovery behaviors under incorrect user inputs. It maps self-reported technical exceptions, interface layout anomalies, and user-perceived recovery paths (Q9, Q10, Q27). The system must resolve low-severity issues automatically (e.g., trimming trailing whitespaces in filenames) and isolate higher-severity execution faults (e.g., duplicate directory creation requests) via explicit user interface notifications.
- **User Satisfaction**: Measures the overall user evaluation regarding interface aesthetics, consistency, and functional utility. This metric aggregates overall experience scores, Likert-scale satisfaction inputs, and system recommendation likelihood indicators (Q29, Q40, Q42). The minimum target for the aggregated satisfaction index is `≥ 4.2 / 5.0`.

---

## 4.2.2.6.5 Performance Testing

Tessellum is architected as a local-first application. Performance testing defines specific, measurable constraints regarding resource utilization, operation latencies, and data throughput to verify system responsiveness under varying workloads.

### Resource Consumption Constraints
The application executable must operate within the following host resource allocation boundaries:
- **Active Memory (RAM) Footprint**:
  - Standard operational state (active markdown editor execution, file tree navigation, initialized search index layers): **≤ 150 MB RAM**.
  - Complex graphics rendering state (active multi-node 2D/3D knowledge graph canvas view manipulation): **≤ 250 MB RAM**.
- **Processor (CPU) Utilization**:
  - Idle state (active background filesystem monitoring, no active user text inputs): **≤ 1.0% CPU capacity**.
  - Active execution state (real-time Markdown syntax tokenization and rendering): **≤ 5.0% CPU capacity**.
  - System synchronization state (background full-text search indexing or filesystem reconciliation bursts): **≤ 15.0% CPU capacity**. Execution must be restricted to background worker threads to prevent user interface thread blockage.
- **Disk Storage Footprint**: System overhead must be restricted exclusively to raw Markdown text files (`.md`) and the vacuumed, structurally optimized relational metadata cache file (`.sqlite`).

### Operation Latency Criteria
The following matrix defines the maximum target execution latencies allowed for core software operations:

| Core Software Operation | Maximum Target Latency | Measurement Seam / Verification Tool |
|---|---|---|
| Cold Startup Timeline | ≤ 1000 ms | Process initialization timestamp to core DOM mount event |
| Vault Filesystem Synchronization | ≤ 300 ms (100 notes baseline) | Tauri core performance tracing log (`duration_ms`) |
| Note Save & Auto-save Transactions | ≤ 10 ms | SQLite transaction commit execution timestamp |
| Full-Text Search Execution | ≤ 50 ms | Tantivy query engine lookup resolution timer |
| Graph Node Projection | ≤ 1000 ms | Grafeo query execution to frontend store resolution |
| Text Input Interaction Latency | ≤ 8 ms (Single frame target) | Performance panel frame rate monitor (60 FPS baseline) |
| PDF Layout Document Export | ≤ 1000 ms | Print layout generation to filesystem write completion |

### Profiling Strategy and Diagnostics
System bottlenecks and memory allocations are monitored using three distinct diagnostic approaches:
1. **Frontend Interface Profiling**: The integrated performance panel inside the rendering engine tracks CPU execution flame charts, JavaScript heap lifecycle transitions, and DOM layout repaint timings.
2. **Backend Application Profiling**: Automated development profiling uses native compilation profiling utilities, including `cargo flamegraph` and memory tracking instrumentation, to isolate execution hotspots, database transaction latency issues within the query mapping layers, and indexing bottlenecks in the search engine core.
3. **Operating System Auditing**: Native operating system performance tracking utilities monitor the private working set memory allocation profiles of the compiled executable over continuous evaluation periods up to 24 hours to verify the complete absence of progressive memory retention issues.

### Load and Stress Testing

**Database and Index Scalability (High Volume Processing)**
To verify database access speed and indexing stability under scaled data configurations, the system is evaluated against specific data scale requirements:
- **Test Environment Seeding**: A synthetic testing vault containing 10,000 distinct Markdown files is generated, populated with metadata attributes, varied text contents, tag parameters, and complex cross-reference inline wiki-links.
- **System Acceptance Metrics**:
  - Initial cold indexing of the entire asset collection must complete in **≤ 5 seconds**.
  - Incremental filesystem change tracking updates (triggered by a single file modification) must process in **≤ 200 ms**.
  - Multi-token search lookups across the complete document collection must return results in **≤ 100 ms**.

**Graph Structural Density Stress (Network Scale Ingestion)**
To evaluate the visual display canvas stability under high relational density configurations, a complex relationship scenario is generated:
- **Test Environment Stress Seeding**: A highly dense testing workspace layout is instantiated containing 5,000 active nodes interconnected via 20,000 distinct structural wiki-link relationships.
- **System Acceptance Metrics**:
  - The graph abstraction engine must extract and project the relational matrix structure in **≤ 500 ms**.
  - The user interface graph canvas must render and process layout scaling, nodes dragging, panning, and hovering interactions consistently at **≥ 60 Frames Per Second (FPS)**.

### Resource Deprivation and Crash Resistance
The application must guarantee absolute local data integrity under host failure simulations:
- **Disk Transaction Interruptions**: Physical storage boundaries are simulated using full disk allocations or external file access lockouts during active modifications. The application must block data truncation, issue an error notification dialog to the user, and execute an atomic rollback of any open database transactions.
- **Low Available Memory Operations**: System memory allocations are restricted to minimum operating limits. The application must automatically disable layout animations, clear unused search query memory pools, and prioritize text editor input processing pathways.

---

## 4.2.2.6.6 Error Detection and Correction Mechanisms

Tessellum implements a structured error detection, classification, and mitigation framework across the software lifecycle to enforce stability criteria.

### Testing Techniques Applied
Verification procedures apply three testing methodologies:
- **Equivalence Class Partitioning (ECP)**: Inputs are divided into valid and invalid operational domains, validating system behaviors against parameters such as supported vs. unsupported system locales, markdown vs. binary file formats, and directory references inside vs. outside the designated vault space.
- **Boundary Value Analysis (BVA)**: Verification explicitly tests the limits of system constraints, including editor font sizing ranges (clamped between 12 and 24 pixels), the exact 30-day trash purging threshold, maximum search history capacities, and debounce window edges.
- **Error Guessing**: Based on architecture design characteristics, specific test scenarios target high-probability fault points including localized database structure corruption, host clipboard access failures, malformed naming inputs, and uninitialized component sub-layers.

### Coverage Criteria
The system design mandates adherence to the following minimum coverage thresholds prior to code base integration:

| Software Architecture Layer | Statement Coverage | Branch Coverage |
|---|---|---|
| Frontend pure state modules and text utility layers | ≥ 90% | N/A (Not Applicable) |
| Frontend modal components and custom application hooks | N/A (Not Applicable) | ≥ 85% |
| Backend data management (`trash.rs`, `validate.rs`, search services) | ≥ 90% | N/A (Not Applicable) |
| Backend controller execution paths (delete, restore, search, graph) | N/A (Not Applicable) | 100% (All operational paths executed) |
| System Level Integration (End-to-End Testing) | N/A (Not Applicable) | 100% (All critical target user journeys verified) |

### Continuous Integration Gates
Automated test verification execution runs sequentially within the continuous integration infrastructure, using the following pipeline order:

1. `cargo test --manifest-path src-tauri/Cargo.toml`
   *(Executes backend isolated functional tests and integration suite operations)*
2. `npx vitest run --coverage`
   *(Executes frontend state store transitions and user interface component layout checks)*
3. `npm run e2e`
   *(Executes end-to-end multi-process system user journeys via the tauri-driver runtime wrapper)*

Any single verification failure within these execution stages automatically terminates the integration runner, blocking source code incorporation.

### Test Isolation Contract
To guarantee execution reproducibility and eliminate cross-test side effects, verification runs must adhere to strict state isolation conditions:
- **Frontend Isolation**: Each test case clears all active state records, purges active browser data stores (`localStorage`, `sessionStorage`), and unregisters all active system function stubs.
- **Backend Isolation**: Each test execution maps to a unique, isolated temporary workspace path and instantiates a discrete database file context. No file modifications or database updates are shared across test instances.
- **System Isolation**: End-to-end automation execution models refresh the entire testing target vault workspace layout using a verified reference data fixture before executing any automation sequences.

### 5.5 Suspension and Resumption Criteria
Automated testing operations are suspended upon encountering any of the following system constraints:
- Failure of the local development asset compiler or runtime initialization process.
- Inability to construct clean filesystem directory testing fixtures or database storage paths.
- Version discrepancies or linking anomalies between the host browser framework components and automation application driver binaries.

Testing procedures resume only when system environment configurations match baseline specifications, testing fixture generation processes finish without warnings, or damaged system dependencies are replaced by isolated software stubs.

### Defect Tracking
Every failure recorded within the testing automation suites automatically generates a tracking record containing the unique validation script descriptor. Defects trace back to their originating functional use case parameters and target scenario matrices. Resolution verification requires a complete passing run of the specific verification test case path that triggered the original tracking entry.
