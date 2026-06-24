# Tessellum — Feature Guide (Tracks C & D)

This guide documents the major features added in the recent feature commits — what
each one does and exactly how to test it as a user. It complements
[`UI_IMPROVEMENTS.md`](./UI_IMPROVEMENTS.md), which covers the version‑history diff
view and the settings UI polish.

## Getting started

Launch the app in development mode and open (or create) a vault with a few notes:

```bash
npm run tauri dev
```

Some features are reached from the **command palette** (open it with the search
icon in the title bar) and others from **Settings** (gear icon in the sidebar
footer). The features that need an extra service or screen size are called out in
each section.

### Prerequisite for AI features (D4, D5, D12)

The AI Writing Assistant, Auto‑Tagging, and Vault Q&A call a language model. Two
providers are supported:

- **Ollama (local, default)** — install Ollama, run `ollama serve`, and pull a
  model (e.g. `ollama pull llama3`). Default endpoint `http://localhost:11434`.
- **OpenAI / compatible API** — set the base URL, model, and API key.

Configure this once in **Settings → AI Assistant** before testing D4/D5/D12.

---

## C1 — Index Status Badge

**What it does:** Shows a small live badge in the bottom status bar reporting how
many Markdown notes are indexed in the local search/database index, whether any
files are out of date, and whether an indexing pass is currently running. It polls
the backend (`get_index_status`) every 8 seconds.

States you may see:
- **"Indexing…"** (accent color) while a vault sync/index is in progress.
- **"N/M indexed"** when some files are stale (newer on disk than in the index).
- **"N indexed"** when everything is up to date.

**How to test:**
1. Open a vault. Look at the bottom **status bar** — the badge appears with a small
   database icon.
2. Add or edit several `.md` files (in the app or directly on disk) and watch the
   badge briefly switch to "Indexing…" / a stale count, then settle on
   "N indexed".
3. Hover the badge to see a tooltip with the exact counts.

---

## C4 — Multi‑Device Vault Sync (Git)

**What it does:** Syncs your whole vault across devices using a normal Git remote.
It can initialize a Git repo in the vault (writing a `.gitignore` that excludes
internal `.tessellum`/`.git`/`.trash` folders), commit local changes, fetch, fast‑
forward/merge, and push — all from inside the app. A **one‑click "Sync Now"** runs
the full commit → pull → push cycle (`full_git_sync`). A status badge in the status
bar shows ahead/behind/conflict state and lets you trigger a sync by clicking it.

**How to test:**
1. Create an empty repository on a Git host (e.g. GitHub) and copy its HTTPS URL.
2. Open **Settings → Sync** and fill in:
   - **Remote URL** (the repo URL),
   - **Branch** (defaults to `main`),
   - **Author Name/Email** (used for commits),
   - **Username** + **Password/Token** (a personal access token for HTTPS; leave
     blank to use your SSH agent).
3. Click **Initialize Repo** → status shows "Repository initialized." below the
   buttons.
4. Click **Sync Now** → it commits, pulls, and pushes. Status reports either
   "Sync complete — already up to date." or "…remote changes applied."
5. Verify on the host that your notes were pushed.
6. Watch the **status bar** badge: it shows "Synced", "N Ahead", "N Behind",
   "Conflicts", or a diverged indicator. Click the badge to run a sync directly.
7. To test multi‑device behavior, clone the same remote into a second vault (or
   change a file on the host) and **Sync Now** again — remote changes are merged
   into your local vault.

> Conflicts are surfaced (count + list); resolve them in the files, then sync again.

---

## D1 — Dataview Code Blocks (live SQLite queries)

**What it does:** A fenced ` ```dataview ` code block in a note is replaced, in the
rendered editor, by a **live result table/list** generated from your vault's index
(via `execute_dataview_query`). Results update as the document changes.

**Supported query DSL** (one clause per line):
- `TABLE col1, col2` / `LIST` / `CALENDAR field` — choose the view.
- `WHERE tag = "value"` — filter by tag.
- `WHERE folder = "path"` — filter by folder.
- `WHERE propname = "value"` — filter by a frontmatter property.
- `WHERE propname contains "value"` — substring match on a property.
- `SORT field [DESC]` — order results.
- `LIMIT n` — cap the number of rows.

**How to test:**
1. Make sure a few notes have tags (e.g. `#project`) or frontmatter properties.
2. In a note, add a fenced block:
   ````markdown
   ```dataview
   TABLE status, due
   WHERE tag = "project"
   SORT due DESC
   LIMIT 10
   ```
   ````
3. The block renders as a table of matching notes with a result count. Try a
   `LIST` view, a `WHERE folder = "Projects"` filter, or a `contains` clause.
4. Edit a matching note's tag/property and confirm the table updates.
5. Enter an invalid clause to confirm the inline "Dataview error" message appears.

---

## D2 — Note Properties Panel

**What it does:** In the right sidebar, a collapsible **Properties** section shows
the active note's YAML frontmatter fields as typed, editable form controls. It
detects each value's type (text, number, boolean, date, URL, array) and renders the
appropriate input. Editing a value writes it straight back into the note's
frontmatter and saves the file. (Tags are intentionally excluded here — they live
in the Tags section.)

**How to test:**
1. The right sidebar is shown on wide windows (xl breakpoint) — widen the window if
   you don't see it.
2. Open a note that has frontmatter, e.g.:
   ```markdown
   ---
   status: draft
   priority: 3
   published: false
   due: 2026-07-01
   link: https://example.com
   aliases: [foo, bar]
   ---
   ```
3. In the right sidebar, expand **Properties**. Each field appears with a fitting
   control (checkbox for booleans, date picker for dates, number input, etc.).
4. Change a value (e.g. toggle `published`, edit `due`) — the note's frontmatter
   updates and the file is saved (a "…" appears next to "Properties" while saving).

---

## D3 — Semantic Search & Smart Link Suggestions (TF‑IDF)

**What it does:** Adds TF‑IDF + cosine‑similarity ranking over your notes:
- **Semantic search** (`semantic_search`) ranks notes by conceptual similarity to a
  query rather than exact keyword match. (It also powers the Vault Q&A retrieval.)
- **Smart link suggestions** — the right sidebar's **"You might link to"** section
  lists notes most similar to the one you're editing that you haven't linked yet,
  each with a 5‑dot similarity meter. Already‑linked notes are filtered out.

**How to test:**
1. Create several notes on related topics so there's content to compare.
2. Open a note and look at the right sidebar's **"You might link to"** section — it
   shows up to 5 similar notes with similarity dots. Click one to open it.
3. Add a `[[Wikilink]]` to one of the suggested notes; on reload it drops out of the
   suggestions (already linked).
4. Notes with little/no overlap won't appear (a minimum similarity threshold
   applies).

---

## D4 — Local AI Writing Assistant

**What it does:** An in‑editor assistant that streams text from your configured AI
provider. You can generate from a prompt, or act on selected text. Output streams
token‑by‑token and can be inserted at the cursor or used to replace the selection.

**Keyboard:** **Enter** sends the prompt · **Tab** accepts the output · **Ctrl/⌘+
Enter** regenerates · **Esc** closes.

**How to test:**
1. Configure a provider in **Settings → AI Assistant** (see prerequisites above).
2. Open the assistant via any of:
   - the command palette → **"AI Writing Assistant"**, or
   - the `/ai` slash command in the editor, or
   - select some text and click the **AI** button in the selection toolbar
     (summarise / expand / rephrase / translate).
3. Type a prompt and press **Enter** — watch the response stream in with a blinking
   cursor.
4. Press **Tab** (or click **Accept**) to insert/replace text in the note. Press
   **Ctrl+Enter** to regenerate, **Esc** to close.
5. If you selected text first, the selection appears as "Context:" in the panel and
   Accept replaces that selection.

> If generation errors (e.g. Ollama not running, missing OpenAI key), the panel
> shows the error message instead of output.

---

## D5 — Auto‑Tagging & Concept Extraction

**What it does:** Two related capabilities:
- **Tag suggestions** — a few seconds after you stop typing, a banner appears below
  the editor suggesting tags derived from the note (TF‑IDF keywords +
  capitalized proper‑noun phrases, excluding tags you already have). Click a chip to
  add `#tag` to the note; dismiss to hide.
- **Tag consolidation** (Settings → Tags) — finds **near‑duplicate tag groups**
  across the vault (by edit distance / common prefix) and lets you **merge**
  variants into one canonical tag, rewriting all affected notes.

**How to test (suggestions):**
1. Open or create a note and write a couple of paragraphs of real content.
2. Stop typing for ~3 seconds — a **"Suggested:"** banner appears with tag chips.
3. Click a chip to add it to the note; click the **✕** to dismiss the banner.

**How to test (consolidation):**
1. Create notes using slightly different tags for the same concept (e.g.
   `#project`, `#projects`, `#projcet`).
2. Open **Settings → Tags** → **Near‑Duplicate Tag Groups**. Grouped variants are
   listed with a suggested canonical tag.
3. Choose the canonical tag and **merge** — confirm the variant tags are rewritten
   across the affected notes.

---

## D6 — Static Site Publisher

**What it does:** Exports the whole vault to a self‑contained **static HTML site**
(`publish_vault`): each `.md` becomes an `.html` page (Markdown → HTML, wikilinks
converted to anchor links), with a generated `index.html` listing all pages and a
shared `style.css`. Notes with `publish: false` in their frontmatter and internal
folders (`.tessellum`, `.git`, `.trash`) are skipped.

**How to test:**
1. Open **Settings → Publish** (Static Site Publisher).
2. Enter a **site title** (e.g. "My Notes") and an **output directory**.
3. Click **Publish** — it writes the HTML site and reports how many pages were
   published vs. skipped.
4. Open the output folder's `index.html` in a browser; click through to notes and
   confirm wikilinks navigate between pages.
5. Add `publish: false` to a note's frontmatter, republish, and confirm that page is
   excluded.

---

## D7 — DOCX Export

**What it does:** Exports the active note to a Microsoft Word `.docx` file
(`export_note_docx`). Headings (`#`, `##`, `###`) map to Word heading styles and
`-`/`*` lines become a bulleted list.

**How to test:**
1. Open a note that has some headings and bullet points.
2. Open **Settings → Export & Import** — the **Active note** path is shown.
3. Click **Export as DOCX** — status reports the output path (written into the vault
   as `<note title>.docx`).
4. Open the `.docx` in Word/LibreOffice and confirm headings and bullets are
   formatted.

---

## D8 — Import from URL

**What it does:** Fetches a web page and saves it into the vault as a Markdown note
(`import_from_url`): it extracts the page `<title>`, strips `<head>`/`<script>`/
`<style>` and tags to plain text, and writes a note with `source:` / `imported:`
frontmatter.

**How to test:**
1. Open **Settings → Export & Import**.
2. In the **Import** section, paste an article URL (e.g.
   `https://example.com/article`).
3. Click **Import from URL** — status shows the created file name.
4. Open the new note in the vault and confirm the title heading, the readable text
   body, and the `source` URL in frontmatter.

---

## D9 — Plugin SDK & Community Marketplace

**What it does:** Lets you browse a community plugin **registry** (a JSON file),
**install** a plugin (downloads its manifest + entry script into
`.tessellum/plugins/<id>/`), list installed plugins, and **uninstall** them. Plugin
IDs are validated to prevent path traversal.

**How to test:**
1. Open **Settings → Plugins**.
2. The **registry URL** is prefilled with the default community registry; you can
   replace it with any reachable `registry.json`.
3. Click to **fetch/browse** the registry — available plugins are listed with
   name, description, author, and version.
4. **Install** one — it appears under installed plugins; the files land in
   `.tessellum/plugins/`.
5. **Uninstall** it — the plugin's folder is removed.

> Use a registry/plugins you trust — installing downloads and stores code locally.

---

## D10 — Automation & Scripting

**What it does:** A scripts manager (Settings → Scripts) for small JS/TS automations
stored in `.tessellum/scripts/`. You can create, edit, delete, and **run** scripts.
Each script runs in a restricted async context and receives a `tessellum` API:

- `read_note(path)` / `write_note(path, content)`
- `query_index(query, topK?)` — semantic search over the vault
- `send_notification(message)`
- `open_file(path)`
- `log(...args)` — appended to the run output

**How to test:**
1. Open **Settings → Scripts**.
2. Create a new script and paste, for example:
   ```js
   const hits = await query_index("project", 5);
   log("Top matches:", hits.map(h => h.title));
   send_notification(`Found ${hits.length} notes`);
   ```
3. Click **Run** (▶) on the script — the output panel shows the logged lines and the
   run duration; a notification line is recorded.
4. Try `read_note`/`write_note` to confirm a script can modify a note. Use the
   **edit** (pencil) and **delete** (trash) actions to manage scripts. The
   **API Reference** section lists the available calls.

> Scripts execute code — only run scripts you understand/trust.

---

## D11 — Canvas / Spatial View

**What it does:** A freeform spatial board stored as a `.canvas` JSON file, rendered
with Cytoscape. You can add cards, drag them to reposition (positions persist),
connect them, and **double‑click a note card** (one whose content is a `[[Wikilink]]`
or note name) to open that note in the editor. The board auto‑saves shortly after
changes.

**How to test:**
1. Open the command palette → **"New Canvas"** (creates `Untitled.canvas` and
   switches to the canvas view). Existing `.canvas` files also open in this view.
2. Click **Add card** in the toolbar — a card appears in the viewport center.
3. **Drag** cards around; pan/zoom with the mouse/trackpad. Reopen the canvas later
   to confirm positions were saved.
4. For a card whose content is `[[Some Note]]`, **double‑click** it to jump to that
   note in the editor.
5. Use the back arrow (←) in the toolbar to return to the editor.

---

## D12 — Vault Q&A Panel (RAG)

**What it does:** A chat panel that answers questions **using your notes as
context** (Retrieval‑Augmented Generation). For each question it runs semantic
search to find the most relevant notes, feeds excerpts of the top notes to the AI as
context, and streams an answer that **cites the source notes** — each citation is a
clickable chip that opens the note.

**How to test:**
1. Configure an AI provider (see prerequisites) and ensure you have several notes
   with real content.
2. Open the right sidebar (wide window) and click the **Q&A** button at its top
   right.
3. Ask a question about your notes (e.g. "What did I decide about the project
   timeline?") and press **Enter**.
4. Watch the answer stream in. Under the assistant reply, **Sources** chips list the
   notes used — click one to open it.
5. Ask something not covered by your notes to confirm the assistant says it can't
   find the answer (it's instructed to answer only from the provided notes).

---

## Quick reference — where each feature lives

| Feature | Where to find it |
|---|---|
| C1 Index status | Bottom status bar |
| C4 Git sync | Settings → Sync · status‑bar badge |
| D1 Dataview | ` ```dataview ` code block in a note |
| D2 Properties | Right sidebar → Properties |
| D3 Link suggestions | Right sidebar → "You might link to" |
| D4 AI assistant | `/ai`, palette "AI Writing Assistant", selection toolbar |
| D5 Auto‑tagging | Editor banner · Settings → Tags |
| D6 Publish | Settings → Publish |
| D7 DOCX export | Settings → Export & Import |
| D8 URL import | Settings → Export & Import |
| D9 Plugins | Settings → Plugins |
| D10 Scripts | Settings → Scripts |
| D11 Canvas | Palette "New Canvas" · `.canvas` files |
| D12 Vault Q&A | Right sidebar → Q&A button |

## Notes on verification

These features are best validated manually with the steps above. As noted in
`UI_IMPROVEMENTS.md`, the automated frontend test suite (`npm test`) currently fails
for a pre‑existing environment reason (`localStorage` undefined in
`src/test/setup.ts`) unrelated to these features; production code typechecks cleanly
and `npx vite build` succeeds.
