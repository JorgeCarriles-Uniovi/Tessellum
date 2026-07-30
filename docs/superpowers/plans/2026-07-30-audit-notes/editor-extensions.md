## Editor Extensions

### BUG-U4: Wikilinks display the full path instead of only the last segment
**Status:** FIXED-SINCE
**Severity:** Medium
**File:** `src/components/Editor/extensions/wikilink/wikiLink-parser.ts:40-68`
**Description:** `parseWikiLink` now auto-generates an alias from the last path segment when the target contains `/` and no explicit `|` alias was given, matching the standard Obsidian/Logseq behavior the original bug asked for.
**Evidence:**
```typescript
const target = inner.trim();
// When the target includes a path separator, display only the last segment
// (e.g. [[Projects/2024/Meeting Notes]] shows "Meeting Notes").
// An explicit pipe alias always overrides this default.
const alias = target.includes('/')
    ? target.split('/').pop()
    : undefined;

return { target, alias };
```

---

### BUG-E1: Task list checkbox toggle logic naming is ambiguous and error-prone
**Status:** FIXED-SINCE
**Severity:** High
**File:** `src/components/Editor/extensions/task-list/task-list-parser.ts:52-58`
**Description:** The parameter was renamed from `checked` to `currentlyChecked` with a doc comment clarifying it returns the marker for the *opposite* state, and the single call site (`task-list-plugin.tsx:38`) passes `range.checked`, which is the item's current parsed state from `findTaskListItems`, not a desired new state — so the toggle direction is correct.
**Evidence:**
```typescript
// task-list-parser.ts:52-58
/**
 * Returns the marker string for the OPPOSITE (toggled) state.
 * @param currentlyChecked - whether the task is currently checked
 */
export function getToggledTaskMarker(_marker: string, currentlyChecked: boolean): string {
    return currentlyChecked ? "- [ ]" : "- [x]";
}
```
```typescript
// task-list-plugin.tsx:33-42 — the only call site
function toggleTaskItem(view: EditorView, range: TaskListPreviewRange): void {
    view.dispatch({
        changes: {
            from: range.markerStart,
            to: range.markerEnd,
            insert: getToggledTaskMarker(range.marker, range.checked),
        },
    });
    view.focus();
}
```

---

### BUG-E2: Greedy backtick parser copy-pasted into three files — wikilinks appear inside code spans
**Status:** FIXED-SINCE
**Severity:** Medium
**File:** `src/utils/inlineCodeSpans.ts:12-53` (new shared utility)
**Description:** The three duplicated `collectInlineCodeTextSpans`-style implementations were deduplicated into a single `collectInlineCodeSpansForLine` in `src/utils/inlineCodeSpans.ts`, imported by `wikiLink-parser.ts`, `markdown-preview-plugin.ts`, and `media-embed-plugin.ts`. The mismatched-backtick-run bug is also fixed: a backtick run of a different length than the opener no longer extends the span to end-of-line — instead the scanner simply keeps looking for a matching-length closer and only emits a span when a matched pair is found, so unclosed/mismatched runs never suppress the rest of the line.
**Evidence:**
```typescript
// src/utils/inlineCodeSpans.ts:33-48
if (!inCode) {
    inCode = true;
    delimiterLen = runLen;
    codeStart = runStart;
} else if (runLen === delimiterLen) {
    // Matching closer — emit the span and reset.
    spans.push({ from: codeStart, to: i });
    inCode = false;
    delimiterLen = 0;
    codeStart = -1;
}
// Different-length run while inCode: treat as a new potential opener
// instead of extending the unclosed span to EOL.
```
Confirmed shared import in all three files:
```
src/components/Editor/extensions/wikilink/wikiLink-parser.ts:2:import { collectInlineCodeSpansForLine } from "../../../../utils/inlineCodeSpans";
src/components/Editor/extensions/markdown-preview-plugin.ts:16:import { collectInlineCodeSpansForLine } from "../../../utils/inlineCodeSpans";
src/components/Editor/extensions/media-embed-plugin.ts:15:import { collectInlineCodeSpansForLine } from "../../../utils/inlineCodeSpans";
```

---

### BUG-E3: Terminal callout syntax highlighting shifts on CRLF line endings (Windows)
**Status:** FIXED-SINCE
**Severity:** Medium
**File:** `src/components/Editor/extensions/callout/callout-plugin.ts:144-193`
**Description:** Before joining callout content lines for syntax highlighting, the code now strips `\r` (normalizes CRLF/CR to LF) so token offsets computed by the parser line up with the character positions in the LF-joined `lines` array used by the `lineStart += len + 1` offset-tracking loop.
**Evidence:**
```typescript
// callout-plugin.ts:148-153
// Normalize CRLF → LF before computing offsets so that
// token positions produced by the parser match character
// indices in `lines`.
const fullCode = block.contentLines.join("\n").replace(/\r\n?/g, "\n");
const tree = langDesc.support.language.parser.parse(fullCode);
const lines = fullCode.split("\n");
```

---

### BUG-E4: Frontmatter and task-list React widgets — deferred unmount causes remount race
**Status:** FIXED-SINCE
**Severity:** Medium
**File:** `src/components/Editor/extensions/frontmatter/frontmatter-widget.tsx:448-490`, `src/components/Editor/extensions/task-list/task-list-plugin.tsx:51-97`
**Description:** Both widgets now set a `destroyed = true` flag synchronously inside `destroy()`, and the deferred `setTimeout(..., 0)` callback checks `if (this.destroyed) root.unmount()` before unmounting. Since CodeMirror re-adopts the DOM node into a new widget instance synchronously (which would reset `destroyed` to `false` on the *new* instance, not the old one), the old instance's flag correctly stays `true` and its unmount proceeds without racing a new widget's render.
**Evidence:**
```typescript
// frontmatter-widget.tsx:480-489
destroy(_dom: HTMLElement) {
    this.destroyed = true;
    const root = this.root;
    this.root = null;
    if (root) {
        setTimeout(() => {
            if (this.destroyed) root.unmount();
        }, 0);
    }
}
```
```typescript
// task-list-plugin.tsx:86-97
destroy(): void {
    this.destroyed = true;
    const root = this.root;
    this.root = null;
    this.dom = null;

    if (root) {
        setTimeout(() => {
            if (this.destroyed) root.unmount();
        }, 0);
    }
}
```

---

### BUG-E5: Table formatter miscalculates column width when cells contain escaped pipes
**Status:** FIXED-SINCE
**Severity:** Low
**File:** `src/components/Editor/extensions/table/table-navigation.ts:37-46`
**Description:** `formatTable` now computes column padding width via `cellDisplayWidth`, which strips `\|` down to `|` before measuring `.length`, so escaped pipes (2 raw chars, 1 displayed char) no longer over-pad the column.
**Evidence:**
```typescript
// table-navigation.ts:37-46
// Compute max width per column.
// Escaped pipes (\|) are 2 chars in raw text but display as 1, so measure
// display width rather than raw length.
const cellDisplayWidth = (cell: string) => cell.replace(/\\\|/g, "|").length;
const colWidths: number[] = new Array(table.columnCount).fill(0);
// Only measure header + data rows for width (not separator)
[parsed[0], ...parsed.slice(2)].forEach((row) => {
    row.forEach((cell, i) => {
        colWidths[i] = Math.max(colWidths[i], cellDisplayWidth(cell), 3);
    });
});
```

---

### BUG-U2: Code block (and other fenced blocks) inside a callout breaks rendering
**Status:** FIXED-SINCE
**Severity:** High
**File:** `src/components/Editor/extensions/callout/callout-parser.ts:41-80`
**Description:** Re-confirmed fixed (this session had already verified this in an earlier task; included here with a fresh citation since this file lives in the editor-extensions area). The continuation scanner now tracks an open fence marker (` ``` ` or `~~~`) and keeps consuming lines that don't start with `>` while a fence is open, so a fenced code/mermaid/KaTeX/HTML block nested inside a callout no longer terminates the callout early.
**Evidence:**
```typescript
// callout-parser.ts:41-80
// Scan continuation lines.
// Track open fenced blocks (``` or ~~~) so their interior lines
// are not mistaken for the end of the callout even when they
// don't start with '>'.
let nextPos = line.to + 1;
let fenceMarker: string | null = null;
while (nextPos <= state.doc.length) {
    const nextLine = state.doc.lineAt(nextPos);
    const contMatch = nextLine.text.match(CALLOUT_CONTINUATION_RE);
    if (contMatch) {
        const stripped = contMatch[1];
        if (contentFrom === -1) contentFrom = nextLine.from;
        contentLines.push(stripped);
        contentTo = nextLine.to;
        nextPos = nextLine.to + 1;
        // Detect fence open/close for ``` or ~~~
        const fenceMatch = stripped.match(/^(`{3,}|~{3,})/);
        if (fenceMatch) {
            const marker = fenceMatch[1][0].repeat(3);
            if (fenceMarker === null) {
                fenceMarker = marker;
            } else if (fenceMarker === marker) {
                fenceMarker = null;
            }
        }
    } else if (fenceMarker !== null) {
        // Inside a fenced block — continuation lines don't need '>'
        const stripped = nextLine.text;
        if (contentFrom === -1) contentFrom = nextLine.from;
        contentLines.push(stripped);
        contentTo = nextLine.to;
        nextPos = nextLine.to + 1;
        const fenceMatch = stripped.match(/^(`{3,}|~{3,})/);
        if (fenceMatch && fenceMatch[1][0].repeat(3) === fenceMarker) {
            fenceMarker = null;
        }
    } else {
        break;
    }
}
```

---

### BUG-G3: Media embed plugin — in-flight Tauri invoke not cancelled on view destruction
**Status:** FIXED-SINCE
**Severity:** Medium
**File:** `src/components/Editor/extensions/media-embed-plugin.ts:511-612`
**Description:** The view plugin now carries a `destroyed` flag set synchronously in `destroy()`, and `resolvePending` checks it before every `await` continuation, `resolvedPathCache`/`resolvedSrcCache` write, and `view.dispatch`. New requests arriving while a resolve loop is in-flight are also no longer dropped: `checkPending` adds them to the shared `pendingRequests` map, and `resolvePending`'s `while (pendingRequests.size > 0)` loop drains it repeatedly (via `resolveInProgress` re-entrancy guard) rather than clearing it once and exiting after a single pass.
**Evidence:**
```typescript
// media-embed-plugin.ts:511-523
destroy() {
    this.destroyed = true;
    this.view.dom.removeEventListener("focusin", this.onFocusIn);
    this.view.dom.removeEventListener("focusout", this.onFocusOut);
    this.view.dom.removeEventListener("keydown", this.onUserInteract);
    this.view.dom.removeEventListener("pointerdown", this.onUserInteract);
    for (const value of resolvedSrcCache.values()) {
        if (value && value.startsWith("blob:")) {
            URL.revokeObjectURL(value);
        }
    }
    resolvedSrcCache.clear();
}

async resolvePending(view: EditorView) {
    // Only one resolution loop at a time. New items added to
    // pendingRequests during an in-flight run will be picked up
    // by the while-loop's next iteration.
    if (this.resolveInProgress) return;
    this.resolveInProgress = true;

    try {
        while (pendingRequests.size > 0) {
            if (this.destroyed) return;

            const requests = Array.from(pendingRequests.values());
            pendingRequests.clear();
            ...
```
(guard is repeated at every `await` point through line 612)

---

### NEW-EDITOR-1: Heading fold widget still has the deferred-unmount-without-guard race that BUG-E4 fixed elsewhere
**Status:** NEW
**Severity:** Medium
**File:** `src/components/Editor/extensions/markdown-heading-fold.ts:163-170`
**Description:** `HeadingFoldWidget.destroy()` unmounts its React root (`iconRoot`, holding a `lucide-react` `ChevronRight` icon) inside a bare `setTimeout(..., 0)` with no synchronous `destroyed` flag guard — exactly the pattern BUG-E4 identified and which was fixed in `frontmatter-widget.tsx` and `task-list-plugin.tsx` (see BUG-E4 above). If CodeMirror recreates a `HeadingFoldWidget` at the same document position before the timeout fires (e.g. rapid heading fold/unfold toggling, or a doc edit that keeps the fold decoration's `from`/`to` unchanged so a new widget instance is created at the same spot), the deferred `iconRoot.unmount()` can fire after a new root has already been created for that DOM node, producing the same "unmounting a root that's been adopted by a new render" React warning/corruption that BUG-E4 called out.
**Evidence:**
```typescript
// markdown-heading-fold.ts:163-170
destroy(): void {
    const iconRoot = this.iconRoot;
    this.iconRoot = null;
    if (iconRoot) {
        // Defer unmount to avoid React warning when CodeMirror tears down during a render pass.
        setTimeout(() => iconRoot.unmount(), 0);
    }
}
```
**Fix:** Add a `private destroyed = false;` field, set it to `true` synchronously at the start of `destroy()`, and check `if (this.destroyed) iconRoot.unmount();` inside the timeout callback — mirroring the fix already applied to `FrontmatterWidget` and `TaskListCheckboxWidget`.

---

### NEW-EDITOR-2: Mermaid widget can leak a panzoom instance and its event listeners if destroyed before rendering finishes
**Status:** NEW
**Severity:** Low
**File:** `src/components/Editor/extensions/code/mermaid-plugin.ts:97-131`
**Description:** `MermaidWidget.toDOM` kicks off an async `mermaid.render(...)` chain that, once resolved, creates a `panzoom` instance on the rendered SVG and stores it on `this.panzoomInstance`. `destroy()` disposes `this.panzoomInstance` if one exists at destroy-time, but there is no flag to prevent the `.then()` callback from running *after* `destroy()` has already been called. If the widget is torn down while `mermaid.render` is still in flight (e.g. the user switches notes or the block scrolls out of view while a complex diagram is still rendering), the callback still executes, attaches a brand-new `panzoom` instance (with its own pointer/wheel event listeners) to an SVG element inside a `container`/`wrapper` that is now detached from the document, and that instance is never disposed — `destroy()` already ran and won't run again.
**Evidence:**
```typescript
// mermaid-plugin.ts:97-118 (toDOM)
Promise.resolve()
    .then(() => mermaid.render(this.id, this.code))
    .then(({ svg }) => {
        container.innerHTML = svg;
        const svgElement = container.querySelector("svg");
        if (svgElement) {
            // Initialize panzoom
            this.panzoomInstance = panzoom(svgElement, {
                maxZoom: 15,
                minZoom: 0.1,
                bounds: true,
                boundsPadding: 0.1,
            });
        }
    })
    .catch((error) => {
        renderMermaidError(container, error);
    });

return wrapper;
```
```typescript
// mermaid-plugin.ts:120-131 (destroy)
destroy(_dom: HTMLElement) {
    if (this.panzoomInstance) {
        this.panzoomInstance.dispose();
        this.panzoomInstance = undefined;
    }
    ...
}
```
**Fix:** Add a `private destroyed = false` flag set synchronously in `destroy()`, and check it at the top of the `.then(({ svg }) => ...)` callback before touching `container`/creating the `panzoom` instance — skip the work entirely (or dispose immediately) when the widget has already been destroyed.

---

### NEW-EDITOR-3: Media paste plugin inserts embed markdown at a stale selection captured before async asset saves
**Status:** NEW
**Severity:** Medium
**File:** `src/components/Editor/extensions/media-paste-plugin.ts:97-130`
**Description:** On paste, `selection` is captured once from `view.state.selection.main` before the async `handlePaste` loop runs. Each pasted file then goes through `await file.arrayBuffer()` and `await invoke("save_asset", ...)` sequentially (multiple IPC round trips for multi-file pastes). Only after *all* files are saved does the code `view.dispatch` an insert using the original `selection.from`/`selection.to`. If the user types, moves the cursor, or otherwise edits the document during that window (a paste of a large image or several files can take a perceptible amount of time), the embed markdown is inserted at the stale position — which, in the case of typed input shifting offsets, can now point at different content than what was selected/at-cursor when the paste started, or (case of a shortened document) throw/clamp unexpectedly since CodeMirror rejects out-of-range change positions.
**Evidence:**
```typescript
// media-paste-plugin.ts:97-99
const selection = view.state.selection.main;
const timestamp = formatTimestamp(new Date());
const embeds: string[] = [];

// ...101-121: for each file, `await file.arrayBuffer()` then `await invoke("save_asset", ...)`...

// media-paste-plugin.ts:125-130
const insertText = embeds.join("\n");
view.dispatch({
    changes: { from: selection.from, to: selection.to, insert: insertText },
    selection: { anchor: selection.from + insertText.length },
    userEvent: "input.paste",
});
```
**Fix:** Re-read `view.state.selection.main` immediately before the final `dispatch` (or map the originally-captured selection forward through any transactions that occurred during the awaits via `changes.mapPos`/tracking a running document version) instead of reusing the position captured at paste-start.

---

### NEW-EDITOR-4: Callout collapse/expand state is keyed by line number, so unrelated edits above a callout silently reset its fold state
**Status:** NEW
**Severity:** Low
**File:** `src/components/Editor/extensions/callout/callout-state.ts:23-26`, used from `src/components/Editor/extensions/callout/callout-plugin.ts:62-65`
**Description:** `calloutKey(filePath, headerText, lineOffset)` builds the localStorage lookup key for a callout's collapsed/expanded state using `block.headerLineNumber` as `lineOffset`. That line number is not stable — inserting or deleting any line above the callout (anywhere earlier in the document) shifts its header to a new line number, which produces a different storage key. `isCollapsed` then finds no entry for the new key and silently falls back to `defaultCollapsed` (derived from the `+`/`-` fold-char in the callout syntax), so a callout the user had manually collapsed or expanded can revert to its default state after an edit elsewhere in the note, with no user-visible cause.
**Evidence:**
```typescript
// callout-state.ts:23-26
/** Build a stable key for a callout using its content hash. */
export function calloutKey(filePath: string, headerText: string, lineOffset: number): string {
    return `${filePath}::${lineOffset}::${headerText}`;
}
```
```typescript
// callout-plugin.ts:62-65 — call site, using the header's line number
const key = calloutKey(filePath, `${block.type}:${block.title}`, block.headerLineNumber);
const defaultCollapsed = block.foldChar === "-";
const collapsed = isCollapsed(key, defaultCollapsed);
```
**Fix:** Key on something stable across unrelated edits — e.g. a hash of the callout's own header text plus its ordinal index among same-header callouts in the file, or (more robustly) an explicit ID embedded in the callout syntax — instead of the header's current line number.

---
