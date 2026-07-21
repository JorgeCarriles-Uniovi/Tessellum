# Problems Encountered During Development

## Tessellum: Local-First Knowledge Management & Visualization Platform
**Universidad de Oviedo | Escuela de Ingeniería Informática | Trabajo Fin de Grado**
- **Author**: Jorge Carriles Ruiz
- **Standard Reference**: Aligned with UNE 157801:2014 ("Criterios generales para la elaboración de proyectos de sistemas de información")

---

This section documents the most relevant technical problems encountered during the development process of Tessellum, detailing the nature of each issue, the identified root cause, and the applied solution.

---

## Problem 1: Cross-Platform Incompatibility of the Kùzu Graph Database

### Problem Description
The initial implementation of Tessellum's graph subsystem used **Kùzu** as the embedded graph database engine. Kùzu was selected for its native Cypher query support and its performance in in-memory graph traversal operations. However, during the continuous integration phase on GitHub Actions, the Rust crate `kuzu` failed to compile correctly on the **Ubuntu (Linux)** and **macOS** runners, producing linking errors with the native C++ libraries that Kùzu required as a system dependency. While compilation succeeded on Windows, the CI pipelines for the other two platforms failed systematically, blocking the generation of cross-platform artifacts.

### Root Cause
Kùzu internally depends on a native C++ library that requires specific compilation toolchains (CMake, C++ compilers with C++20 support) and system libraries that differ significantly between platforms. The GitHub CI runners do not include these dependencies by default, and the versions of the `kuzu` crate available on crates.io at the time of development did not provide precompiled binaries for all target platforms (Windows x64, macOS arm64/x64, Ubuntu x64).

### Applied Solution
Kùzu was replaced with **Grafeo** (`grafeo = "0.5.39"`), an embedded graph library written entirely in Rust. Being a native Rust crate with no external C/C++ system dependencies, Grafeo compiles identically on all three target platforms without requiring additional toolchains. The `grafeo_projection.rs` module was reimplemented using the Grafeo API, maintaining Cypher-style (GQL) query functionality through the `GrafeoDB`, `Config`, and `Session` primitives provided by the library. This migration allowed the CI pipeline (`tauri-ci.yml`) to successfully complete builds on Windows, macOS, and Ubuntu consistently.

---

## Problem 2: Inability to Execute E2E Tests on the Native Tauri Application

### Problem Description
Tessellum is a desktop application built with Tauri, where the React frontend communicates with the Rust backend through an IPC bridge (`@tauri-apps/api/core`). When attempting to implement end-to-end (E2E) tests with **Cypress**, it was discovered that Cypress operates exclusively within a conventional web browser and cannot interact with the native Tauri environment. IPC calls to functions such as `invoke("list_files")`, `invoke("write_file")`, or `invoke("get_graph_data")` failed immediately, since the Tauri process was not available within the test browser context. This prevented the validation of any functional flow that depended on the backend: note creation, search, graph visualization, trash management, etc.

### Root Cause
Tauri executes the web interface inside a native system WebView (WebView2 on Windows, WebKitGTK on Linux, WKWebView on macOS), injecting a proprietary IPC bridge at `window.__TAURI_INTERNALS__`. Cypress, however, launches an independent Chromium browser that lacks this IPC bridge, causing all invocations to the Rust backend to return connection errors or remain unresolved.

### Applied Solution
A **complete backend mock layer** was designed to substitute the Tauri APIs during E2E test execution. The solution consists of two complementary mechanisms:

1. **Conditional Vite Aliases**: In `vite.config.ts`, when the environment variable `VITE_E2E=1` is active, imports from Tauri modules (`@tauri-apps/api/core`, `@tauri-apps/plugin-fs`, `@tauri-apps/plugin-dialog`, etc.) are redirected to local mock implementations located in `src/e2e/tauri/`.

2. **In-Memory Mock Backend**: The file `src/e2e/mockBackend.ts` implements a complete simulated backend that emulates the Rust backend operations in pure JavaScript: a virtual file system with `MockVault`, directory tree construction, simulated full-text search, graph data generation from parsed wiki-links, trash management, and file change event emission. Each IPC invocation is intercepted in the `invokeMock()` function and resolved against this in-memory state.

---

## Problem 3: File Path Normalization Inconsistencies Across Platforms

### Problem Description
During the testing of features involving bidirectional links (wiki-links), backlinks, and knowledge graph visualization, severe inconsistencies in path resolution were detected. Links that worked correctly on Windows (with `\` separators) did not resolve in Linux and macOS builds (which use `/`), and vice versa. This caused backlinks to appear as broken links, graph nodes to be duplicated (one with `/` and another with `\`), and SQLite queries searching for links by `target_path` to return no results.

### Root Cause
Windows uses the backslash (`\`) as the directory separator, while Linux and macOS use the forward slash (`/`). The paths stored in the SQLite database reflected the separator of the operating system where the application was running. When backlink or link queries compared paths, a path stored as `Vault\Notes\Idea.md` did not match the search for `Vault/Notes/Idea.md`, producing empty results and duplicate ghost nodes in the graph.

### Applied Solution
A centralized normalization function `normalize_path()` was implemented in the `src-tauri/src/utils/` module that canonically converts all backslashes to forward slashes (`/`) before any storage or comparison operation. Additionally, the critical SQL queries in `db.rs` involving link searches (`get_outgoing_links`, `get_backlinks`) were modified to perform a dual comparison: they search for both the normalized path and the backslash variant (`source_path.replace('/', '\\')`) to guarantee compatibility with legacy data.

---

## Problem 4: Content Security Policy Conflict with Local Vault Resource Loading

### Problem Description
Tessellum allows users to embed images, videos, and PDF documents within their Markdown notes (e.g., `![photo](image.png)`). After configuring the CSP (Content Security Policy) directives in `tauri.conf.json`, images and other multimedia resources from the user's vault stopped loading in the editor and preview view. The embedded browser (WebView2) blocked requests to local files with errors of the type `Refused to load the image because it violates the Content Security Policy directive`, preventing the rendering of any local multimedia content.

### Root Cause
Tauri serves the user's local files through a custom protocol (`asset://` in native environments, which translates to `https://asset.localhost` in the WebView). The initial CSP only allowed `'self'` origins in the `img-src` and `media-src` directives, rejecting any resource originating from the `asset://` protocol. Furthermore, there were differences in how different WebViews interpret the asset protocol origin: some resolve it as `http://asset.localhost` and others as `https://asset.localhost`.

### Applied Solution
A detailed adjustment of the CSP policy was performed in `tauri.conf.json`, extending the `img-src`, `media-src`, and `frame-src` directives to explicitly include all possible origins of the asset protocol:

```
img-src 'self' data: blob: asset: http://asset.localhost https://asset.localhost https:;
media-src 'self' data: blob: asset: https://asset.localhost http://asset.localhost https:;
frame-src 'self' asset: https://asset.localhost http://asset.localhost;
```

This configuration allows the loading of local resources from the user's vault through the Tauri asset protocol, while maintaining the security restrictions that prevent the execution of external scripts (`script-src 'self'`) and the loading of arbitrary objects (`object-src 'none'`).

---

## Problem 5: Search Index Unavailability Immediately After Application Startup

### Problem Description
Users who opened a large vault (with hundreds of notes) and attempted to perform a search immediately after application startup received empty or incomplete results. The search interface provided no indication that the index was still being built, giving the impression that the search functionality was broken. In vaults of considerable size, the initial Tantivy indexing could take several seconds, during which the frontend search component sent queries to an empty or partially built index.

### Root Cause
The Tantivy indexing process runs asynchronously in the Rust backend. During the startup phase, the `IndexWriter` scans all vault files, parses their Markdown content, extracts tags and links, and writes the documents to the index. While this process is underway, the `IndexReader` may return partial or empty results if a `reload()` has not been performed after the last `commit()`. The frontend had no knowledge of the index's readiness state and sent search queries without verifying whether the backend was prepared.

### Applied Solution
A **search index readiness system** was implemented with the following components:

1. **Backend readiness state**: The Tauri commands `get_search_readiness`, `ensure_search_ready`, and `reset_search_readiness_attempts` were created, exposing a status payload with the fields `status` (idle, warming, ready, failed), `attempt_count`, `max_attempts`, `retry_delay_ms`, and `reopen_required`.

2. **Frontend polling**: The search store (`searchStore.ts`) periodically queries the readiness state before sending search queries. While the status is `warming`, the interface displays a loading indicator informing the user that the index is being built.

3. **Retries with backoff**: If the first verification attempt fails, the system retries with a configurable delay strategy up to a maximum number of attempts, allowing the indexing to complete even in large vaults.

---

## Problem 6: Native Title Bar Incompatible with the Application's Visual Design

### Problem Description
During the user interface design phase, it was determined that the operating system's native title bar (with the standard minimize, maximize, and close buttons) broke the visual coherence of Tessellum's premium design. The Windows title bar applied the colors and typography of the user's operating system theme, creating a discordant contrast with the application's dark and minimalist interface. Furthermore, the native title bar prevented the implementation of custom functionalities such as displaying the active vault name, integrated navigation buttons, and a unified edge-to-edge design.

### Root Cause
By default, Tauri generates windows with the operating system's native decorations. These decorations (title bar, borders, shadows) are controlled by the system's window compositor (DWM on Windows, Mutter/Kwin on Linux, WindowServer on macOS) and cannot be visually customized from the web frontend. Any visual modification requires the complete deactivation of native decorations and the reimplementation of all window management functionality in the frontend itself.

### Applied Solution
Native decorations were deactivated by setting `"decorations": false` in `tauri.conf.json`, and a custom `TitleBar` component was implemented in the React frontend that replicates all the functionality of the native title bar:

- **Drag to move the window**: Through the `startDragging()` Tauri API invoked on the custom title bar region.
- **Minimize, maximize, and close buttons**: Implemented as React components that invoke the Tauri window API functions (`appWindow.minimize()`, `appWindow.toggleMaximize()`, `appWindow.close()`).
- **Double-click to maximize/restore**: An event managed in the frontend to toggle the window state.
- **Visual integration**: The custom title bar adopts the colors, typography, and opacity of the active Tessellum theme, achieving a continuous and unified design with the rest of the interface.

Additionally, the `tauri-plugin-window-state` plugin was integrated to persist the window's position, size, and maximization state between sessions — functionality that the native decorations provided automatically and which had to be reimplemented after their deactivation.
