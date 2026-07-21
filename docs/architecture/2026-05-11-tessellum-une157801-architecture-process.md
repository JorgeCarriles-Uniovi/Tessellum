# Tessellum Architecture Chapter Writing Process

## Purpose

This note records how the architecture chapter was derived from the current implementation of Tessellum. It exists because the repository instructions request a simple step-by-step explanation when documenting complex functionality.

## Process Followed

1. The repository structure was inspected to identify the frontend, backend, and documentation layout.
2. The existing architecture narrative in [`README.md`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\README.md) was reviewed to preserve project terminology.
3. The Tauri application bootstrap in [`src-tauri/src/lib.rs`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src-tauri\src\lib.rs) was read to identify the registered commands, initialized services, and shared runtime state.
4. The foundational runtime flow was traced through [`src/App.tsx`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src\App.tsx), [`src-tauri/src/commands/watcher.rs`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src-tauri\src\commands\watcher.rs), [`src-tauri/src/commands/indexer.rs`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src-tauri\src\commands\indexer.rs), and [`src-tauri/src/indexer.rs`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src-tauri\src\indexer.rs).
5. The React-Rust IPC pattern was traced through frontend `invoke(...)` usage and backend asynchronous handlers, especially the search and note-write paths.
6. The knowledge-management layer was derived from the editor-related frontend modules and the backend note indexing logic in [`src-tauri/src/commands/notes.rs`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src-tauri\src\commands\notes.rs).
7. The relational persistence model was reconstructed from [`src-tauri/src/db.rs`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src-tauri\src\db.rs).
8. The discovery layer was traced through [`src/components/Search/SearchPanel.tsx`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src\components\Search\SearchPanel.tsx), [`src/stores/searchStore.ts`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src\stores\searchStore.ts), [`src/components/GraphView/GraphView.tsx`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src\components\GraphView\GraphView.tsx), [`src-tauri/src/commands/graph.rs`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src-tauri\src\commands\graph.rs), and [`src-tauri/src/grafeo_projection.rs`](C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src-tauri\src\grafeo_projection.rs).
9. The final chapter was organized around the three epics provided by the project author, while the three requested deep flows were embedded in the epic where they are implemented.
10. The chapter was written in English and kept strictly descriptive of the current implementation, without adding prospective recommendations.

## Result

The resulting documentation is a thesis-style chapter that applies UNE 157801 architectural reasoning to the current Tessellum implementation without forcing the full formal document set of the standard.
