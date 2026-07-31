## Vault Switcher / Recent Vaults

### NEW-VAULTSWITCH-1: Clicking a recent (stale) vault entry has no pre-flight validation; the app briefly shows the old vault's file tree under the new (invalid) path before silently bouncing to "no vault"
**Status:** NEW
**Severity:** Medium
**File:** `src/components/vault/VaultSwitcherPopover.tsx:210-213`, `src/stores/vaultStore.ts:99-113`, `src/hooks/useVaultSession.ts:121-134`, `src/hooks/useVaultSession.ts:143-160`
**Description:** The recent-vaults click handler calls `setVaultPath(path)` directly with no existence/directory/readability check first (`VaultSwitcherPopover.tsx:210-213`). `setVaultPath` synchronously commits the new path to `localStorage`/state and tears down the *previous* vault's volatile state (`activeNote`, `openTabPaths`) immediately (`vaultStore.ts:99-113`), before anything has confirmed the new path is valid. `useVaultSession`'s "watch the vault directory" effect then fires unconditionally on the new `vaultPath` — it calls `invoke("watch_vault", ...)` and `refreshFiles(vaultPath, true)` (which calls `list_vault_snapshot`) regardless of whether the path exists (`useVaultSession.ts:143-160`); both backend calls fail for a missing path, but the frontend only `console.error`s (in `refreshFiles`'s outer catch and the `.catch(console.error)` on `watch_vault`), so the file tree is left showing the *previous* vault's `files`/`fileTree` (since `setFiles`/`setFileTree` are never reached) while `vaultPath` itself already points at the new, invalid path. Separately, `useVaultSession`'s "validate the persisted vault path" effect (`useVaultSession.ts:121-134`) runs an async `exists()` check; when it resolves `false` it does `console.warn`, `removeRecentVaultPath`, and `setVaultPath(null)` — which is the same fix pattern applied to `BUG-G1`, but here it fires *after* the switch and its side effects have already happened, rather than gating them. The net effect for the user: clicking a recent entry whose folder was deleted/renamed/unmounted produces a flash of inconsistent UI (new invalid path, old vault's file list) and then silently dumps them onto the "no vault" screen with zero user-facing error message — only a `console.warn` — losing their current session context in the process, instead of staying on the vault they were already in and showing a toast/error.
**Evidence:**
```typescript
// VaultSwitcherPopover.tsx:210-213 — no exists()/validation call before switching
                                    onClick={() => {
                                        setVaultPath(path);
                                        onClose();
                                    }}
```
```typescript
// vaultStore.ts:99-113 — commits the new path and tears down the old vault's state unconditionally
    setVaultPath: (path) => {
        if (path) {
            localStorage.setItem(VAULT_PATH_KEY, path);
        } else {
            localStorage.removeItem(VAULT_PATH_KEY);
        }
        set((state) => {
            const recentVaultPaths = path
                ? pushRecentVaultPath(state.recentVaultPaths, path)
                : state.recentVaultPaths;
            if (path) writeRecentVaultPaths(recentVaultPaths);
            // Reset per-vault volatile state when changing vault scope.
            return { vaultPath: path, activeNote: null, openTabPaths: [], recentVaultPaths };
        });
    },
```
```typescript
// useVaultSession.ts:143-160 — fires watch_vault + refreshFiles for the new path unconditionally,
// before the exists() check below has resolved
    useEffect(() => {
        if (vaultPath) {
            invoke("watch_vault", { vaultPath }).catch(console.error);
            setWorkspaceRestored(false);
            refreshFiles(vaultPath, true);
        } else {
            setActiveNote(null);
            setExpandedFolders({});
            setWorkspaceRestored(false);
        }

        return () => {
            invoke("unwatch_vault").catch(() => {
                // Ignore teardown errors during dev reload/unmount.
            });
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vaultPath]);
```
```typescript
// useVaultSession.ts:121-134 — the only existence check; runs asynchronously, after the effect above
// has already started tearing down/reloading, and only recovers by clearing the vault entirely
    useEffect(() => {
        if (!vaultPath) return;
        exists(vaultPath).then((doesExist: boolean) => {
            if (!doesExist) {
                console.warn(`Vault path ${vaultPath} no longer exists. Clearing.`);
                removeRecentVaultPath(vaultPath);
                setVaultPath(null);
                return;
            }
            invoke("set_vault_path", { path: vaultPath })
                .then(() => app.events.emit("vault:scope-ready", vaultPath))
                .catch(console.error);
        }).catch(console.error);
    }, [vaultPath, setVaultPath, removeRecentVaultPath, app]);
```
**Fix:** Before calling `setVaultPath` in the popover's click handler, `await exists(path)` (or a dedicated `validate_vault_path` command) and either switch on success or show a toast ("This vault folder could not be found") and call `removeRecentVaultPath(path)` without touching the currently-active vault's state. This mirrors the `BUG-G1` fix pattern but applies it *before* the transition instead of reactively cleaning up after teardown has already begun.

---

### NEW-VAULTSWITCH-2: Switching between two valid vaults does not tear down `canvasPath`/`viewMode`, so the Canvas view can be left pointing at the previous vault's file
**Status:** NEW
**Severity:** Medium
**File:** `src/stores/graphStore.ts:23-37`, `src/components/canvas/CanvasView.tsx:162-187`, `src/hooks/useVaultSession.ts:89-91`
**Description:** `vaultStore.setVaultPath` (see `NEW-VAULTSWITCH-1` evidence, `vaultStore.ts:99-113`) explicitly resets `activeNote` and `openTabPaths` when the vault scope changes, but nothing resets `graphStore`'s `viewMode`/`canvasPath`/`selectedGraphNode`/`isLocalGraphOpen` — `setViewMode` only clears `selectedGraphNode` as a side effect (`graphStore.ts:31`), and `setCanvasPath` is a bare, vault-unaware setter (`graphStore.ts:32`). If a user is viewing a Canvas file in vault A (`viewMode: "canvas"`, `canvasPath` pointing at an absolute path inside vault A) and switches — via the switcher's recent-vaults list or the "Open folder as vault" action, both of which route through the same `setVaultPath` — to a different, valid vault B, `CanvasView`'s load effect re-fires because its dependency array includes `vaultPath` (`CanvasView.tsx:162-187`) and immediately calls `invoke('read_file', { vaultPath: B, path: canvasPath /* still A's path */ })`. The backend's `validate_path_in_vault` check correctly rejects this (no cross-vault data actually leaks), but the frontend has no recovery for that error beyond `setError(String(e))` — the user is left staring at a broken Canvas error screen for vault B. Nothing switches `viewMode` back to `"editor"` for the new vault except `useVaultSession`'s per-vault `restoreState` step, and only if vault B happens to have a previously-*stored* `viewMode` value for itself (`useVaultSession.ts:89-91`); if B has no stored `viewMode` (e.g. never opened before) the app stays parked on the errored Canvas view indefinitely. Even when a stored `viewMode` for B does exist and get restored, `canvasPath` itself is never restored per-vault anywhere in the codebase — only explicit user actions (`FileNode.tsx`, `WorkspaceAPI`, `CoreUIActionsPlugin`) call `setCanvasPath` — so a vault B whose own last-used view happened to be `"canvas"` would still show a Canvas view rendering leftover state from A rather than B's own last canvas.
**Evidence:**
```typescript
// graphStore.ts:23-37 — setViewMode clears selectedGraphNode but not canvasPath;
// setCanvasPath is a plain setter with no vault scoping or reset hook
export const useGraphStore = create<GraphStore>((set) => ({
    viewMode: "editor",
    canvasPath: null,
    isLocalGraphOpen: false,
    selectedGraphNode: null,
    graphMode: "network",
    graphFilter: "all",

    setViewMode: (mode) => set({ viewMode: mode, selectedGraphNode: null }),
    setCanvasPath: (path) => set({ canvasPath: path }),
    toggleLocalGraph: () => set((state) => ({ isLocalGraphOpen: !state.isLocalGraphOpen, selectedGraphNode: null })),
    setSelectedGraphNode: (path) => set({ selectedGraphNode: path }),
    setGraphMode: (graphMode) => set({ graphMode }),
    setGraphFilter: (graphFilter) => set({ graphFilter }),
}));
```
```typescript
// CanvasView.tsx:162-187 — re-fires on every vaultPath change with the stale canvasPath still set
    useEffect(() => {
        if (!canvasPath || !vaultPath) return;
        const name = canvasPath.split('/').pop() ?? 'Canvas';
        setCanvasName(name.replace(/\.canvas$/, ''));
        setError(null);

        invoke<string>('read_file', { vaultPath, path: canvasPath })
            .then((content) => {
                try {
                    const data: CanvasData = content.trim() ? JSON.parse(content) : EMPTY_CANVAS;
                    canvasDataRef.current = data;
                    if (cyRef.current) {
                        cyRef.current.elements().remove();
                        cyRef.current.add(canvasToElements(data));
                        cyRef.current.layout({ name: 'preset' } as any).run();
                        if (data.nodes.length > 0) {
                            cyRef.current.fit(undefined, 60);
                        }
                    }
                } catch {
                    canvasDataRef.current = EMPTY_CANVAS;
                    setError('Invalid canvas file — starting with empty canvas.');
                }
            })
            .catch((e) => setError(String(e)));
    }, [canvasPath, vaultPath]);
```
```typescript
// useVaultSession.ts:89-91 — the only place viewMode is restored per-vault, and only
// when a stored value happens to exist for the newly-opened vault
                if (storedViewMode === "graph" || storedViewMode === "editor" || storedViewMode === "canvas") {
                    setViewMode(storedViewMode);
                }
```
**Fix:** Reset `graphStore` (`viewMode` back to `"editor"`, `canvasPath` to `null`, `selectedGraphNode` to `null`, `isLocalGraphOpen` to `false`) in the same place `vaultStore.setVaultPath` resets `activeNote`/`openTabPaths`, before the `restoreState` step re-applies whatever is actually stored for the new vault. This keeps teardown symmetric across all workspace-scoped stores instead of only the vault store's own fields.

---

### NEW-VAULTSWITCH-3: `selectionStore`'s file selection is not cleared on vault switch (low-impact; consumers defensively re-filter against the live file list)
**Status:** NEW
**Severity:** Low
**File:** `src/stores/selectionStore.ts:18-26`, `src/components/Sidebar/hooks/useDeleteFile.ts:41-43`
**Description:** Like `graphStore` (`NEW-VAULTSWITCH-2`), `selectionStore`'s `selectedFilePaths`/`lastSelectedPath` are not reset anywhere in the vault-switch path — `clearSelection` is only ever invoked after a successful delete (`useDeleteFile.ts:135`) or from file-tree interaction handlers, never from `vaultStore.setVaultPath` or `useVaultSession`. After switching from vault A (with an active multi-selection) to vault B, `selectedFilePaths` still holds vault A's absolute paths. This does not appear to be exploitable for a cross-vault operation: the one bulk-action consumer inspected, `useDeleteFile.requestDelete`, re-resolves `selectedFilePaths` against the *current* vault's `files` list before treating a click as a "delete the selection" action (`useDeleteFile.ts:41-43`), so stale paths from a previous vault simply fail to match and are effectively ignored rather than acted upon. The residual risk is UI staleness (a selection that isn't visually reachable in the new vault's tree lingering in the store) rather than data loss, but it is still an asymmetric teardown compared to `vaultStore`'s own fields, which the brief specifically asked to check for.
**Evidence:**
```typescript
// selectionStore.ts:18-26 — no vault awareness; nothing external resets this store on vault switch
export const useSelectionStore = create<SelectionStore>((set) => ({
    selectedFilePaths: [],
    lastSelectedPath: null,

    setSelectedFilePaths: (paths) => set({ selectedFilePaths: paths }),
    selectOnly: (path) => set(() => ({
        selectedFilePaths: [path],
        lastSelectedPath: path,
    })),
```
```typescript
// useDeleteFile.ts:41-43 — the defensive re-filter that keeps the leak from being actionable
        const selectedTargets = selectedFilePaths
            .map((selectedPath) => files.find((file) => file.path === selectedPath))
            .filter((file): file is FileMetadata => Boolean(file));
```
**Fix:** Call `useSelectionStore.getState().clearSelection()` alongside the `activeNote`/`openTabPaths` reset in `vaultStore.setVaultPath`, for the same reason `NEW-VAULTSWITCH-2` recommends resetting `graphStore` — keep all workspace-scoped stores torn down in one place instead of relying on each individual consumer to defensively re-filter against the live vault.

---

### NEW-VAULTSWITCH-4 (Summary): List bounding, dedup, and removal work correctly; no additional issues found beyond NEW-VAULTSWITCH-1..3
**Status:** NEW
**Severity:** Low
**File:** `src/stores/vaultStore.ts:56, 73-76, 114-118`
**Description:** Per the brief, this entry records what was checked and found to be correct, since the switcher/recent-vaults feature had not been reviewed before. (1) **Bounding:** `MAX_RECENT_VAULTS = 6` (`vaultStore.ts:56`) and `pushRecentVaultPath` slices to that length on every push (`vaultStore.ts:73-76`) — confirmed correct and covered by `vaultStore.test.ts`'s `"caps the list at 6 entries, dropping the oldest"` test (lines 193-210). (2) **Dedup:** `pushRecentVaultPath` filters out any existing occurrence of the path before unshifting it back to the front (`vaultStore.ts:74-75`), so re-opening the same vault moves it to the top rather than duplicating it — also covered by `vaultStore.test.ts`'s `"dedupes and moves a re-opened path back to the front"` test (lines 183-191). (3) **Removal:** the popover's per-row "remove" button calls `removeRecentVaultPath(path)` with `e.stopPropagation()` so it does not also trigger the switch (`VaultSwitcherPopover.tsx:220-236`), and the store action correctly filters the path out and persists the result (`vaultStore.ts:114-118`); this is exercised by `VaultSwitcherPopover.test.tsx`'s `"removes a recent vault without switching to it"` test. No bug found in these three areas. The persistence-layer angle on this same feature (recent-vault entries that are never proactively re-validated unless they become the active vault) was already filed as `NEW-STORES-2` by the stores/hooks task; this task's findings (`NEW-VAULTSWITCH-1` through `-3`) are about the switcher's click-to-open flow and cross-store teardown, and are intentionally scoped not to duplicate that entry.
**Evidence:**
```typescript
// vaultStore.ts:56, 73-76 — bounding and dedup
const MAX_RECENT_VAULTS = 6;
...
function pushRecentVaultPath(current: string[], path: string): string[] {
    const deduped = current.filter((p) => p !== path);
    return [path, ...deduped].slice(0, MAX_RECENT_VAULTS);
}
```
```typescript
// vaultStore.ts:114-118 — removal
    removeRecentVaultPath: (path) => set((state) => {
        const recentVaultPaths = state.recentVaultPaths.filter((p) => p !== path);
        writeRecentVaultPaths(recentVaultPaths);
        return { recentVaultPaths };
    }),
```
