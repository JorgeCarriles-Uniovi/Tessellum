# Markdown PDF Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a file-tree context-menu action that exports markdown notes to PDF with the active theme, fixed export typography, and heading bookmarks derived from the shared outline parser.

**Architecture:** The frontend owns export orchestration, themed HTML generation, and heading page-number measurement. The Tauri backend owns PDF creation from HTML and bookmark injection into the generated file. The sidebar remains a thin trigger layer that delegates to a focused export service.

**Tech Stack:** React, TypeScript, Vitest, Tauri 2, Rust, WebView2 on Windows, PDF post-processing in Rust.

---

### Task 1: Plan The Frontend Export Boundaries

**Files:**
- Create: `src/features/pdfExport/types.ts`
- Create: `src/features/pdfExport/pdfExportDomain.ts`
- Create: `src/features/pdfExport/pdfExportDomain.test.ts`

- [ ] **Step 1: Write the failing test**

Cover:
- markdown-only menu eligibility
- default PDF filename generation
- outline-to-bookmark page mapping from fixed page geometry
- fixed export typography constants staying independent from editor zoom

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd /c npm test -- src/features/pdfExport/pdfExportDomain.test.ts`
Expected: FAIL because the domain module does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Add pure helpers for:
- `canExportNoteToPdf`
- `buildPdfFileName`
- `buildPdfOutlineEntries`
- export layout constants

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd /c npm test -- src/features/pdfExport/pdfExportDomain.test.ts`
Expected: PASS

### Task 2: Build The Frontend Export Renderer And Command Bridge

**Files:**
- Create: `src/features/pdfExport/markdownPdfRenderer.tsx`
- Create: `src/features/pdfExport/markdownPdfExport.ts`
- Create: `src/features/pdfExport/useMarkdownPdfExport.ts`
- Modify: `src/test/tauriMocks.ts`
- Test: `src/features/pdfExport/markdownPdfExport.test.tsx`

- [ ] **Step 1: Write the failing test**

Cover:
- save dialog opens with the expected default filename
- cancel exits without invoking the backend
- successful export invokes the new backend command with themed HTML and outline entries
- failures surface as error notifications

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd /c npm test -- src/features/pdfExport/markdownPdfExport.test.tsx`
Expected: FAIL because the export orchestrator and dialog mock support are incomplete.

- [ ] **Step 3: Write minimal implementation**

Implement:
- an off-screen renderer that mounts a hidden export container
- themed HTML generation with fixed export sizing
- outline measurement by heading position
- save dialog call and backend invoke bridge

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd /c npm test -- src/features/pdfExport/markdownPdfExport.test.tsx`
Expected: PASS

### Task 3: Wire The Sidebar Context Menu To The Export Service

**Files:**
- Modify: `src/components/Sidebar/sidebarContextMenuItems.ts`
- Modify: `src/components/Sidebar/SidebarContextMenu.tsx`
- Modify: `src/components/Sidebar/Sidebar.tsx`
- Modify: `src/components/Sidebar/sidebarContextMenuItems.test.ts`
- Modify: `src/components/FileTree/hooks/fileTreeLogic.test.tsx`

- [ ] **Step 1: Write the failing test**

Add assertions that:
- markdown notes include `Export to PDF`
- directories and non-markdown files do not
- the file-tree context flow delegates to the export callback when available

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd /c npm test -- src/components/Sidebar/sidebarContextMenuItems.test.ts src/components/FileTree/hooks/fileTreeLogic.test.tsx`
Expected: FAIL because the new action is not yet exposed or wired.

- [ ] **Step 3: Write minimal implementation**

Thread an optional `onExportToPdf` callback through the sidebar context-menu pipeline and keep the sidebar component itself thin by delegating the actual work to `useMarkdownPdfExport`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd /c npm test -- src/components/Sidebar/sidebarContextMenuItems.test.ts src/components/FileTree/hooks/fileTreeLogic.test.tsx`
Expected: PASS

### Task 4: Add The Backend PDF Export Command

**Files:**
- Create: `src-tauri/src/commands/pdf_export.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/Cargo.toml`
- Test: `src-tauri/src/commands/pdf_export.rs`

- [ ] **Step 1: Write the failing test**

Cover:
- request validation rejects empty destination paths
- bookmark structures are built from ordered outline entries
- unsupported platforms return a clear error

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test pdf_export`
Expected: FAIL because the command module and helpers do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement:
- request/outline DTOs
- request validation helpers
- Windows PDF generation using a dedicated hidden webview path
- PDF bookmark injection from the measured outline entries
- command registration

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo test pdf_export`
Expected: PASS

### Task 5: Verify The End-To-End Feature Surface

**Files:**
- Modify as needed based on verification output only

- [ ] **Step 1: Run the targeted frontend suite**

Run: `cmd /c npm test -- src/features/pdfExport/pdfExportDomain.test.ts src/features/pdfExport/markdownPdfExport.test.tsx src/components/Sidebar/sidebarContextMenuItems.test.ts src/components/FileTree/hooks/fileTreeLogic.test.tsx`
Expected: PASS

- [ ] **Step 2: Run the targeted backend suite**

Run: `cargo test pdf_export`
Expected: PASS

- [ ] **Step 3: Add the implementation note required by project instructions**

Create: `docs/implementation/2026-05-14-markdown-pdf-export.md`

Document:
- export menu trigger flow
- off-screen HTML rendering
- heading measurement
- backend PDF generation
- bookmark injection

