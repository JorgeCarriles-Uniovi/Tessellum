---
tags: ["documentation", "execution-manual", "une-157801"]
type: "execution_manual"
suite: "une_157801"
document_role: "execution"
app: "tessellum"
language: "en"
---
# Tessellum Execution Manual

## Formal Execution Manual
**Universidad de Oviedo | Escuela de Ingenieria Informatica | Trabajo Fin de Grado**  
**Application**: Tessellum  
**Document purpose**: Operational execution manual  
**Reference context**: UNE 157801 documentation set

> [!info] Purpose of this manual
> This document is part of the Tessellum UNE 157801 documentation set. It explains how Tessellum is executed and operated once it has already been installed, with emphasis on startup, vault selection, runtime behavior, persistence, shutdown, recovery actions, and day-to-day operational control.

---

## 1. Introduction

Tessellum is a local-first desktop application for Markdown-based knowledge management. Once installed, the application is executed as a native desktop program and operates on a user-selected vault folder that stores the user's notes and related local resources.

This execution manual is different from the installation manual and the user manual:

- the **installation manual** explains how to deploy the application on the operating system;
- the **user manual** explains what the interface does and how to use each feature in detail;
- the **execution manual** explains how the application is launched, what it does during runtime, how the working environment is established, and how the operator should manage a normal session.

This document is intended for:

- final users;
- evaluators;
- academic reviewers;
- technical users who need a precise operational description of the system in execution.

---

## 2. Scope of Execution

When Tessellum is executed, it coordinates several local responsibilities:

- the graphical desktop window;
- the Markdown editing interface;
- the active vault folder selected by the user;
- local filesystem monitoring;
- local metadata storage;
- local full-text indexing;
- local graph projection and query support.

The application is designed to run locally on the user machine without requiring a cloud service for normal use.

> [!tip] Local-first principle
> During execution, user notes remain in the vault folder as normal Markdown files. Tessellum reads, writes, indexes, and visualizes them locally.

---

## 3. Preconditions Before Execution

Before running Tessellum, the following conditions should be satisfied:

- the application is already installed correctly;
- the operating system supports the application package used;
- the user has permission to open and write files in the chosen vault folder;
- sufficient disk space exists for notes, indexes, and temporary derived data;
- the graphical desktop environment is operational.

In practical terms, the user should have:

- a writable local folder available for use as a vault;
- permission to create subfolders and Markdown files inside that vault;
- permission for the application to access local files.

---

## 4. Execution Model

Tessellum operates as a multi-layer local application:

1. The desktop application window is launched.
2. The interface loads.
3. The user opens or resumes a vault.
4. Tessellum initializes local watchers, metadata stores, search indexes, and graph resources.
5. The user works on notes, folders, search, graph, templates, and settings.
6. The application persists content and interface state locally.
7. The session ends when the user closes the application.

This model means that execution is not limited to simply opening a window. The application establishes a full local workspace context around the selected vault.

---

## 5. Starting the Application

### Standard startup

After installation, the application is executed using the normal operating-system launcher:

- **Windows**: Start menu, desktop shortcut, or installed application entry
- **macOS**: Applications folder, Launchpad, or Spotlight
- **Linux**: desktop launcher, package-managed application menu entry, or AppImage execution

When the application starts:

1. The native Tessellum window opens.
2. The frontend interface is rendered.
3. Runtime services are initialized.
4. The last known workspace state may be restored if available.

### Window behavior

The application uses a custom title bar and native desktop window behavior. From the operator point of view, the window supports the expected desktop actions:

- minimize;
- maximize or restore;
- close.

The window also preserves part of the interface state locally, so repeated sessions can reopen with remembered configuration and workspace context.

### Expected startup result

The startup phase can be considered successful when:

- the main application window appears;
- the interface responds to input;
- the user can open or recover a vault;
- no blocking runtime error prevents operation.

---

## 6. Vault Initialization During Execution

### Role of the vault

The vault is the operational core of Tessellum. It is the folder selected by the user to store notes, assets, templates, and other vault-owned resources.

Without an active vault, Tessellum can start, but normal note-management execution is incomplete.

### Opening a vault

At the beginning of execution, the user should:

1. open an existing vault; or
2. choose a new local folder that will become the vault.

When a vault is opened, Tessellum:

- stores the active vault path;
- expands access scope to that folder;
- initializes internal support directories if necessary;
- refreshes the file tree;
- starts filesystem watching;
- begins synchronization and indexing tasks.

### Vault-owned operational folders

During execution, Tessellum may use or create the following internal folders in the vault:

- `.trash`
- `.tessellum/templates`
- `.tessellum/.themes`
- `.tessellum/config.json`

These resources are part of normal operation.

### Meaning of each resource

- `.trash`: temporary holding area for deleted notes and folders before permanent deletion
- `.tessellum/templates`: user note templates
- `.tessellum/.themes`: custom user-defined themes
- `.tessellum/config.json`: operational vault configuration, including daily-note behavior

> [!note] User expectation
> These resources are not errors or unwanted files. They are normal support structures created by the application to execute its features.

---

## 7. What Tessellum Does After a Vault Is Opened

Once a vault is active, Tessellum establishes its runtime environment around that vault.

### File tree loading

The application reads the vault structure and displays notes and folders in the sidebar.

The user should expect:

- folders to appear hierarchically;
- Markdown notes to become selectable;
- navigation state such as expanded folders and open tabs to be restorable across sessions.

### Filesystem watching

Tessellum starts a local watcher for the vault. This means the application can react when files are:

- created;
- edited;
- renamed;
- deleted;
- restored.

This applies both to actions performed inside Tessellum and to relevant file changes made externally in the vault directory.

### Local indexing

After opening the vault, Tessellum performs indexing and synchronization work. Operationally, this includes:

- scanning Markdown files;
- extracting metadata;
- extracting tags;
- extracting wiki-links;
- updating the local search index;
- refreshing graph relationships.

For small vaults, this process is usually not very visible. For larger vaults, the user may notice a short warm-up period before all search and graph features are fully current.

### Session-state restoration

The application stores part of the user session locally and may restore:

- the last vault path;
- expanded folders;
- active view mode;
- editor mode;
- open tabs;
- last active note;
- sidebar sizes and other UI preferences.

This behavior is part of normal execution and is intended to shorten the return path into the user's workspace.

---

## 8. Application-Owned Runtime Data

Besides the vault itself, Tessellum maintains application-owned derived data in its local app-data area.

This derived data includes:

- `vault.db`
- `search_index/`
- `graph.grafeo`
- startup diagnostics

### Meaning of these runtime resources

- `vault.db`: structured local metadata cache
- `search_index/`: local full-text search index
- `graph.grafeo`: graph-query projection database
- startup diagnostics: local information written when startup issues need to be recorded

These files are not the source of truth for user content. The source of truth remains the vault itself.

> [!info] Important distinction
> If these derived resources are rebuilt, the notes are not lost, because the note files remain in the vault. The indexes are operational accelerators, not the canonical note storage format.

---

## 9. Normal Operating Session

The normal execution cycle of Tessellum is best understood as a repeated session pattern.

### Typical session sequence

1. Launch Tessellum.
2. Open or resume a vault.
3. Wait briefly for the workspace to initialize.
4. Create, open, edit, search, or link notes.
5. Consult backlinks, tags, outline, or graph information as needed.
6. Move unwanted items to Trash instead of deleting them irreversibly.
7. Close the application when work is complete.

### Primary active views during execution

During the session, the user may operate mainly through:

- the file tree;
- the editor area;
- the search panel;
- the graph view;
- the right sidebar;
- settings and modal tools.

The detailed meaning of every interface element is covered in the user manual, but operationally these are the main execution surfaces.

---

## 10. Core Operational Workflows

### Creating and editing notes

The most common execution workflow is:

1. create or open a note;
2. write Markdown content;
3. add headings, links, tags, or embedded content;
4. switch view or editor mode if needed;
5. continue navigation through tabs, links, search, or graph.

While the user edits content, Tessellum updates the local note model and keeps operational data aligned with the vault.

### Navigating with wiki-links

Tessellum supports note-to-note navigation using `[[wiki links]]`.

Operationally, this means:

- links are parsed locally;
- linked notes become part of the vault relationship graph;
- backlinks are updated;
- graph views can reflect the relationship.

### Search execution

Search is performed locally through the integrated search panel.

The user can:

- search for plain text;
- search by tag;
- use combined queries.

Operationally, search depends on the current local index. If the vault has just been opened or heavily modified, the index may still be updating during the first moments of the session.

### Graph execution

The graph subsystem provides relationship visualization and query exploration.

During normal execution, the user can:

- open the graph;
- inspect note relationships;
- identify connected notes;
- identify unresolved or broken references;
- run graph queries when needed.

### Template-based note creation

If the vault contains templates in `.tessellum/templates`, the user can create notes from those templates.

Operationally, Tessellum:

- lists available templates;
- requests a note title;
- creates the new note in the selected target directory;
- applies template content and placeholder processing.

### Daily note execution

Tessellum includes a daily-note workflow.

From the execution point of view:

- the user activates the daily-note action;
- Tessellum opens today's daily note if it already exists;
- otherwise, it creates it automatically based on the configured path and template rules.

The vault configuration file can define the daily-note path template and default template name.

### Trash execution

When a user deletes a note or folder, the normal execution path is not immediate permanent destruction.

Instead, Tessellum:

- moves the item to `.trash`;
- removes it from the active navigation context;
- allows later restoration;
- resolves restore collisions when necessary.

This behavior is part of the application safety model.

### PDF export execution

When the user exports a Markdown note to PDF:

1. the active note content is prepared for print rendering;
2. the layout is converted to a printable output model;
3. the resulting file is written to the destination selected by the user.

The export workflow therefore depends on:

- the active note content;
- a valid save destination;
- the local backend export pipeline.

---

## 11. Settings That Affect Execution

Certain settings directly influence how the application behaves during execution.

### Language

The selected language changes the visible interface language used during the session.

### Spell check

Spell check affects editing behavior in text inputs and editor surfaces.

### Editor configuration

Editor settings influence the live execution experience during writing:

- font family;
- font size;
- line height;
- letter spacing;
- line numbers;
- Vim mode.

### Appearance configuration

Appearance settings affect runtime presentation and layout:

- active theme;
- theme schedule;
- accent colors;
- toolbar visibility;
- sidebar position;
- density;
- radius;
- shadow style;
- icon style;
- syntax and terminal visual customizations.

### Accessibility configuration

Accessibility settings affect execution comfort and legibility:

- high contrast;
- UI scale;
- reduced motion;
- color filters.

### Plugin enablement

Enabled plugins extend execution behavior, while disabled plugins remove their contributions from the runtime experience.

This can affect:

- command palette commands;
- editor capabilities;
- sidebar actions;
- settings tabs;
- specialized workflows such as daily notes or media support.

---

## 12. Save, Synchronization, and Persistence Behavior

### Content persistence

Tessellum stores the user's actual note content as files in the vault. During normal execution, this means that note creation and note editing affect local files directly or through the managed save pipeline.

### Metadata persistence

The application also maintains local metadata and derived indexes separately from the raw note files. These derived structures help provide:

- faster search;
- tag lookup;
- relationship tracking;
- graph projection.

### Runtime preference persistence

The interface also preserves part of the user environment locally across sessions. This includes settings and UI state such as:

- current vault path;
- recent searches;
- selected theme;
- editor preferences;
- accessibility preferences;
- open tabs and related interface state.

### Operational expectation after changes

After the user modifies content in the vault, the expected runtime behavior is:

1. file content changes are persisted locally;
2. the watcher and synchronization logic detect relevant modifications;
3. search and graph representations are refreshed accordingly.

In normal execution, this should occur without requiring manual rebuilding for ordinary day-to-day work.

---

## 13. Closing the Application

### Normal shutdown

The recommended way to end a session is to close Tessellum through the normal desktop window control.

When the application closes, the operational goal is:

- the session ends cleanly;
- watcher activity stops;
- interface state remains available for future restoration;
- vault content remains on disk.

### What the user should do before closing

Before ending the session, the user should ensure that:

- the required notes have been completed;
- export tasks have finished if one was active;
- no pending operation appears blocked by an error message.

### Safe expectation after shutdown

After shutdown:

- the application window disappears;
- the vault remains intact;
- derived data remains available for the next session;
- the next launch can restore the previous working context where applicable.

---

## 14. Reopening the Application

When Tessellum is executed again after a previous session, the application may restore:

- the previously used vault;
- the last open note or tab set;
- expanded folder state;
- editor mode;
- view preferences.

This restoration improves continuity between sessions and is part of the intended execution behavior.

---

## 15. Operational Checks for Correct Execution

The system can be considered to be executing correctly when the following conditions are observed:

- the application launches without a blocking error;
- a vault can be opened;
- the file tree loads;
- notes can be created and edited;
- search returns expected results after initialization;
- graph features open correctly;
- settings changes are applied;
- deleted files move to Trash correctly;
- the application closes and reopens without losing vault content.

> [!tip] Practical check set
> A short operational validation after launch is to create one note, search for a word inside it, open the graph, and then close and reopen the application to confirm that the workspace remains consistent.

---

## 16. Abnormal Execution Situations

### Startup failure

If Tessellum fails during startup:

- verify the installation;
- confirm platform runtime prerequisites;
- relaunch the application;
- inspect whether a local startup diagnostic was generated.

### Vault access failure

If a vault cannot be opened or used:

- confirm the folder exists;
- confirm the user has write permissions;
- avoid protected or read-only directories;
- retry using a local user-owned folder.

### Search not ready immediately

If search appears incomplete immediately after opening a large vault, allow the local indexing phase to settle before assuming the feature is broken.

### External filesystem changes

If files are modified outside Tessellum while the application is open, the runtime watcher should normally reconcile those changes. If the visible state appears stale:

- wait briefly;
- change focus between views;
- reopen the note or refresh the working context by restarting the application if necessary.

### Theme or template issues

If a custom theme or template does not behave as expected:

- confirm it is stored in the correct vault directory;
- confirm the file format is valid;
- reopen the relevant panel or restart the application if the resource was added during the session.

---

## 17. Backup and Recovery Considerations During Execution

Because Tessellum is local-first, operational safety depends mainly on the vault.

Recommended practice:

- keep the vault in a folder that is easy to back up;
- use regular backups for important note collections;
- back up the vault before large migrations, bulk edits, or system changes;
- treat the Markdown files as the critical assets.

The operational indexes and caches can help performance, but the vault contents remain the key data that must be preserved.

---

## 18. Relationship with Companion Manuals

This execution manual should be read together with:

- [2026-05-20-tessellum-installation-manual.md](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/docs/architecture/2026-05-20-tessellum-installation-manual.md), for deployment on Windows, macOS, and Linux;
- [2026-05-20-tessellum-user-manual.md](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/docs/architecture/2026-05-20-tessellum-user-manual.md), for detailed use of the interface and features.

Together, these three documents cover:

- installation;
- execution;
- end-user operation.

---

## 19. Final Notes

Tessellum is executed as a native local application but operates around a persistent vault-based knowledge workspace. From an execution standpoint, the key ideas are:

- the vault is the main user data space;
- the application creates and maintains local support structures around that vault;
- interface state and runtime preferences are preserved locally;
- search, graph, and metadata services are derived from local files;
- normal execution should remain stable across repeated open-edit-close cycles.

For correct day-to-day operation, the user should:

- always work in a writable local vault;
- allow the application to initialize its indexes when opening large vaults;
- use Trash instead of expecting immediate destructive deletion;
- keep regular backups of the vault contents.
