## Graph View / Mosaic Redesign

### BUG-U3: Graph view — media nodes show wrong label and double-click creates a `.md` file
**Status:** FIXED-SINCE
**Severity:** High
**File:** `src-tauri/src/commands/graph.rs:30-48` and `src/components/GraphView/GraphView.tsx:144-185`
**Description:** The original bug had two root causes and an "also affected" callout, all tied to the global Graph View (`GraphView.tsx`). Part A: `path_to_label` unconditionally tried to strip a `.md` suffix from every node's path regardless of node type. Part B: the double-click handler fell through to `createNoteInDir` for any node ID that didn't match an existing file — including ghost nodes for missing media assets — always creating a `.md` file. Also affected: ghost nodes for wikilinks with a folder prefix (`[[Projects/Idea]]`) created the note at the vault root instead of inside `Projects/`. Re-verifying against current HEAD: `path_to_label` (Part A) is unchanged in structure but is provably harmless — `strip_suffix(".md")` is a no-op for any path that doesn't end in `.md`, and a dedicated unit test (`graph.rs:170`) asserts `path_to_label("Vault/Projects/Image.png", "Vault")` returns `"Image.png"` with the extension intact, not a corrupted label. Part B is fixed: `handleNodeDoubleClick` now computes the file extension and checks it against a `MEDIA_EXTENSIONS` set before doing anything else, returning early with a `console.warn` instead of creating a note (`GraphView.tsx:161-165`). The "also affected" folder-prefix issue is fixed too: `targetDir` is now built by re-joining all path segments except the last (`GraphView.tsx:169-173`), so `createNoteInDir` is called with the folder preserved, not the vault root. Caveat found during re-verification (not part of the original bug, see NEW-GRAPH-2): if the referenced folder doesn't exist yet on disk, the backend `create_note` command has no `create_dir_all` call before its `fs::write`, so the fixed folder-preserving code path can still fail — just silently now, instead of misplacing the file. Separately, and more importantly, this fix was applied only to `GraphView.tsx` — see NEW-GRAPH-1: `LocalGraphPanel.tsx` has its own independent copy of this same double-click logic that was never updated and still reproduces the original bug's exact symptoms.
**Evidence:**
```rust
// graph.rs:30-48
fn path_to_label(path: &str, vault_path: &str) -> String {
	let normalized = crate::utils::normalize_path(path);
	let normalized_vault = crate::utils::normalize_path(vault_path);
	
	let mut relative = normalized;
	if relative.starts_with(&normalized_vault) {
		relative = relative[normalized_vault.len()..].to_string();
		if relative.starts_with('/') {
			relative = relative[1..].to_string();
		}
	}
	
	if let Some(stripped) = relative.strip_suffix(".md") {
		relative = stripped.to_string();
	}
	
	let parts: Vec<&str> = relative.split('/').collect();
	parts.last().unwrap_or(&"").to_string()
}
```
```rust
// graph.rs:170 — regression test proving media labels are not corrupted
assert_eq!(path_to_label("Vault/Projects/Image.png", "Vault"), "Image.png");
```
```typescript
// GraphView.tsx:144-185
const handleNodeDoubleClick = useCallback(
    async (nodeId: string) => {
        const existingFile = files.find((f) => f.path === nodeId);

        if (existingFile) {
            setActiveNote(existingFile);
            setViewMode('editor');
        } else {
            if (!vaultPath) return;

            const normalizedId = nodeId.replace(/\\/g, '/');
            const parts = normalizedId.split('/');
            const filename = parts[parts.length - 1];
            const ext = filename.includes('.')
                ? filename.split('.').pop()?.toLowerCase() ?? ''
                : '';

            // Ghost node for a missing media asset — do not create a Markdown file.
            if (ext && MEDIA_EXTENSIONS.has(ext)) {
                console.warn(`Graph: ghost node "${filename}" is a media asset — skipping note creation`);
                return;
            }

            try {
                const title = filename.replace(/\.md$/i, '');
                // Preserve folder prefix: create note inside the same directory as
                // the ghost link (e.g. [[Projects/Idea]] → vault/Projects/Idea.md)
                const targetDir = parts.length > 1
                    ? `${vaultPath}/${parts.slice(0, -1).join('/')}`
                    : vaultPath;

                const newNote = await createNoteInDir(targetDir, title);
                addFileIfMissing(newNote);
                setActiveNote(newNote);
                setViewMode('editor');
            } catch (e) {
                console.error('Failed to create note:', e);
            }
        }
    },
    [files, vaultPath, setActiveNote, setViewMode, addFileIfMissing]
);
```

---

### NEW-GRAPH-1: Local Graph panel's own double-click handler reintroduces BUG-U3 verbatim
**Status:** NEW
**Severity:** High
**File:** `src/components/GraphView/LocalGraphPanel.tsx:137-160`
**Description:** `LocalGraphPanel.tsx` does not reuse `GraphView.tsx`'s fixed `handleNodeDoubleClick` — it has its own separate copy of the same logic, and that copy was never updated with either of BUG-U3's fixes. It has no media-extension check at all (no equivalent of `GraphView.tsx`'s `MEDIA_EXTENSIONS` set), and it always calls `createNoteInDir(vaultPath, title)` with the bare vault root, never preserving a folder prefix from the node ID. Concretely: double-clicking a ghost node for a missing image (e.g. `Diagram.png`) in the Local Graph panel reaches the `else` branch, computes `title = filename.replace(/\.md$/, '')` (a no-op for `Diagram.png`, since it doesn't end in `.md`), and calls `createNoteInDir(vaultPath, "Diagram.png")`. The backend's `create_note` (`src-tauri/src/commands/notes.rs:519-523`) checks whether the title already ends in `.md` (case-insensitively); since `"Diagram.png"` doesn't, it appends `.md`, producing a stray `Diagram.png.md` file at the vault root — exactly BUG-U3's original symptom, and exactly the file-creation-pollution bug the GraphView.tsx fix was written to prevent. The folder-prefix regression is equally reproducible: double-clicking a ghost node for `Projects/Idea` (from a wikilink like `[[Projects/Idea]]`) creates `Idea.md` at the vault root instead of inside `Projects/`, since `targetDir` is never computed here.
**Evidence:**
```typescript
// LocalGraphPanel.tsx:137-160
const handleNodeDoubleClick = useCallback(
    async (nodeId: string) => {
        const normalizedNodeId = nodeId.replace(/\\/g, '/');
        const existingFile = files.find((f) => f.path.replace(/\\/g, '/') === normalizedNodeId);
        if (existingFile) {
            setActiveNote(existingFile);
        } else {
            try {
                const parts = nodeId.replace(/\\/g, '/').split('/');
                const filename = parts[parts.length - 1];
                const title = filename.replace(/\.md$/, '');

                if (!vaultPath) return;

                const newNote = await createNoteInDir(vaultPath, title);
                addFileIfMissing(newNote);
                setActiveNote(newNote);
            } catch (e) {
                console.error('Failed to create note:', e);
            }
        }
    },
    [files, vaultPath, addFileIfMissing]
);
```
This handler is wired to `GraphCanvas`'s `onNodeDoubleClick` prop inside `LocalGraphPanel.tsx` (the floating panel behind the "Local graph" flyout, which renders only `GraphCanvas` in `mode="local"` — it has no Mosaic mode of its own; `MosaicCanvas` is used exclusively by the global `GraphView.tsx`), so it is reachable from the shipping UI, not dead code.
**Fix:** Extract `GraphView.tsx`'s fixed double-click logic (media-extension guard + folder-preserving `targetDir`) into a shared helper (e.g. `src/utils/graphNodeActions.ts`) and have both `GraphView.tsx` and `LocalGraphPanel.tsx` call it, so the two panels can't drift out of sync again.

---

### NEW-GRAPH-2: Folder-preserving fix for ghost-node creation can still fail silently when the target folder doesn't exist on disk
**Status:** NEW
**Severity:** Medium
**File:** `src/components/GraphView/GraphView.tsx:167-181` and `src-tauri/src/commands/notes.rs:502-538`
**Description:** `GraphView.tsx`'s fixed double-click handler now computes `targetDir` by re-joining the node ID's folder segments (see BUG-U3 evidence above), so `createNoteInDir(targetDir, title)` is invoked with the correct destination folder for a ghost node like `[[Projects/Idea]]`. However, the backend `create_note` command (`notes.rs:502-538`) never calls `create_dir_all` (or any directory-creation logic) on `vault_path` — the parameter that receives `targetDir` — before writing the file at `notes.rs:536`. If `Projects/` doesn't already exist on disk (a plausible case: the wikilink can reference a folder that was never created, e.g. typed by the user but not yet materialized), `tokio::fs::write` fails with a `NotFound` I/O error. That error propagates back through the Tauri `invoke` call and is caught by the frontend's `catch (e) { console.error('Failed to create note:', e); }` (`GraphView.tsx:179-180`), which has no user-facing error surface (no toast, no dialog). The net effect: double-clicking such a ghost node does nothing visible — no note is created, no folder is created, and the only trace is a browser-console error the user is unlikely to see.
**Evidence:**
```typescript
// GraphView.tsx:167-181
                try {
                    const title = filename.replace(/\.md$/i, '');
                    // Preserve folder prefix: create note inside the same directory as
                    // the ghost link (e.g. [[Projects/Idea]] → vault/Projects/Idea.md)
                    const targetDir = parts.length > 1
                        ? `${vaultPath}/${parts.slice(0, -1).join('/')}`
                        : vaultPath;

                    const newNote = await createNoteInDir(targetDir, title);
                    addFileIfMissing(newNote);
                    setActiveNote(newNote);
                    setViewMode('editor');
                } catch (e) {
                    console.error('Failed to create note:', e);
                }
```
```rust
// notes.rs:502-538 — vault_path (here, the ghost node's target folder) is never created
pub async fn create_note(
    state: State<'_, AppState>,
    kuzu_state: State<'_, ManagedGrafeoConnection>,
    vault_path: String,
    title: String,
) -> Result<String, TessellumError> {
    validate_path_in_vault(&vault_path, &vault_path).map_err(TessellumError::Validation)?;
    
    let clean_title = sanitize_string(title);
    
    if clean_title.trim().is_empty() {
        return Err(TessellumError::Validation(
            "Title cannot be empty".to_string(),
        ));
    }
    
    // Create a file path
    let mut filename = if clean_title.to_lowercase().ends_with(".md") {
        clean_title.clone()
    } else {
        format!("{}.md", clean_title)
    };
    let mut file_path = Path::new(&vault_path).join(&filename);
    let mut collision_index = 1;
    
    // Check for collisions in the filenames
    while file_path.exists() {
        let stem = clean_title.strip_suffix(".md").unwrap_or(&clean_title);
        filename = format!("{} ({}).md", stem, collision_index);
        file_path = Path::new(&vault_path).join(&filename);
        collision_index += 1;
    }
    
    // Create an empty file
    tokio::fs::write(&file_path, String::new())
        .await
        .map_err(TessellumError::from)?;
```
**Fix:** Either call `tokio::fs::create_dir_all(&vault_path)` in `create_note` before the collision-check loop, or have the frontend surface the rejected promise from `createNoteInDir` as a toast/error message instead of only `console.error`-ing it, so the user gets feedback either way.

---

### NEW-GRAPH-3: `useDraggablePosition` validates the stored value's shape but not its bounds, so a draggable panel can end up permanently off-screen with no way to recover it
**Status:** NEW
**Severity:** Low
**File:** `src/hooks/useDraggablePosition.ts:13-24` and `src/hooks/useDraggablePosition.test.tsx:64-78`
**Description:** Unlike the old `BUG-G1`/`BUG-S1` pattern (raw, unvalidated `localStorage` reads), `useDraggablePosition`'s `readStoredPosition` does guard against malformed JSON (try/catch) and the wrong shape (`typeof parsed?.x === "number" && typeof parsed?.y === "number"`) — the regression test added in commit `50f415e` (`useDraggablePosition.test.tsx:64-78`) covers exactly those two cases: not-valid-JSON, and valid-JSON-wrong-shape. What neither the implementation nor the test covers is *value* validity: any object with numeric `x`/`y` fields is accepted verbatim, with no clamping to the current viewport size and no check that the stored coordinates still make sense. Since `handlePointerMove` (`useDraggablePosition.ts:40-44`) computes new positions purely from pointer deltas with no clamping either, a user can drag a panel (currently `GraphLegend`, via `storageKey: "tessellum:graphLegendPosition"`) far enough that it becomes partially or fully invisible, and that off-screen position is persisted (`useDraggablePosition.ts:53-60`) and restored verbatim on next load. The same can happen passively, with no drag at all, if a position saved on a large/multi-monitor viewport is then loaded on a smaller one (e.g. a laptop screen) — nothing re-clamps `x`/`y` to the new viewport bounds. Because the drag handle used to reposition the panel is part of the panel itself, a panel that renders off-screen has no visible affordance to drag it back, and there is no reset control, so the only recovery path is manually clearing the `tessellum:graphLegendPosition` `localStorage` key.
**Evidence:**
```typescript
// useDraggablePosition.ts:13-24 — validates shape, not value range
function readStoredPosition(storageKey: string | undefined, fallback: Position): Position {
    if (!storageKey) return fallback;
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        if (typeof parsed?.x === "number" && typeof parsed?.y === "number") return parsed;
        return fallback;
    } catch {
        return fallback;
    }
}
```
```typescript
// useDraggablePosition.test.tsx:64-78 — the "corrupt-storage fallback" regression coverage,
// which only exercises invalid-JSON and wrong-shape, not out-of-bounds values
    it("falls back to initial when the stored value is not valid JSON", () => {
        localStorage.setItem("test:dragPos", "not valid json");
        const { result } = renderHook(() =>
            useDraggablePosition({ initial: { x: 16, y: 16 }, storageKey: "test:dragPos" }),
        );
        expect(result.current.position).toEqual({ x: 16, y: 16 });
    });

    it("falls back to initial when the stored value is valid JSON but the wrong shape", () => {
        localStorage.setItem("test:dragPos", JSON.stringify({ foo: "bar" }));
        const { result } = renderHook(() =>
            useDraggablePosition({ initial: { x: 16, y: 16 }, storageKey: "test:dragPos" }),
        );
        expect(result.current.position).toEqual({ x: 16, y: 16 });
    });
```
For contrast, the sibling `useResizableFloatingPanel` hook (added in the same redesign, used by `LocalGraphPanel.tsx`) does clamp its persisted numeric values on every read and write via a `clamp(value, min, max)` helper (`src/components/GraphView/useResizableFloatingPanel.ts:25-33`), so this is an inconsistency between the two new position-persisting hooks rather than a universal gap in the redesign.
**Fix:** Clamp `x`/`y` to the current `window.innerWidth`/`innerHeight` (minus the panel's own size) both when reading the stored value and on window resize, the same way `useResizableFloatingPanel` clamps its stored width/height.

---

### NEW-GRAPH-4: MosaicCanvas recomputes the full hex-cluster layout on every node selection, even when selection can't change the layout
**Status:** NEW
**Severity:** Low
**File:** `src/components/GraphView/MosaicCanvas.tsx:27-38, 43-66`
**Description:** `MosaicCanvas`'s tile layout is memoized with `useMemo(..., [graphData, selectedNodeId])` (`MosaicCanvas.tsx:66`), so it does avoid recomputing on every render — but `selectedNodeId` is part of the dependency array, and every node click changes `selectedNodeId`. For any graph at or under the `MAX_TILES` cap of 200 nodes (`MosaicCanvas.tsx:14, 28`) — i.e. every graph that isn't already large enough to be a real performance concern — `pickVisibleNodes` returns `nodes` unchanged without ever consulting `selectedNodeId` (`MosaicCanvas.tsx:28`: `if (nodes.length <= MAX_TILES) return nodes;`). That means the click that merely selects a tile also unconditionally re-runs `countConnections`, `computeTagClusters`, `bucketNodesByDominantTag`, and `packHexClusters` — the BFS-based hex-packing placement algorithm (`src/utils/hexGrid.ts:69-163`) — over the full visible node set, even though the result is provably identical to the layout already on screen. `selectedNodeId` is only load-bearing for `pickVisibleNodes` in the >200-node case (to force the selected node into the visible top-N), so the recompute is pure waste in the common case, and in the large-graph case it means every single click re-runs the full clustering/packing pipeline over up to 200 tiles instead of only when the visible set actually needs to change.
**Evidence:**
```typescript
// MosaicCanvas.tsx:27-38
function pickVisibleNodes(nodes: GraphData["nodes"], connections: Map<string, number>, selectedNodeId: string | null): GraphData["nodes"] {
    if (nodes.length <= MAX_TILES) return nodes;
    const sorted = [...nodes].sort((a, b) => (connections.get(b.id) ?? 0) - (connections.get(a.id) ?? 0));
    const top = sorted.slice(0, MAX_TILES);
    if (selectedNodeId && !top.some((n) => n.id === selectedNodeId)) {
        const selectedNode = nodes.find((n) => n.id === selectedNodeId);
        if (selectedNode) {
            top[top.length - 1] = selectedNode;
        }
    }
    return top;
}
```
```typescript
// MosaicCanvas.tsx:43-66 — full clustering + bucketing + hex-packing pipeline
// re-runs on every selectedNodeId change, not just graphData changes
    const layout = useMemo(() => {
        if (!graphData) return null;
        const connections = countConnections(graphData.nodes, graphData.edges);
        const visible = pickVisibleNodes(graphData.nodes, connections, selectedNodeId);
        const nodesById = new Map(visible.map((n) => [n.id, n]));
        const clusters = computeTagClusters(visible);
        const buckets = bucketNodesByDominantTag(visible, clusters).map((b) => ({ items: b.nodeIds }));
        const { tiles: hexTiles, width, height } = packHexClusters(buckets);

        const tiles: MosaicTile[] = hexTiles.map((hexTile) => {
            const node = nodesById.get(hexTile.item)!;
            return {
                id: node.id,
                label: node.label,
                tags: node.tags,
                orphan: node.orphan,
                unresolved: !node.exists,
                x: hexTile.x,
                y: hexTile.y,
            };
        });

        return { tiles, width, height };
    }, [graphData, selectedNodeId]);
```
**Fix:** Split the memo in two: memoize `layout` (tiles/positions) on `graphData` alone (plus `selectedNodeId` only when `graphData.nodes.length > MAX_TILES`), and derive `selectedTile` for the halo/label separately via a cheap `.find()` keyed on `selectedNodeId` against the already-computed `layout.tiles` (which the component already does at `MosaicCanvas.tsx:72`, so the infrastructure for splitting these two concerns already exists).

---

### Note: in-progress `LocalGraphPanel.tsx` resizing change (working tree, uncommitted)
The uncommitted working-tree diff to `LocalGraphPanel.tsx` (wiring in `useResizableFloatingPanel` to make the panel's width/graph-height user-resizable, matching commits `8623b9a`/`d3a2af8`'s floating-panel direction) was read but not modified, per instructions. It appears complete, not half-done: the JSX added by the diff is balanced (the new wrapper `<div>` opened to hold the header/graph/footer under a single rounded chrome box is correctly closed by the extra `</div>` the diff adds just before the panel's outer closing tag), and `useResizableFloatingPanel`'s returned interface (`{ width, height, isResizing, startResize }`, `startResize: (axis: "width" | "height" | "both") => (event) => void`) matches exactly how `LocalGraphPanel.tsx` consumes it (`onMouseDown={startResize('width')}` etc.). `useResizableFloatingPanel` itself already clamps its persisted width/height on both read and write (`src/components/GraphView/useResizableFloatingPanel.ts:25-33, 60-69`), so it does not repeat the BUG-G1/S1 pattern and does not share NEW-GRAPH-3's off-screen-drift problem (dimensions are inherently bounded by `min`/`max`, unlike an absolute `x`/`y` position). No finding filed for this item — it is not a bug.
