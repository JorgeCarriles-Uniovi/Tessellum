## Stores & Hooks

### BUG-U1: Reduced Motion toggle clears the active theme
**Status:** FIXED-SINCE
**Severity:** High
**File:** `src/hooks/useApplyAccessibilitySettings.ts:35-43`
**Description:** `queueHighContrastOverlay` no longer reads or writes any theme/appearance state. It now only re-reads the accessibility snapshot and re-applies it to the DOM root via `applyAccessibilityRootState` (which only sets CSS custom properties and `data-*` attributes on `document.documentElement`) — it never touches `useThemeStore` or the theme's localStorage key, so there is no path left by which toggling Reduced Motion, High Contrast, or the UI Scale slider can clobber the active theme.
**Evidence:**
```typescript
        const queueHighContrastOverlay = () => {
            // Theme and appearance writes happen synchronously, so reapply the
            // high-contrast overlay after those updates finish.
            queueMicrotask(() => {
                const snapshot = toAccessibilitySnapshot();
                if (!snapshot.highContrast) return;
                applySnapshot(snapshot, true);
            });
        };
```
`applySnapshot` (used above) only calls `applyAccessibilityRootState({ snapshot })`, which is a pure DOM-mutation helper (`src/hooks/accessibilityCssVars.ts:197-209`) with no reference to `useThemeStore` anywhere in the file.

---

### BUG-G1: vaultStore reads localStorage path with no validation
**Status:** FIXED-SINCE
**Severity:** High
**File:** `src/hooks/useVaultSession.ts:120-134`
**Description:** The store itself (`src/stores/vaultStore.ts:78-89`) still reads the persisted path unconditionally, but `useVaultSession` now validates it against the filesystem via Tauri's `exists()` on every vault-path change, and clears the path (and prunes it from the recent-vaults list) instead of silently entering a broken state when the directory is missing.
**Evidence:**
```typescript
    // Validate the persisted vault path and register it with the backend.
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
```typescript
// vaultStore.ts:78-89 — still a raw, unvalidated read, but the effect above now validates it downstream
function readVaultPath(): string | null {
    // Migrate from the legacy unprefixed key on first run.
    const current = localStorage.getItem(VAULT_PATH_KEY);
    if (current !== null) return current;
    const legacy = localStorage.getItem("vaultPath");
    if (legacy !== null) {
        localStorage.setItem(VAULT_PATH_KEY, legacy);
        localStorage.removeItem("vaultPath");
        return legacy;
    }
    return null;
}
```

---

### BUG-G2: appearanceStore writes terminal colours in two separate localStorage calls
**Status:** FIXED-SINCE
**Severity:** Medium
**File:** `src/stores/appearanceStore.ts:270-280`
**Description:** All six terminal-colour setters (`setTerminalCustom`, `setTerminalHeaderBg`, `setTerminalLineBg`, `setTerminalBorder`, `setTerminalText`, `setTerminalMuted`) now route through `writeTerminalColors`, which serialises the full `{ custom, headerBg, lineBg, border, text, muted }` object into a single `localStorage.setItem` call under one key (`TERMINAL_COLORS_KEY = "tessellum:appearance:terminalColors"`). There is no longer a second, separate write for a "custom" flag, so a force-kill between writes can no longer leave the colour and the flag out of sync.
**Evidence:**
```typescript
    setTerminalHeaderBg: (terminalHeaderBg) => set((state) => {
        writeTerminalColors({
            custom: true,
            headerBg: terminalHeaderBg,
            lineBg: state.terminalLineBg,
            border: state.terminalBorder,
            text: state.terminalText,
            muted: state.terminalMuted,
        });
        return { terminalHeaderBg, terminalCustom: true };
    }),
```
```typescript
// appearanceStore.ts:185-187
function writeTerminalColors(colors: TerminalColors): void {
    localStorage.setItem(TERMINAL_COLORS_KEY, JSON.stringify(colors));
}
```

---

### BUG-G4: isDirty flag can be cleared after a subsequent keystroke
**Status:** FIXED-SINCE
**Severity:** Medium
**File:** `src/components/Editor/hooks/useEditorActions.ts:121-137`
**Description:** A per-path save-generation counter (`saveGenerationByPathRef`) is now bumped on every `handleContentChange` call (line 209) and snapshotted (`saveGen`) at the moment a save is kicked off. The `write_file` `.then()` callback only clears `isDirty` if the generation captured at save-completion still equals the generation at save-initiation, so a keystroke that lands while the write is in flight bumps the generation and prevents the stale completion from clearing the flag.
**Evidence:**
```typescript
        saveInFlightByPathRef.current.set(path, true);
        saveQueuedByPathRef.current.set(path, false);
        const saveGen = saveGenerationByPathRef.current.get(path) ?? 0;

        invoke('write_file', { path, vaultPath: vault, content: contentToWrite })
            .then(() => {
                lastPersistedContentByPathRef.current.set(path, contentToWrite);
                lastScheduledContentByPathRef.current.delete(path);

                if (activeNoteRef.current?.path === path) {
                    const currentGen = saveGenerationByPathRef.current.get(path) ?? 0;
                    if (currentGen === saveGen) {
                        setIsDirty(false);
                    }
                    setActiveNote({ ...noteSnapshot, last_modified: Math.floor(Date.now() / 1000) });
                }
            })
```

---

### BUG-S1: vaultPath stored under the unprefixed key `"vaultPath"`
**Status:** FIXED-SINCE
**Severity:** High
**File:** `src/stores/vaultStore.ts:54, 78-89`
**Description:** The active key is now the namespaced `"tessellum:vault:path"` (`VAULT_PATH_KEY`, declared at line 54). `readVaultPath()` performs a one-time migration: it prefers the new key, and only if that is absent does it fall back to the legacy bare `"vaultPath"` key, copying the value forward and deleting the old key — exactly the fix originally suggested.
**Evidence:**
```typescript
const VAULT_PATH_KEY = "tessellum:vault:path";
```
```typescript
function readVaultPath(): string | null {
    // Migrate from the legacy unprefixed key on first run.
    const current = localStorage.getItem(VAULT_PATH_KEY);
    if (current !== null) return current;
    const legacy = localStorage.getItem("vaultPath");
    if (legacy !== null) {
        localStorage.setItem(VAULT_PATH_KEY, legacy);
        localStorage.removeItem("vaultPath");
        return legacy;
    }
    return null;
}
```

---

### BUG-S2: Theme schedule timer closes over stale setting values
**Status:** FIXED-SINCE
**Severity:** Medium
**File:** `src/hooks/useApplyThemeSchedule.ts:118-127`
**Description:** `applyVariant` (called by every schedule branch — custom, sun, and system) now reads `themes`, `activeThemeName`, and `setActiveTheme` fresh from `useThemeStore.getState()` at fire time instead of relying on the values captured in the `useEffect` closure. A comment at the call site explicitly documents why.
**Evidence:**
```typescript
        const applyVariant = (variant: ThemeVariant) => {
            // Read live store values at fire time so a stale closure doesn't
            // overwrite a theme the user changed between timer setup and firing.
            const { themes: liveThemes, activeThemeName: liveName, setActiveTheme: liveSet } =
                useThemeStore.getState();
            const nextTheme = resolveThemeForVariant(liveThemes, liveName, variant);
            if (normalizeName(nextTheme) !== normalizeName(liveName)) {
                liveSet(nextTheme);
            }
        };
```
Note: `parseTimeToMinutes(themeScheduleLightStart, ...)` inside `applyCustomSchedule` (`useApplyThemeSchedule.ts:132-133`) still reads the hook-scoped `themeScheduleLightStart`/`themeScheduleDarkStart` closure variables rather than `useAppearanceStore.getState()`, but since the effect's dependency array includes both values, a change re-runs the whole effect (clearing and rescheduling the timer) rather than leaving a stale timer alive — so this does not reproduce the original bug.

---

### BUG-S3: `applyThemeAccent` snapshots appearance state once but acts on a stale check
**Status:** FIXED-SINCE
**Severity:** Medium
**File:** `src/stores/themeStore.ts:69-79`
**Description:** `applyThemeAccent` no longer caches `useAppearanceStore.getState()` in a local variable. It calls `useAppearanceStore.getState()` independently at each point of use — once inside the `force` branch and again in the `accentSource` check — so there is no stale snapshot for another store update to race against between the two reads.
**Evidence:**
```typescript
function applyThemeAccent(theme: ThemeDefinition, fallback: ThemeDefinition, force = false) {
    const accent = getAccentFromTheme(theme, fallback);
    if (!accent) return;
    if (force) {
        useAppearanceStore.getState().setAccentFromTheme(accent);
        applyAccentPaletteFromColor(accent);
        return;
    }
    if (useAppearanceStore.getState().accentSource !== "theme") return;
    applyAccentPaletteFromColor(accent);
}
```

---

### BUG-S4: navigationHistoryStore — `isReplaying` flag not set atomically
**Status:** FIXED-SINCE
**Severity:** Medium
**File:** `src/stores/navigationHistoryStore.ts:124-128`
**Description:** `goBack()` (and `goForward()`, identically) now sets `isReplaying: true` together with the new cursor/canGoBack/canGoForward values in a single `set()` call before `applyEntry()` runs, rather than setting the flag in one `set()`, calling `applyEntry()`, and updating the cursor in a separate later `set()`. Subscribers can no longer observe an intermediate state where the cursor has moved but `isReplaying` is still `false` (or vice versa).
**Evidence:**
```typescript
        // Set isReplaying and update cursor atomically before calling applyEntry
        // so that any subscribers see a consistent state (no intermediate render
        // between the flag set and the cursor update).
        set((current) => ({ isReplaying: true, ...withCursor(current, targetIndex) }));
        applyEntry(state.entries[targetIndex]);
```

---

### NEW-STORES-1: Git-sync password and AI provider API key are persisted in plaintext localStorage
**Status:** NEW
**Severity:** Critical
**File:** `src/stores/syncStore.ts:14-22, 79-82` and `src/stores/aiStore.ts:4-9, 77-80`, populated with real user input at `src/components/Settings/SyncSettings.tsx:23-32`
**Description:** `useSyncStore` and `useAIStore` both use Zustand's `persist` middleware with a `partialize` that keeps the entire `config`/`providerConfig` object — including a git remote `password` field (used as a GitHub/GitLab personal-access-token-style credential for HTTPS sync, per `SyncSettings.tsx`) and an AI provider `api_key` field respectively. Both are written to `localStorage` (a plaintext, unencrypted-at-rest store backed by a file on disk in the WebView's app-data directory) with no encryption, no OS keychain integration, and no opt-out. Any process with filesystem read access to the user's profile, or any XSS/supply-chain compromise of the webview content, can read these secrets directly. Severity note: this document otherwise reserves Critical for app-crashing/data-corrupting reliability failures (e.g. BUG-R1, BUG-R2 in the original analysis), and this finding doesn't crash the app or corrupt vault data — it sits on a different axis (confidentiality of a real, long-lived credential) that isn't directly comparable to that reliability bar. It's rated Critical on that separate axis because a leaked git or AI-provider credential can grant an attacker standing write access to the user's remote repositories or billed API usage, not because it threatens app stability; Task 8's synthesis should weigh it as a security-critical finding rather than ranking it against the doc's crash/corruption Criticals.
**Evidence:**
```typescript
// syncStore.ts:14-22
export interface GitSyncConfig {
    remoteUrl?: string;
    remoteName?: string;
    branch?: string;
    authorName?: string;
    authorEmail?: string;
    username?: string;
    password?: string;
}
```
```typescript
// syncStore.ts:79-82
        {
            name: "tessellum:sync",
            partialize: (s) => ({ config: s.config }),
        }
```
```typescript
// aiStore.ts:4-9
export interface AiProviderConfig {
    kind: "ollama" | "openai" | "claude";
    base_url: string;
    api_key?: string;
    model: string;
}
```
```typescript
// aiStore.ts:77-80
        {
            name: "tessellum:ai",
            partialize: (s) => ({ providerConfig: s.providerConfig }),
        }
```
```typescript
// src/components/Settings/SyncSettings.tsx:23-32 — confirms the password field is actually populated from user input
    const saveConfig = () => {
        setConfig({
            remoteUrl: remoteUrl.trim() || undefined,
            branch: branch.trim() || "main",
            authorName: authorName.trim() || undefined,
            authorEmail: authorEmail.trim() || undefined,
            username: username.trim() || undefined,
            password: password.trim() || undefined,
        });
    };
```
**Fix:** Exclude `password`/`api_key` from `partialize` (keep the rest of the config persisted, since those fields are not secret) and persist secrets separately via a Tauri secure-storage plugin (OS keychain/credential manager) accessed through an IPC command, never through `localStorage`.

---

### NEW-STORES-2: Recent-vault paths avoid the BUG-G1/BUG-S1 patterns, but stale entries are only pruned when actively selected
**Status:** NEW
**Severity:** Low
**File:** `src/stores/vaultStore.ts:58-67`, cross-referenced with the sole existence check at `src/hooks/useVaultSession.ts:121-134`
**Description:** The `recentVaultPaths` feature (commits `0487be1`, `8780866`) does **not** repeat BUG-S1's unprefixed-key mistake — it uses the namespaced `"tessellum:vault:recentPaths"` key — and does **not** repeat BUG-G1's total lack of validation either: `readRecentVaultPaths()` wraps `JSON.parse` in try/catch and structurally filters to an array of strings. However, unlike the primary `vaultPath` (which is existence-checked via `exists()` on every mount/change — see BUG-G1 above), entries in `recentVaultPaths` are only pruned when that specific path becomes the *active* `vaultPath` and fails the `exists()` check in `useVaultSession.ts:121-134` (which calls `removeRecentVaultPath`). A path that the user never re-selects — e.g. a vault folder that was deleted or moved — has no passive validation path and will sit in the switcher's "Recent Vaults" list indefinitely (bounded only by the 6-entry cap being pushed out by newer vaults), rather than being detected and removed proactively.
**Evidence:**
```typescript
function readRecentVaultPaths(): string[] {
    try {
        const raw = localStorage.getItem(RECENT_VAULTS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string") : [];
    } catch {
        return [];
    }
}
```
```typescript
// useVaultSession.ts:121-134 — the only existence check in the codebase, and it only fires for the currently-active vaultPath
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
**Fix:** When the switcher popover opens (or when `recentVaultPaths` is first read), batch-check each entry with `exists()` and call `removeRecentVaultPath` for any that no longer resolve, instead of relying solely on the reactive check that only covers the currently-selected path.

---

### NEW-STORES-3: Unguarded `JSON.parse` on a corrupted `expandedFolders` entry aborts the rest of vault-open workspace restoration
**Status:** NEW
**Severity:** Medium
**File:** `src/hooks/useVaultSession.ts:79-106`, within the outer try/catch at `src/hooks/useVaultSession.ts:65, 115-117`, gating the effects at `src/hooks/useVaultSession.ts:203-210` and `src/hooks/useVaultSession.ts:213-224`
**Description:** Inside `refreshFiles`'s `restoreState` branch, `storedOpenTabs` is parsed inside its own local `try/catch` (so a corrupted tabs entry degrades gracefully), but `storedExpanded` (the persisted `expandedFolders` map) is parsed with a bare `JSON.parse(storedExpanded)` with no local guard. `refreshFiles` is wrapped in one outer `try/catch` (`useVaultSession.ts:65` / `115-117`), so a malformed `expandedFolders` value (hand-edited, corrupted by a partial write, or from an incompatible future format) throws, is caught by the outer handler, and is only `console.error`'d — but everything after the throw point never runs for that call, including `setWorkspaceRestored(true)` (line 112) and `seedTemplatesIfEmpty` (line 113). Since `workspaceRestored` gates both the periodic index-sync effect (`useVaultSession.ts:203-210`) and the effect that persists workspace state back to localStorage (`useVaultSession.ts:213-224`), a single corrupted `expandedFolders` entry silently disables periodic sync and stops persisting *any* workspace state (open tabs, view mode, last note, etc.) for that vault session until the app is restarted or the vault is re-selected.
**Evidence:**
```typescript
                const storedExpanded = localStorage.getItem(`${keyPrefix}:expandedFolders`);
                const storedViewMode = localStorage.getItem(`${keyPrefix}:viewMode`);
                const storedEditorMode = localStorage.getItem(`${keyPrefix}:editorMode`);
                const storedOpenTabs = localStorage.getItem(`${keyPrefix}:openTabs`);
                const storedActiveTabPath = localStorage.getItem(`${keyPrefix}:activeTabPath`);
                const storedLastNote = localStorage.getItem(`${keyPrefix}:lastNote`);

                if (storedExpanded) {
                    setExpandedFolders(JSON.parse(storedExpanded));
                }
                if (storedViewMode === "graph" || storedViewMode === "editor" || storedViewMode === "canvas") {
                    setViewMode(storedViewMode);
                }
                setEditorMode(isEditorMode(storedEditorMode) ? storedEditorMode : DEFAULT_EDITOR_MODE);

                let restoredTabs = false;
                if (storedOpenTabs) {
                    try {
                        const parsedTabs = JSON.parse(storedOpenTabs);
                        if (Array.isArray(parsedTabs)) {
                            const tabPaths = parsedTabs.filter((tabPath): tabPath is string => typeof tabPath === "string");
                            restoreWorkspaceTabs(tabPaths, storedActiveTabPath ?? storedLastNote);
                            restoredTabs = true;
                        }
                    } catch (e) {
                        console.error(e);
                    }
                }
```
**Fix:** Wrap the `storedExpanded` parse in the same local try/catch pattern used for `storedOpenTabs`, falling back to `{}` on failure, so a corrupted `expandedFolders` entry can't abort the rest of the restoration sequence.

---

### NEW-STORES-4: `appearanceStore` syntax-highlight and inline-code colour setters still have BUG-G2's non-atomic two-write pattern
**Status:** NEW
**Severity:** Low
**File:** `src/stores/appearanceStore.ts:325-329, 364-368`
**Description:** BUG-G2 was fixed for the six *terminal* colour setters by consolidating them onto a single `writeTerminalColors` call per setter (see BUG-G2 above). The seven *syntax* colour setters (`setSyntaxComment`, `setSyntaxKeyword`, `setSyntaxOperator`, `setSyntaxString`, `setSyntaxNumber`, `setSyntaxVariable`, `setSyntaxFunction`) and `setInlineCodeColor` were not migrated to the same fix — each still makes two separate, non-atomic `localStorage.setItem` calls (one for the colour value, one for its own `"...Custom"` flag). A force-kill between the two calls leaves the colour value persisted but its custom flag still `false`, so the custom colour is silently overridden by the active theme's default on next launch — the exact failure mode BUG-G2 originally described, just for a different set of fields. Rated Low rather than BUG-G2's Medium because the blast radius is narrower: syntax/inline-code colours are cosmetic editor-theming preferences with no functional impact beyond the colour reverting, whereas BUG-G2's terminal colours were more visibly and frequently toggled together as a themed unit, making the inconsistency more noticeable in practice.
**Evidence:**
```typescript
    setSyntaxComment: (syntaxComment) => set(() => {
        localStorage.setItem(SYNTAX_COMMENT_KEY, syntaxComment);
        localStorage.setItem(SYNTAX_CUSTOM_KEY, "true");
        return { syntaxComment, syntaxCustom: true };
    }),
```
```typescript
    setInlineCodeColor: (inlineCodeColor) => set(() => {
        localStorage.setItem(INLINE_CODE_COLOR_KEY, inlineCodeColor);
        localStorage.setItem(INLINE_CODE_CUSTOM_KEY, "true");
        return { inlineCodeColor, inlineCodeCustom: true };
    }),
```
**Fix:** Apply the same `writeTerminalColors`-style consolidation: serialise each colour group (syntax colours + their custom flag; inline-code colour + its custom flag) into a single JSON blob under one localStorage key, written with one `setItem` call per setter.
