## UI Components & Feature Slices

### BUG-C1: Closing a tab with unsaved changes silently discards all edits
**Status:** CHANGED-SINCE
**Severity:** High
**File:** `src/components/Editor/Editor.tsx:891-898`
**Description:** `handleTabClose` no longer calls `closeTab(id)` unconditionally. It now guards with `if (id === activeNote?.path && isDirty)` and routes through a confirm dialog (`dirtyCloseConfirm` state, rendered at `Editor.tsx:1041-1066`) instead of discarding immediately. However, `isDirty` is a single global boolean on `editorContentStore` (`src/stores/editorContentStore.ts:40-45, 56-60`) that only tracks whether the *currently active* note has unsaved edits — it is not keyed per tab/path. `closeTab` itself, at the store level, performs no dirty check at all (`src/stores/vaultStore.ts:192-212` — pure `openTabPaths` array manipulation). So the guard only fires when the tab being closed is also the active tab; closing a **background** tab (`id !== activeNote?.path`) — even one with unsaved edits — falls straight through to `closeTab(id)` on line 897 with no confirmation and no data-loss protection, reproducing the original bug's failure mode for every tab except the active one.
**Evidence:**
```typescript
891	    const handleTabClose = (id: string) => {
892	        // Guard against silently discarding unsaved changes on the active note.
893	        if (id === activeNote?.path && isDirty) {
894	            setDirtyCloseConfirm(id);
895	            return;
896	        }
897	        closeTab(id);
898	    };
```
```typescript
40	export interface EditorContentState {
41	    activeNoteContent: string;
42	    isDirty: boolean;
43	    editorFontSizePx: number;
44	    autoSaveStatus: AutoSaveStatus;
45	}
```
```typescript
56	export const useEditorContentStore = create<EditorContentStore>((set) => ({
57	    activeNoteContent: "",
58	    isDirty: false,
59	    editorFontSizePx: readInitialEditorFontSizePx(),
60	    autoSaveStatus: DEFAULT_AUTO_SAVE_STATUS,
```
```typescript
192	    closeTab: (path) => set((state) => {
193	        if (!state.openTabPaths.includes(path)) {
194	            return state;
195	        }
196	
197	        const closingIndex = state.openTabPaths.indexOf(path);
198	        const nextOpenTabs = state.openTabPaths.filter((item) => item !== path);
199	
200	        if (state.activeNote?.path !== path) {
201	            return { openTabPaths: nextOpenTabs };
202	        }
203	
204	        if (nextOpenTabs.length === 0) {
205	            return { openTabPaths: [], activeNote: null };
206	        }
207	
208	        const fallbackPath = nextOpenTabs[Math.min(closingIndex, nextOpenTabs.length - 1)];
209	        const fallbackNote = state.files.find((file) => file.path === fallbackPath) ?? null;
210	
211	        return { openTabPaths: nextOpenTabs, activeNote: fallbackNote };
212	    }),
```
**Fix:** Track dirty state per open path (e.g. a `Set<string>` or `Record<path, boolean>` on `editorContentStore`, populated whenever content diverges from the last-saved snapshot for that path, not just the active one) so `handleTabClose` can check `dirtyPaths.has(id)` regardless of whether `id` is the active tab, and route background-tab closes through the same confirm dialog.

---

### BUG-C2: Search results keyed by array index — React reuses wrong DOM nodes on result change
**Status:** CHANGED-SINCE
**Severity:** High
**File:** `src/components/Search/SearchPanel.tsx:500-508`
**Description:** The primary instance of this bug is fixed: `SearchPanel.tsx` now keys each result on `${result.type}-${result.title}-${result.path}` (falling back to `""` when the result has no `path`), derived entirely from data identity rather than array position. However, the two secondary sites the original finding called out under "Same pattern also in" were **not** migrated to the same fix. `src/components/TemplatePicker.tsx:196-203` still keys each list item on `` `${template.name}-${index}` `` and `src/components/Sidebar/SidebarContextMenu.tsx:92-93` still keys each item on `` `${item.label}-${index}` `` — both still splice the array index into the key. In both cases the underlying list is effectively static per mount (no live filter/reorder while open), which narrows the practical blast radius versus the original SearchPanel case, but the key is still not purely identity-derived: `TemplatePicker` items expose a genuinely unique `template.path` that isn't used, and duplicate `name`/`label` values (or any future reordering of these lists) would still trigger the original stale-DOM-node-reuse failure mode.
**Evidence:**
```tsx
500	                            {results.map((result, idx) => {
501	                                const isActive = activeIndex === idx;
502	                                return (
503	                                    <div
504	                                        key={`${result.type}-${result.title}-${"path" in result ? result.path : ""}`}
505	                                        style={createResultCardStyle(isActive)}
506	                                        onMouseEnter={() => setActiveIndex(idx)}
507	                                        onClick={() => openResult(result)}
508	                                    >
```
```tsx
196	                    {listItems.map((template, index) => {
197	                        const isBlank = template.path === "";
198	                        const tile = ICON_TILE_TOKENS[index % ICON_TILE_TOKENS.length];
199	                        const Icon = isBlank ? File : FileText;
200	
201	                        return (
202	                            <button
203	                                key={`${template.name}-${index}`}
```
```tsx
92	            {items.map((item, index) => (
93	                <div key={`${item.label}-${index}`}>
```
**Fix:** In `TemplatePicker.tsx`, key on `template.path` alone (it is already unique — the blank-note sentinel is `""` and is the only entry with that path). In `SidebarContextMenu.tsx`, key on a stable per-item identifier from `createSidebarContextMenuItems` (e.g. an explicit `id` field per menu item) instead of `label`+index, since labels are translated strings that could theoretically collide or change.

---

### BUG-C3: Search query with special characters sent to Tantivy unescaped — silent zero results
**Status:** FIXED-SINCE
**Severity:** Medium
**File:** `src/components/Search/SearchPanel.tsx:201-205`
**Description:** `splitQuery` now routes every term (including the `content:` prefix path) through a new `escapeTantivyTerm` helper before it is ever pushed onto the `terms` array that gets joined and sent to `search_full_text`. The helper escapes exactly the Tantivy special-character set called out in the original finding (`+ - : ! " ( ) [ ] { } ^ ~ * ? \`) with a backslash, matching the originally suggested fix almost verbatim.
**Evidence:**
```typescript
201	function escapeTantivyTerm(term: string): string {
202	    // Escape characters that have special meaning in Tantivy's query parser so
203	    // queries like "c++" or "(algorithm)" don't silently return zero results.
204	    return term.replace(/[+\-:!"()\[\]{}^~*?\\]/g, "\\$&");
205	}
```
```typescript
207	function splitQuery(query: string) {
208	    const parts = query.split(/\s+/).filter(Boolean);
209	    const tags: string[] = [];
210	    const terms: string[] = [];
211	    parts.forEach((part) => {
212	        if (part.startsWith("#")) {
213	            const normalized = normalizeTag(part);
214	            if (normalized) tags.push(normalized);
215	            return;
216	        }
217	        if (part.startsWith("content:")) {
218	            const raw = part.slice("content:".length);
219	            if (raw) terms.push(escapeTantivyTerm(raw));
220	            return;
221	        }
222	        terms.push(escapeTantivyTerm(part));
223	    });
224	    return { terms, tags };
225	}
```

---

### BUG-C4: Appearance settings — free-text hex colour input accepts invalid values silently
**Status:** FIXED-SINCE
**Severity:** Low
**File:** `src/components/Settings/AppearanceSettings.tsx:305-323`
**Description:** The free-text hex input is now backed by a separate `draftAccentColor` local-state variable (so typing doesn't fight the committed `accentColor`) and an `isValidHex` regex check (`AppearanceSettings.tsx:69`, `/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/`). `onChange` always updates the draft value for display, but only calls `setAccentColor(val)` — the function that actually commits and applies the colour — when the regex matches. The input's `style` also spreads in an error border colour (`var(--color-error, #dc2626)`) whenever `isValidHex` is false, giving a visible error indicator that didn't exist before. This matches both parts of the originally suggested fix (validate-before-commit and a red border on invalid input).
**Evidence:**
```typescript
68	    const [draftAccentColor, setDraftAccentColor] = useState(accentColor);
69	    const isValidHex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(draftAccentColor);
```
```tsx
305	                    <input
306	                        type="text"
307	                        value={draftAccentColor}
308	                        onChange={(e) => {
309	                            const val = e.target.value;
310	                            setDraftAccentColor(val);
311	                            if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(val)) {
312	                                setAccentColor(val);
313	                            }
314	                        }}
315	                        className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] focus:border-transparent transition-all w-32"
316	                        style={{
317	                            ...pillStyle,
318	                            ...inputBaseStyle,
319	                            ...(isValidHex ? {} : { borderColor: "var(--color-error, #dc2626)" }),
320	                        }}
321	                        placeholder="#000000"
322	                        maxLength={7}
323	                    />
```

---

### BUG-G6: TabStrip drag handler captures stale tab order
**Status:** FIXED-SINCE
**Severity:** Medium
**File:** `src/components/Editor/TabStrip.tsx:93-99, 131-176`
**Description:** `tabsOrderRef` is still synced from the `tabs` prop via a `useEffect`, but `handleMove` (the mousemove handler) now reads `tabsOrderRef.current` fresh at call time (`const currentTabs = tabsOrderRef.current;`, line 151) rather than closing over a stale `tabs` array snapshot, so a tab added/removed mid-drag is reflected in the next `computeInsertionIndex` call. The second part of the original finding — stale global listeners accumulating across rapid start/stop drags — is also addressed: `handleDragStartIntent` now calls `cleanupDrag()` synchronously as its first action (line 137, with an explanatory comment) before installing new `mousemove`/`mouseup`/`blur` listeners, so any listeners left over from an interrupted previous drag are removed before a new drag begins.
**Evidence:**
```typescript
93	    const tabsOrderRef = useRef<Tab[]>(tabs);
94	    const dragStateRef = useRef<TabDragState | null>(null);
95	    const tabFontSizePx = (12.5 * editorFontSizePx) / 16;
96	
97	    useEffect(() => {
98	        tabsOrderRef.current = tabs;
99	    }, [tabs]);
```
```typescript
131	    const handleDragStartIntent = useCallback((event: React.MouseEvent, sourceId: string) => {
132	        if (event.button !== 0) return;
133	        if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
134	
135	        // Remove any stale global listeners from a previous drag that was
136	        // interrupted without a mouseup (e.g. focus loss, rapid re-drag).
137	        cleanupDrag();
138	
139	        dragStateRef.current = {
140	            sourceId,
141	            startX: event.clientX,
142	            startY: event.clientY,
143	            active: false,
144	            lastInsertionIndex: null,
145	        };
146	
147	        const handleMove = (moveEvent: MouseEvent) => {
148	            const state = dragStateRef.current;
149	            if (!state) return;
150	
151	            const currentTabs = tabsOrderRef.current;
152	
153	            if (!state.active && !shouldActivateDrag(state, moveEvent)) {
154	                return;
155	            }
156	
157	            if (!state.active) {
158	                state.active = true;
159	                setDraggedTabId(state.sourceId);
160	                setDraggingUi(true);
161	            }
162	
163	            const insertionIndex = computeInsertionIndex(moveEvent.clientX, currentTabs, state.sourceId, tabsRef);
164	            if (insertionIndex === null || insertionIndex === state.lastInsertionIndex) {
165	                return;
166	            }
167	
168	            const sourceIndex = currentTabs.findIndex((tab) => tab.id === state.sourceId);
169	            const nextIndex = Math.max(0, Math.min(insertionIndex, currentTabs.length - 1));
170	            if (sourceIndex < 0 || sourceIndex === nextIndex) {
171	                return;
172	            }
173	
174	            onTabReorder?.(state.sourceId, nextIndex);
175	            state.lastInsertionIndex = insertionIndex;
176	        };
```

---

### BUG-G7: PDF export swallows the actual error
**Status:** FIXED-SINCE
**Severity:** Medium
**File:** `src/features/pdfExport/markdownPdfExport.ts:35-52`
**Description:** The `catch` block no longer discards the caught error behind a generic message. It now extracts a `detail` string (`error.message` when the caught value is an `Error`, otherwise `String(error)`) and interpolates it directly into the user-facing toast: `` `Failed to export PDF: ${detail}` ``. `console.error(error)` is still called first for full DevTools detail, but the toast itself now surfaces the underlying cause instead of a fixed generic string.
**Evidence:**
```typescript
35	        try {
36	            const content = await readFile(file.path);
37	            const rendered = await renderDocument({ file, content });
38	
39	            await exportPdf({
40	                destinationPath,
41	                documentTitle: rendered.documentTitle,
42	                html: rendered.html,
43	                outline: rendered.outline,
44	            });
45	
46	            notifySuccess("PDF exported");
47	        } catch (error) {
48	            console.error(error);
49	            const detail = error instanceof Error ? error.message : String(error);
50	            notifyError(`Failed to export PDF: ${detail}`);
51	        }
52	    }
```

---

### BUG-G8: Clipboard import ignores `skippedCount` and treats vault-refresh failure as import failure
**Status:** FIXED-SINCE
**Severity:** Medium
**File:** `src/features/clipboard/clipboardImport.ts:75-94`
**Description:** `result.skippedCount` is no longer discarded — it's read (`const skipped = result.skippedCount ?? 0;`) and, when nonzero, appended to the success message as `"(N skipped)"`. The vault-refresh call is also no longer inside the same try/catch as the import: `notifySuccess(summary)` fires first based purely on the import result, then `refreshVault()` is awaited in its own try/catch whose failure is only `console.error`'d — it no longer causes `pasteInto` to report the operation as failed (the function still returns `true` even if refresh throws). A comment at the call site explicitly documents the ordering rationale.
**Evidence:**
```typescript
75	        if (result.importedPaths.length === 0) {
76	            notifyError(resolvedMessages.clipboardMissingFiles);
77	            return false;
78	        }
79	
80	        // Report the import outcome before attempting vault refresh so that a
81	        // refresh failure doesn't mask a successful import.
82	        const skipped = result.skippedCount ?? 0;
83	        const summary = skipped > 0
84	            ? `${resolvedMessages.importedFiles(result.importedPaths.length, resolvedDestination)} (${skipped} skipped)`
85	            : resolvedMessages.importedFiles(result.importedPaths.length, resolvedDestination);
86	        notifySuccess(summary);
87	
88	        try {
89	            await refreshVault();
90	        } catch (refreshError) {
91	            console.error("Vault refresh failed after import:", refreshError);
92	        }
93	
94	        return true;
```

---

### BUG-G5: EditorView registered in useEffect with ref value as dependency — never re-runs
**Status:** CHANGED-SINCE
**Severity:** Medium
**File:** `src/components/Editor/Editor.tsx:70-88`
**Description:** The fix that landed is not the callback-ref approach the original finding suggested, but a different (also valid) mechanism: `useEditorViewRegistration` now runs its registration effect with **no dependency array at all**, so it executes after every render; a `lastViewRef` ref caches the previously-registered `EditorView` and the effect only calls `TessellumApp.instance.editor.setView(...)` when `editorRef.current?.view` has actually changed since the last render (`view !== lastViewRef.current`). This achieves the same goal as a callback ref — the app is notified whenever the underlying `EditorView` instance changes, including on unmount/remount — without switching to a callback-ref pattern. A separate mount-only effect (lines 83-87) still clears the registration via `setView(null)` on unmount. `useEditorViewRegistration(editorRef)` is invoked once from `Editor()` at line 618.
**Evidence:**
```typescript
70	function useEditorViewRegistration(editorRef: React.RefObject<ReactCodeMirrorRef>) {
71	    // React does not re-run effects when a ref's .current property changes.
72	    // Running without a dependency array checks the view on every render and
73	    // registers it only when it actually changes value (idempotent setView).
74	    const lastViewRef = useRef<EditorView | null | undefined>(null);
75	    useEffect(() => {
76	        const view = editorRef.current?.view;
77	        if (view !== lastViewRef.current) {
78	            lastViewRef.current = view;
79	            TessellumApp.instance.editor.setView(view ?? null);
80	        }
81	    });
82	
83	    useEffect(() => {
84	        return () => {
85	            TessellumApp.instance.editor.setView(null);
86	        };
87	    }, []);
88	}
```
