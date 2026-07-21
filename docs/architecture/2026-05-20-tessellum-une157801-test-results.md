# Section 9: Test Execution and Results

## Tessellum: Local-First Knowledge Management and Visualization Platform
**Universidad de Oviedo | Escuela de Ingenieria Informatica | Trabajo Fin de Grado**  
**Author**: Jorge Carriles Ruiz  
**Execution date of the results reported in this document**: May 20, 2026  
**Reference standard**: UNE 157801:2014

---

## 9.1 Unit Tests

This section describes the execution of the unit tests previously designed in the testing plan, the results obtained, and the corrective actions adopted when defects or execution problems were identified.

### 9.1.1 Test execution

The unit test campaign was executed on May 20, 2026 with the following commands:

```powershell
cmd /c npm test
cargo test --lib
```

### 9.1.2 Results obtained

The frontend unit test suite, executed with Vitest, finished successfully:

- Test files executed: 46
- Tests executed: 192
- Result: 192 passed, 0 failed

The backend Rust unit test suite, executed with Cargo, also finished successfully:

- Tests executed: 85
- Result: 85 passed, 0 failed

Therefore, the automated unit test campaign executed for this report completed with **277 passed tests and 0 failed tests**.

### 9.1.3 Functional interpretation of the results

The current unit suites provide direct verification of the critical isolated behaviors described in the testing plan:

- Input validation, filename sanitization, frontmatter parsing, and tag extraction behave correctly in the backend utility layer.
- Database functions for links, tags, search metadata, and note projections behave correctly under isolated fixtures.
- Graph-related parsing and projection helpers correctly process wiki-links, broken links, and placeholder nodes.
- Frontend stores, hooks, editor helpers, plugin runtime logic, and PDF export orchestration pass their isolated verification cases.

These results support the conclusion that the low-level logical components of Tessellum are currently stable under the scenarios covered by the implemented unit suites.

### 9.1.4 Defects found and corrective actions

During the current execution reported in this document, **no unit test failures were detected**.

However, the current unit test architecture is itself the result of earlier corrective work already incorporated into the codebase. The main actions visible in the tested code and documentation are:

- reinforcement of path validation and sanitization rules for filesystem safety;
- correction of wiki-link parsing edge cases, especially escaped or invalid patterns;
- stabilization of settings persistence and store reset behavior;
- consolidation of deterministic test fixtures for Rust temporary vaults and frontend mocked Tauri boundaries.

Consequently, no additional corrective intervention was necessary after the May 20, 2026 unit execution.

---

## 9.2 Integration and System Tests

This section reports the execution of the integration and system tests designed in the testing plan. In accordance with the defined strategy, two different evidence sources were considered:

1. backend integration-style tests executed with Cargo using temporary vaults and isolated databases;
2. end-to-end system tests specified in Cypress.

### 9.2.1 Backend integration-style verification

The Rust verification command:

```powershell
cargo test --lib
```

included integration-style tests embedded in the backend modules. These tests validated, among others, the following transactional flows:

- full vault synchronization and deletion reconciliation;
- graph data construction including orphan and broken nodes;
- vault rename behavior for markdown and media files;
- clipboard and asset command paths;
- search readiness and indexer command orchestration.

All these backend integration-style tests passed during the execution reported in this document.

### 9.2.2 System test execution status

The end-to-end system campaign was invoked with:

```powershell
cmd /c npm run e2e
```

The campaign did **not** complete successfully in the execution environment used on May 20, 2026. The failure was caused by environmental and tooling constraints, not by a functional assertion failure inside a Cypress spec.

The observed blocking issues were:

- Vite could not load the local E2E configuration because the execution environment raised an access-denied error while resolving directories.
- Cypress could not validate its local binary because of an `EPERM` access error over `Cypress.exe`.
- The host environment also lacked `wmic.exe`, which caused an additional Cypress process management failure.

As a result, the E2E suite was **blocked before functional verification could be completed**.

### 9.2.3 Scenario table

The following table records the current status of the designed integration and system scenarios.

#### Scenario E1.1: Note Lifecycle Journey
**Test case: CP1.1.1**

| Input | Expected Result |
|---|---|
| Open a seeded vault and create a new note | The system creates the note, adds it to the file tree, and opens it in the editor |
| Obtained Result | Not executed in the current E2E run because the Cypress environment failed before launching the functional checks |

**Test case: CP1.1.2**

| Input | Expected Result |
|---|---|
| Create a second note with the same base name | The system creates a new item using an incremented suffix such as `Untitled (1)` |
| Obtained Result | Not executed in the current E2E run because the Cypress environment failed before launching the functional checks |

**Test case: CP1.1.3**

| Input | Expected Result |
|---|---|
| Move a note to Trash and restore it | The note disappears from the active tree and can later be restored correctly |
| Obtained Result | Not executed in the current E2E run because the Cypress environment failed before launching the functional checks |

#### Scenario E1.2: Search and Graph Discovery Journey
**Test case: CP1.2.1**

| Input | Expected Result |
|---|---|
| Search for a note using a text and tag query such as `graph #feature` | The search panel returns the expected note |
| Obtained Result | Not executed in the current E2E run because the Cypress environment failed before launching the functional checks |

**Test case: CP1.2.2**

| Input | Expected Result |
|---|---|
| Open Graph View after selecting a linked note | The graph view loads and displays the graph canvas |
| Obtained Result | Not executed in the current E2E run because the Cypress environment failed before launching the functional checks |

#### Scenario E1.3: Settings Persistence Journey
**Test case: CP1.3.1**

| Input | Expected Result |
|---|---|
| Disable spell check and reload the application | The setting remains persisted after reload |
| Obtained Result | Not executed in the current E2E run because the Cypress environment failed before launching the functional checks |

### 9.2.4 Actions carried out after the detected problems

The following actions were carried out after identifying the E2E execution blockage:

- the failing command output was captured and preserved in the local execution log;
- the failure was classified as an environment/tooling problem rather than as an application functional defect;
- the current report distinguishes clearly between passing backend integration evidence and blocked Cypress system evidence, avoiding unsupported pass claims.

The next corrective step required outside this document is to repair the Windows E2E execution environment so that the Cypress campaign can be repeated and the obtained-result cells can be completed with empirical outcomes.

---

## 9.3 Usability Tests

This section should present the results obtained from the questionnaire and remote procedure defined in the testing plan.

### 9.3.1 Current evidence status

At the time of writing this document, the repository contains:

- the usability test procedure definition;
- the full 43-question bilingual questionnaire;
- the evaluation criteria for learnability, efficiency, errors and safety, and user satisfaction.

However, **no completed participant response dataset is stored in the project repository or in the execution evidence available for this report**. Therefore, no statistically valid usability result can be claimed in this section without introducing unsupported information.

### 9.3.2 Result statement

The usability campaign is therefore classified as:

- **Questionnaire design**: completed
- **Evaluation procedure**: completed
- **Empirical participant execution evidence available for this report**: not available
- **Aggregated usability metrics**: not reportable at this stage

### 9.3.3 Consequence for the project documentation

In UNE 157801 terms, the correct technical statement is that the usability evaluation method has been designed and prepared, but the result phase remains pending until completed questionnaires are collected and consolidated.

When participant responses become available, this section should be updated with:

- number of participants;
- distribution by user profile;
- aggregated Likert-scale results for the relevant questions;
- summary of qualitative comments;
- resulting improvement actions.

---

## 9.4 Performance Tests

This section explains the execution, results, and derived changes associated with the performance tests specified in the testing plan.

### 9.4.1 Performance suite execution

The performance validation was implemented as a dedicated Rust integration target in:

`src-tauri/tests/performance.rs`

The following commands were executed:

```powershell
cargo test --test performance
cargo test --release --test performance -- --ignored
```

The first command verified that the performance suite is intentionally excluded from routine debug runs. The second command executed the release-mode performance assertions.

### 9.4.2 Performance test results

#### Test P1: High-volume indexing of 10,000 markdown files

- **Target defined in the plan**: complete initial indexing in `<= 5 seconds`
- **Observed result on May 20, 2026**: `8.0303214 seconds`
- **Status**: **Failed**

Interpretation:

- the system is able to complete the indexing process successfully;
- however, it does not yet satisfy the strict acceptance threshold defined in the testing plan for this host.

#### Test P2: Graph structural density with 5,000 nodes and 20,000 edges

- **Target defined in the plan**: complete graph projection in `<= 500 ms`
- **Observed result on May 20, 2026**: test passed in release mode
- **Status**: **Passed**

The execution confirms that the graph projection scenario currently satisfies the acceptance criterion implemented in the automated suite.

#### Test P3: SQLite concurrency under WAL mode

- **Target defined in the plan**: complete concurrent read/write activity without `SQLITE_BUSY` errors
- **Observed result on May 20, 2026**: test passed
- **Status**: **Passed**

The result confirms that the WAL configuration and current contention handling are sufficient for the concurrency scenario implemented in the automated performance suite.

### 9.4.3 Changes derived from the performance campaign

The execution of the 10,000-file indexing test exposed a genuine throughput bottleneck. As a consequence, the following corrective actions were implemented:

- creation of a dedicated performance integration suite so that performance constraints are executable and repeatable;
- export of a minimal public test surface for `Database`, `VaultIndexer`, `SearchIndex`, and `TestVault`;
- reduction of indexing overhead by reusing the first filesystem traversal instead of rebuilding the markdown index through a second walk;
- introduction of batch-oriented database update paths for note metadata, links, tags, and search records;
- introduction of a dedicated initial-sync bulk insert path for high-volume seeding scenarios;
- addition of implementation documentation describing the performance test architecture and the optimization work carried out.

These changes reduced the indexing time substantially compared with the previous implementation, but they did not yet bring the measured result below the `5 second` acceptance threshold.

### 9.4.4 Final assessment of the performance campaign

The current performance status is therefore:

- indexing throughput target for 10,000 files: **not yet compliant**;
- graph density projection target: **compliant**;
- SQLite concurrency target: **compliant**.

The overall conclusion is that the performance verification mechanism is now implemented and operational, and it already provides objective evidence about the remaining optimization work required in the indexing subsystem.
