# UI Improvements — Version History Diff & Settings Polish

This document describes the features added in this change set, what each one does,
and step‑by‑step instructions for testing them as a user.

To try everything below, start the app in development mode:

```bash
npm run tauri dev
```

Open a vault (or create one) so you have at least one note to work with.

---

## 1. Version History — Diff View

### What it does

The note **Version History** panel now compares an older snapshot against the
**current note** and shows the differences GitHub‑style:

- **Added text** (present in the current note but not in the snapshot) is shown on
  **green** lines, prefixed with `+`.
- **Removed text** (present in the snapshot but not in the current note) is shown on
  **red** lines, prefixed with `-`.
- **Unchanged context** lines are shown plainly.
- Within a modified line, only the **specific words that changed** are highlighted
  with a stronger green/red background (word‑level diff), so you can see exactly
  what was edited.

The panel keeps a **Diff / Full** toggle:

- **Diff** (default) — the unified diff described above.
- **Full** — the original plain‑text preview of the snapshot's full content.

The panel was also widened (so the diff is readable) and restyled to use the
application's standard panel theme tokens, so it matches the rest of the app in
light mode, dark mode, and high‑contrast mode. The existing **Restore**,
**Pin with label**, and **Unpin** actions are unchanged.

### How the diff is oriented

The selected snapshot is treated as the **"before"** and the current note as the
**"after"**. So:

- Lines you have **added since** that snapshot appear green.
- Lines you have **deleted since** that snapshot appear red.

### How to test it

1. Open any note and type some content.
2. Save the note (it auto‑saves; each save creates a snapshot). Make a few rounds of
   edits with a save between each so you build up several snapshots.
   - Tip: make meaningful edits — add a paragraph, delete a sentence, and change a
     few words within a line — so the diff has something interesting to show.
3. Click the **History** button in the editor header (clock/history icon, top‑right).
4. The panel opens on the right and is noticeably wider than before.
5. Pick an **older snapshot** from the list on the left.
6. Confirm the **Diff** view is shown by default:
   - New lines are green with a `+`.
   - Removed lines are red with a `-`.
   - In lines you only partially edited, just the changed words are highlighted.
7. Click **Full** in the toggle at the top of the preview → you should see the
   snapshot's full plain text instead of the diff. Click **Diff** to switch back.
8. Select a snapshot **identical** to the current note (e.g. the most recent one
   before any new edits) → the diff area shows
   *"No differences — this version matches the current note."*
9. Click **Restore this version** → the editor content is replaced with the snapshot
   and the panel closes. (Restore/Pin/Unpin behave exactly as before.)
10. **Theme check:** switch between light, dark, and high‑contrast themes
    (Settings → Appearance) and reopen the diff — the green/red colors stay legible
    in every theme.

### Edge cases handled

- Very large notes are capped before diffing (so the panel stays fast); when this
  happens a *"…diff truncated (note is very large)"* note appears at the bottom.
- Selecting a snapshot with no changes shows the "no differences" message instead of
  an empty pane.

---

## 2. Settings — Consistent UI for Sync, Export/Import, and AI

### What it does

Three recently‑added settings pages were rebuilt to match the look and feel of the
established settings pages (General, Editor, Appearance). Previously they used
ad‑hoc inline styles — inconsistent padding, font sizes, corner radius, wrong
background colors, duplicated button styles, and status text squeezed next to
buttons. They now use a shared set of reusable components, so spacing, inputs,
buttons, and status messages are uniform across the whole Settings area and adapt
correctly to every theme.

The affected pages:

- **Settings → Sync** (Git sync configuration)
- **Settings → Export/Import** (DOCX export, import from URL)
- **Settings → AI** (AI writing‑assistant provider configuration)

New shared building blocks (used internally; no behavior change to the settings
themselves):

- **Text input field** — labelled, full‑width, with optional helper description.
- **Select field** — labelled dropdown with the same styling.
- **Button** — standard primary/secondary button.
- **Status message** — a consistent line shown *below* the action buttons, colored
  red for errors and muted for neutral/success messages.

> **Important:** Only the visual presentation changed. All actions (initialize repo,
> sync, export, import, and AI provider settings) work exactly as they did before.

### How to test it

**General check (applies to all three pages):**

1. Open **Settings** (gear icon or shortcut).
2. Visit **General**, **Editor**, and **Appearance** first to remind yourself of the
   standard look (section headings, input sizing, spacing).
3. Now open **Sync**, **Export/Import**, and **AI** and confirm they share the same:
   - input height, padding, font size, and rounded corners,
   - section titles/descriptions and vertical spacing,
   - button styling,
   - background/border/text colors (check in light **and** dark mode).

**Sync page:**

1. Go to **Settings → Sync**.
2. Confirm the fields (Remote URL, Branch, Author Name/Email, Username,
   Password/Token) all render as consistent labelled inputs.
3. Click **Initialize Repo** → a status message appears **below** the buttons
   (e.g. "Repository initialized."), not crammed beside them.
4. Enter a remote URL and click **Sync Now** → the button shows "Syncing…" while
   busy; the result/error appears as a status line below (errors in red).

**Export/Import page:**

1. Open a note, then go to **Settings → Export/Import**.
2. Confirm the **Active note** path is shown as a clean description line in the
   Export section.
3. Click **Export as DOCX** → status ("Exported to …" or an error in red) appears
   below the button.
4. In the Import section, paste a web page URL and click **Import from URL** → the
   button shows "Importing…" and the result/error appears below it.

**AI page:**

1. Go to **Settings → AI**.
2. Change **Provider** between *Ollama (local)* and *OpenAI / compatible API*.
   - The **Base URL** helper text and placeholders update accordingly.
   - The **API Key** field appears only when *OpenAI* is selected.
3. Confirm **Base URL**, **Model**, and **API Key** are consistent labelled inputs
   with helper text underneath the relevant ones.
4. Confirm the **How to use** tips section still renders, including the inline
   `code` chips.

---

## Files changed (for reference)

**Version history diff**

- `package.json` — added the `diff` library.
- `src/styles/globals.css` — added `--color-diff-*` color tokens (light, dark, and
  high‑contrast).
- `src/components/history/computeDiff.ts` — diff computation helper *(new)*.
- `src/components/history/DiffView.tsx` — unified diff renderer *(new)*.
- `src/components/history/NoteHistoryPanel.tsx` — widened panel, Diff/Full toggle,
  diff against current note, theme‑token fixes.
- `src/components/Editor/Editor.tsx` — supplies the live note content to the panel.

**Settings UI**

- `src/components/Settings/items/TextInputSetting.tsx` *(new)*
- `src/components/Settings/items/SelectSetting.tsx` *(new)*
- `src/components/Settings/items/SettingButton.tsx` *(new)*
- `src/components/Settings/items/SettingStatus.tsx` *(new)*
- `src/components/Settings/AISettings.tsx` — rebuilt with shared components.
- `src/components/Settings/SyncSettings.tsx` — rebuilt with shared components.
- `src/components/Settings/ExportImportSettings.tsx` — rebuilt with shared components.

---

## Notes on verification

- TypeScript: production source typechecks cleanly (`npx tsc --noEmit`; the only
  reported errors are in pre‑existing `*.test.*`/`e2e` files).
- Build: `npx vite build` succeeds and bundles the new `diff` dependency.
- The automated frontend test suite (`npm test`) is currently failing for a
  pre‑existing, environment‑level reason (`localStorage` undefined in
  `src/test/setup.ts`) that is unrelated to these changes — so the features above
  are best validated manually using the steps in this document.
