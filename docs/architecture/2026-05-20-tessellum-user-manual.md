---
tags: ["documentation", "user-manual", "une-157801"]
type: "user_manual"
suite: "une_157801"
document_role: "user"
app: "tessellum"
language: "en"
---
# Tessellum User Manual

## Formal User Manual
**Universidad de Oviedo | Escuela de Ingenieria Informatica | Trabajo Fin de Grado**  
**Application**: Tessellum  
**Document purpose**: End-user operating manual  
**Reference context**: UNE 157801 documentation set

> [!info] Purpose of this manual
> This document is part of the Tessellum UNE 157801 documentation set. It explains Tessellum from the perspective of the final user, describing the interface, expected workflow, main areas, settings, themes, and day-to-day note-taking and knowledge-management use.

---

## 1. Introduction

Tessellum is a local-first knowledge management application for creating, linking, searching, and visualizing Markdown notes. It is designed for users who want a structured workspace for personal notes, project documentation, technical writing, research material, and graph-based knowledge exploration.

From the user point of view, Tessellum combines five main ideas:

- a vault-based workspace, where your notes live inside a folder you choose;
- a Markdown editor with multiple writing and reading modes;
- wiki-link navigation between notes;
- search and tag discovery;
- graph visualization of note relationships.

The application is designed for mixed users:

- beginners who need a clear interface and guided workflows;
- intermediate users who want fast note organization;
- advanced users who want tags, templates, graph navigation, custom themes, and keyboard-driven operation.

---

## 2. What Tessellum Is For

You can use Tessellum to:

- write plain notes in Markdown;
- organize notes in folders;
- connect ideas using `[[wiki links]]`;
- search notes by text, tags, or combined queries;
- view backlinks, tags, and note outlines;
- visualize a vault as a graph;
- create notes from templates;
- manage daily notes;
- embed images and PDFs inside notes;
- export Markdown notes to PDF;
- customize the visual appearance and accessibility behavior of the application.

> [!tip] Typical use cases
> Tessellum works especially well for study notes, software documentation, personal knowledge bases, research notes, and project planning.

---

## 3. Getting Started

### 3.1 First launch

When you open Tessellum for the first time, the application starts without an active vault. A vault is the folder that stores your notes and related data.

To begin:

1. Open a vault.
2. Choose or create a folder on your computer.
3. Let Tessellum use that folder as your working space.

### 3.2 What Tessellum creates inside the vault

Tessellum primarily works with your own files, but it also uses internal support folders in the vault:

- `.trash` stores items moved to Trash before permanent deletion.
- `.tessellum/templates` is used for note templates.
- `.tessellum/.themes` is used for custom user themes.

These internal folders support the application workflow and should not normally be edited unless you are intentionally managing templates or custom themes.

---

## 4. Expected Workflow of the Application

The expected end-user workflow is:

1. Open or create a vault.
2. Create folders to organize your topics or projects.
3. Create notes inside the appropriate folders.
4. Write in Markdown, optionally adding tags, headings, links, and embeds.
5. Connect notes using wiki-links such as `[[Project Plan]]`.
6. Use Search to locate notes by words, tags, or mixed queries.
7. Use the right sidebar to inspect backlinks, tags, and outline.
8. Use Graph View to explore relationships between notes.
9. Move deleted items to Trash instead of removing them immediately.
10. Restore or permanently delete items from Trash when needed.
11. Adjust Settings to match your language, editor preferences, appearance, accessibility needs, and plugin preferences.

> [!info] Local-first behavior
> Tessellum is designed around local files. Your notes stay in your vault folder, and the application works primarily with local storage, local indexing, and local graph generation.

---

## 5. Main Application Layout

Tessellum is divided into several visible interface areas:

- the title bar at the top;
- the left sidebar;
- the main editor or graph area;
- the right sidebar;
- modal panels such as Settings, Trash, Template Picker, and Command Palette.

Each section has a specific user role.

---

## 6. The Title Bar

The title bar is the top navigation and control strip of the application. It includes workspace navigation, view toggles, editor mode controls, and window controls.

### 6.1 Main buttons in the title bar

From left to right, the persistent title bar actions are:

- **Toggle Sidebar**: opens or hides the left sidebar.
- **Back**: moves to the previous note in navigation history.
- **Forward**: moves to the next note in navigation history.
- **Search / Back to Files**: opens the search panel; when search is already open, the same position acts as a return-to-files action.
- **Toggle Right Sidebar**: opens or hides the right sidebar.
- **Toggle Local Graph**: opens or hides the local graph panel for the active note.
- **Editor Mode Selector**: changes the editor mode.
- **Window Controls**: minimize, maximize/restore, and close the application window.

### 6.2 Path display

The center area of the title bar shows the location of the active note inside the vault. This helps the user understand where the current note belongs in the folder structure.

### 6.3 Editor modes

Tessellum provides three editor modes:

- **Reading**: optimized for viewing content.
- **Live Preview**: editable mode with rendered assistance.
- **Source**: editable mode that exposes Markdown more directly.

Use the mode selector in the title bar to switch between them depending on whether you want to read, write, or work directly with markup.

> [!tip] Recommended practice
> Use Reading mode for reviewing notes, Live Preview for everyday writing, and Source mode for more technical Markdown editing.

---

## 7. The Left Sidebar

The left sidebar is the main workspace navigation area. It contains the file tree, workspace actions, footer tools, and vault switcher.

### 7.1 Header area

The sidebar header shows the application identity and provides quick actions:

- **Open Vault**: chooses the active workspace folder.
- **New Folder**: creates a folder in the current context.
- **New Note**: creates a new note.

### 7.2 File tree

The file tree displays your vault hierarchy. It allows you to:

- open notes;
- expand or collapse folders;
- select files and folders;
- navigate the vault structure;
- access context actions with a right click.

### 7.3 Empty state

If the vault has no files yet, the sidebar shows an empty-state message inviting the user to begin by opening a vault or creating content.

### 7.4 Sidebar action buttons

Depending on the installed UI actions, the sidebar can provide direct operational buttons for common tasks.

### 7.5 Footer actions

The footer area contains global workspace actions:

- **Graph View**: opens the full graph view.
- **Settings**: opens the settings modal.
- **Trash**: opens the trash management modal.

### 7.6 Vault switcher

The bottom vault switcher area shows the current vault name and gives access to vault switching.

---

## 8. File Tree Context Menu

When you right-click a note or folder in the file tree, Tessellum displays a context menu. The available actions depend on whether the selected item is a file or a folder.

### 8.1 Common context menu actions

- **Rename**: changes the name of the selected item.
- **Copy**: copies the selected file or folder reference for paste operations.
- **Delete**: moves the selected item to Trash.

### 8.2 Folder-only context menu actions

- **New Note**: creates a note inside the selected folder.
- **New Note From Template**: creates a note from a template inside the selected folder.
- **New Folder**: creates a child folder.
- **Paste Files**: pastes copied items into that folder.

### 8.3 File-only context menu actions

- **Export to PDF**: exports a Markdown note to PDF when the selected file is a supported Markdown file.

> [!important] Delete behavior
> Deleting from the context menu does not immediately destroy the content. The item is moved to Trash first.

---

## 9. The Main Editor Area

The editor area is the core writing surface of Tessellum.

### 9.1 What the editor is used for

The editor is where you:

- write and edit Markdown notes;
- read rendered content;
- insert links, lists, callouts, tables, code, and diagrams;
- work with templates and embedded assets;
- navigate across notes.

### 9.2 Features supported in the editor

The editor supports the content shown in `FEATURE_DEMO.md`, including:

- headings;
- bold, italic, and strikethrough text;
- ordered and unordered lists;
- task lists;
- block quotes;
- dividers;
- wiki-links;
- code blocks;
- inline code;
- callouts;
- Mermaid diagrams;
- tables;
- LaTeX math;
- media embeds such as images and PDFs.

### 9.3 Editor helper interactions

Tessellum includes several context-aware helpers:

- **Slash commands**: type `/` to open the insert menu.
- **Formatting toolbar**: appears when text is selected.
- **Wiki-link suggestions**: appear while writing links.
- **Autocomplete support**: assists tag and property entry.

### 9.4 Media preview

When a supported non-Markdown file such as an image or PDF is opened, Tessellum uses preview behavior instead of standard text editing.

---

## 10. The Search Panel

The search panel opens from the title bar and replaces the normal left sidebar content while active.

### 10.1 Main parts of the search panel

The search panel contains:

- a **search input**;
- a **recent searches** area when the query is empty;
- a **results list**;
- a **close button**;
- a **search tips panel** at the bottom.

### 10.2 Search behavior

You can search by:

- plain text;
- tags such as `#feature`;
- mixed queries such as `graph #feature`;
- content-oriented tokens such as `content:graph`.

### 10.3 Search result actions

Selecting a note result opens that note. Search results may also show snippets and tags to help identify the correct match.

### 10.4 Search panel buttons

- **Close Search**: closes the search panel.
- **Recent Search Entry**: reuses a previous query.

> [!tip] Search strategy
> Start with a broad word, then refine the search by adding one or more tags.

---

## 11. Graph View

Graph View provides a visual representation of note relationships across the vault.

### 11.1 What Graph View shows

Graph View uses note connections to show:

- notes as nodes;
- links between notes as edges;
- broken references as missing or ghost-style nodes.

### 11.2 Main Graph View controls

- **Back to Editor**: returns to the editor view.
- **Graph Canvas**: displays and allows interaction with the graph.
- **Node Info Panel**: shows information about the currently selected node.
- **Cypher Query Panel**: filters graph content using graph queries.

### 11.3 Cypher query panel

The graph query panel can be shown or hidden using its side toggle button.

Inside the panel, the user can:

- type a query;
- clear the current query;
- open the examples menu;
- pick a built-in example query;
- view running status and query errors.

### 11.4 Graph interaction

Typical graph interactions include:

- clicking a node to inspect it;
- double-clicking a node to open the note;
- panning and zooming the graph;
- filtering visible nodes with queries.

> [!info] Missing-note behavior
> If a graph node represents a note that does not yet exist, Tessellum can create it when the user opens that graph entry through the note-creation flow.

---

## 12. The Right Sidebar

The right sidebar is the contextual information panel for the active note.

It contains three main sections:

- **Backlinks**
- **Tags**
- **Outline**

### 12.1 Backlinks

The backlinks section shows which other notes point to the active note.

Each backlink card may include:

- the note name;
- a content snippet;
- a button-like card that opens that note.

### 12.2 Tags

The tags section lists the tags detected for the current note. It merges:

- tags from frontmatter;
- inline tags written in the note body.

### 12.3 Outline

The outline section lists the headings detected in the active note. It allows:

- fast navigation to headings;
- collapsing and expanding nested heading groups.

### 12.4 Right sidebar buttons and controls

- **Toggle Right Sidebar** in the title bar shows or hides the entire panel.
- **Backlink Cards** open linked notes.
- **Outline Expand/Collapse Buttons** show or hide heading subsections.
- **Outline Heading Buttons** jump to the selected heading in the note.

---

## 13. Trash

The Trash modal manages deleted items safely.

### 13.1 How Trash works

When you delete a note or folder, Tessellum moves it to `.trash` inside the vault instead of removing it immediately.

### 13.2 Trash modal actions

For each trashed item, the user can:

- **Restore**: return the item to its original folder;
- **Delete permanently**: remove it completely.

The modal also provides:

- **Close**: closes the Trash view.

### 13.3 Retention behavior

According to the design documentation, trashed items are intended to remain recoverable before later cleanup.

> [!warning] Permanent deletion
> “Delete permanently” is the destructive action. Use it only when you are sure the item is no longer needed.

---

## 14. Command Palette

The command palette is the keyboard-first action launcher for the application.

### 14.1 What it does

It allows the user to run common commands without navigating through the interface manually.

### 14.2 Typical commands

Depending on the registered UI actions, the palette can trigger commands such as:

- open vault;
- create new note;
- create new folder;
- open graph view;
- create note from template;
- paste files;
- open settings.

### 14.3 Main command palette controls

- **Input field**: filters commands by name and keywords.
- **Command list**: displays available commands.
- **Keyboard navigation**: arrow keys and Enter select commands.
- **Close behavior**: Escape closes the palette.

---

## 15. Template Picker

The Template Picker is used when creating a note from a template.

### 15.1 What it does

It lets the user:

- enter a title for the new note;
- create a blank note;
- create a note using one of the available templates.

### 15.2 Template source folder

Templates are expected in:

`<vault>/.tessellum/templates`

Markdown files placed there can be used as note templates.

### 15.3 Template picker buttons and actions

- **Template Entry**: creates a note from the selected template.
- **Blank Note / Start Fresh**: creates a note without applying a template.
- **Close**: exits the dialog.

---

## 16. Settings Overview

Tessellum provides six settings tabs:

- General
- Editor
- Appearance
- Shortcuts
- Accessibility
- Plugins

Each tab is explained below in detail.

---

## 17. General Settings

General settings control workspace language behavior and spell checking.

### 17.1 Application Language

**Option**: Application language  
**Values**:

- English
- Spanish

**What it does**: changes the language used by the application interface and compatible plugins.

### 17.2 Spell Check

**Toggle**: Spell check  
**What it does**: enables or disables spelling verification while typing.

**When enabled**:

- the editor can mark misspelled words according to the active language behavior.

**When disabled**:

- the application stops applying spell-check assistance in supported editable surfaces.

---

## 18. Editor Settings

Editor settings define the typography and display behavior of the note editor.

### 18.1 Font Family

**Option**: Font Family  
**Available values**:

- Geist Sans
- Inter
- Roboto
- Source Sans 3
- Georgia
- Courier New

**What it does**: changes the typeface used in the editor.

### 18.2 Font Size

**Option**: Font Size  
**Available values**:

- 14 px - Small
- 16 px - Medium
- 18 px - Large
- 20 px - Extra Large

**What it does**: controls the size of editor text.

### 18.3 Line Height

**Control**: range slider  
**What it does**: increases or reduces vertical spacing between lines of text.

### 18.4 Letter Spacing

**Control**: range slider  
**What it does**: increases or reduces horizontal spacing between characters.

### 18.5 Show Line Numbers

**Toggle**: Show line numbers  
**What it does**: displays or hides line numbers in the editor gutter.

### 18.6 Vim Mode

**Toggle**: Vim mode  
**What it does**: enables Vim-style keyboard bindings for users who prefer modal editing.

> [!tip] Practical recommendation
> Users who mostly write prose often prefer a larger line height and no line numbers. Technical users often prefer line numbers and Vim mode.

---

## 19. Appearance Settings

Appearance settings define the visual presentation of the application.

### 19.1 Theme

**Section**: Theme  
**What it does**: lets the user select the active built-in or custom theme.

The current built-in themes include both light and dark variants, such as:

- Catppuccin Latte
- Catppuccin Mocha
- Warm Paper
- Warm Paper Dark
- Default
- Default Dark
- Ocean
- Ocean Dark

### 19.2 Theme Schedule

**Section**: Theme Schedule  
**Modes**:

- Off
- System
- Sunrise / Sunset
- Custom

**What each mode does**:

- **Off**: no automatic theme switching.
- **System**: follows the operating system theme preference.
- **Sunrise / Sunset**: changes theme based on day/night timing behavior.
- **Custom**: lets the user define the start time for the light and dark periods manually.

When **Custom** is selected, two time inputs become available:

- **Light start**
- **Dark start**

### 19.3 Accent Color

**Section**: Accent Color  
**What it does**: changes the main accent color used for highlighted elements and key visual emphasis.

This section provides:

- predefined swatches;
- a custom color picker;
- a text field for the current color value.

### 19.4 Terminal Colors

This section controls the colors used in terminal-style callouts.

**Toggle**: Custom terminal colors  
**What it does**: when enabled, overrides the theme defaults for terminal callouts.

Available terminal color controls:

- Header background
- Line background
- Border
- Text
- Muted text

### 19.5 Syntax Highlighting

This section controls code block coloration.

**Toggle**: Custom syntax colors  
**What it does**: when enabled, overrides theme defaults for code blocks.

Available syntax controls:

- Comment
- Keyword
- Operator
- String
- Number
- Variable
- Function

### 19.6 Inline Code

This section controls the rendered color of inline code text.

**Toggle**: Custom inline code color  
**What it does**: when enabled, overrides the default inline code text color.

Available control:

- Text color

### 19.7 Visual Style

This section controls presentation density and component styling.

#### Density

**Values**:

- Compact
- Comfortable

**What it does**: changes how tight or spacious the interface feels.

#### Corner Radius

**Values**:

- Sharp
- Balanced
- Soft

**What it does**: changes how rounded UI elements look.

#### Shadows

**Values**:

- Subtle
- Medium
- Strong

**What it does**: changes the intensity of elevation and depth effects.

#### Icon Style

**Values**:

- Outline
- Filled

**What it does**: changes the icon rendering style used by the interface.

### 19.8 Layout

This section controls workspace layout preferences.

#### Sidebar Position

**Values**:

- Left
- Right

**What it does**: moves the main navigation sidebar to the chosen side of the window.

#### Toolbar

**Toggle**: Toolbar  
**What it does**: shows or hides the top toolbar.

---

## 20. Accessibility Settings

Accessibility settings improve readability, visibility, and interaction comfort.

### 20.1 High Contrast

**Toggle**: High contrast  
**What it does**: increases contrast to improve readability.

### 20.2 UI Scale

**Option**: UI Scale  
**Available values**:

- 90%
- 100%
- 110%
- 125%
- 150%

**What it does**: scales the interface size to make controls and text smaller or larger.

### 20.3 Reduce Motion

**Toggle**: Reduce motion  
**What it does**: minimizes animations and motion effects.

### 20.4 Color Filter

**Option**: Color filter  
**Available values**:

- None
- Protanopia
- Deuteranopia
- Tritanopia

**What it does**: applies color adaptation modes intended to improve accessibility for some users with color-vision differences.

---

## 21. Shortcuts Settings

The Shortcuts tab presents the currently available keyboard shortcuts.

The shortcuts exposed in the interface include:

- `Cmd/Ctrl + T` - New note
- `Cmd/Ctrl + P` - Quick search
- `Cmd/Ctrl + J` - Toggle sidebar
- `Cmd/Ctrl + ,` - Open settings
- `Cmd/Ctrl + Tab` - Next tab
- `Cmd/Ctrl + Shift + Tab` - Previous tab
- `Cmd/Ctrl + B` - Bold text
- `Cmd/Ctrl + I` - Italic text
- `Cmd/Ctrl + K` - Open command palette
- `Cmd/Ctrl + G` - Toggle graph

> [!note] Important clarification
> The current shortcuts tab acts as a reference list. It documents the active shortcuts available to the user.

---

## 22. Plugins Settings

The Plugins tab allows the user to enable or disable supported plugins.

### 22.1 Plugin groups

The interface separates plugins into:

- built-in plugins;
- external plugins.

### 22.2 What the plugin toggles do

Each toggle enables or disables the corresponding plugin behavior, provided that the plugin is not locked by the application.

### 22.3 Locked plugins

Some plugins are required for the core user interface and cannot be disabled.

### 22.4 Built-in plugin capabilities visible to the final user

The built-in plugin list includes features such as:

- WikiLink rendering and navigation
- Task list checkboxes
- Table rendering
- Mermaid diagram rendering
- Media paste
- Media embed
- Math rendering
- Markdown live preview
- Inline tag highlighting
- Inline code rendering
- Frontmatter rendering
- Divider rendering
- Daily notes
- Core UI actions
- Core Markdown commands
- Code block support
- Callout support

---

## 23. Custom Themes

Custom themes let the user extend Tessellum beyond the built-in visual presets.

### 23.1 Where custom themes are stored

Custom themes must be placed in:

`<vault>/.tessellum/.themes`

Tessellum watches this directory and reloads themes when compatible files are added or changed.

### 23.2 Supported file formats

Custom themes can be provided as:

- JSON files
- YAML files
- YML files

### 23.3 Required theme properties

A custom theme should define at least:

- `name`
- `variant`
- one or more supported theme tokens

### 23.4 Theme variants

The `variant` should describe whether the theme is:

- `light`
- `dark`

### 23.5 Example JSON theme

```json
{
  "name": "My Custom Theme",
  "variant": "dark",
  "background.primary": "#101418",
  "background.secondary": "#161b21",
  "background.tertiary": "#202733",
  "text.primary": "#f5f7fa",
  "text.secondary": "#d7dde5",
  "text.muted": "#8d99a6",
  "border.light": "#26303b",
  "border.medium": "#33404d",
  "accent.default": "#4f8cff",
  "code.string": "#7ddc84",
  "code.function": "#7ab8ff",
  "callout.info": "#4f8cff",
  "panel.background": "#161b21",
  "panel.border": "#26303b"
}
```

### 23.6 Example YAML theme

```yaml
name: "My Light Theme"
variant: light
background.primary: "#fbfaf7"
background.secondary: "#f4efe6"
background.tertiary: "#ebe3d6"
text.primary: "#1f1b16"
text.secondary: "#342b24"
text.muted: "#6f6257"
border.light: "#ddd2c2"
border.medium: "#cabba7"
accent.default: "#b57a4a"
code.string: "#3f8f4f"
code.function: "#3b6fd8"
panel.background: "#fbfaf7"
panel.border: "#ddd2c2"
```

### 23.7 Token model

Tessellum supports theme tokens for categories such as:

- backgrounds;
- text colors;
- borders;
- neutral palette values;
- accent palette values;
- semantic UI colors;
- sidebar colors;
- graph colors;
- code and inline code colors;
- panel and overlay colors;
- callout colors.

Examples of supported token keys include:

- `background.primary`
- `background.secondary`
- `text.primary`
- `text.secondary`
- `text.muted`
- `border.light`
- `border.medium`
- `accent.default`
- `panel.background`
- `panel.border`
- `graph.node`
- `graph.edge`
- `code.string`
- `code.function`
- `callout.info`
- `callout.warning`
- `callout.terminal`

### 23.8 Practical workflow for custom themes

1. Open your vault folder.
2. Navigate to `.tessellum/.themes`.
3. Create a new `.json`, `.yaml`, or `.yml` file.
4. Add the theme name, variant, and token values.
5. Save the file.
6. Return to Tessellum.
7. Open `Settings > Appearance`.
8. Select the new theme from the theme list.

> [!tip] Recommended method
> Start by defining only the most visible tokens first, such as background, text, border, accent, and panel colors. Expand the theme gradually if you want finer control.

---

## 24. Supported Content and Writing Features

Tessellum supports the following content types in normal user workflows:

- standard Markdown text;
- headings;
- ordered and unordered lists;
- task lists;
- quotes;
- dividers;
- wiki-links;
- inline code;
- fenced code blocks;
- callouts;
- Mermaid diagrams;
- tables;
- LaTeX formulas;
- embedded images;
- embedded PDFs;
- inline tags and frontmatter tags.

### 24.1 Wiki-links

Wiki-links use double brackets:

`[[Project Note]]`

These links connect notes and contribute to graph and backlink behavior.

### 24.2 Tags

Tags can be used:

- inline, for example `#project`;
- in frontmatter metadata.

### 24.3 Callouts

Callouts provide styled blocks such as:

- info
- note
- tip
- warning
- important
- success
- terminal

### 24.4 Mermaid diagrams

Mermaid code blocks are rendered as diagrams when written in fenced blocks labelled `mermaid`.

### 24.5 LaTeX

LaTeX is supported in:

- block formulas;
- inline formulas.

### 24.6 Media embeds

Images and PDFs can be embedded using the usual double-bracket embed format:

`![[assets/diagram.png]]`

---

## 25. Main Buttons and What They Do

This section summarizes the main user-facing buttons across the application.

### 25.1 Persistent global buttons

- Toggle Sidebar
- Back
- Forward
- Search / Back to Files
- Toggle Right Sidebar
- Toggle Local Graph
- Editor Mode selector
- Minimize
- Maximize / Restore
- Close window

### 25.2 Sidebar buttons

- Open Vault
- New Folder
- New Note
- Graph View
- Settings
- Trash

### 25.3 Search buttons

- Close Search
- Recent Search items

### 25.4 Graph buttons

- Back to Editor
- Show / Hide Query Panel
- Clear Query
- Examples

### 25.5 Trash buttons

- Restore
- Delete permanently
- Close

### 25.6 Settings buttons and selectors

- Settings tab selectors
- Theme selectors
- Theme schedule mode buttons
- Color pickers
- Toggle switches
- Dropdown selectors
- Sliders
- Settings close button

### 25.7 Context menu buttons

- Rename
- New Note
- New Note From Template
- New Folder
- Paste Files
- Export to PDF
- Copy
- Delete

---

## 26. Practical Task Guides

### 26.1 Create a new note

1. Open a vault.
2. Click **New Note** in the sidebar header, or use `Cmd/Ctrl + T`.
3. The note appears in the file tree.
4. Open it and begin writing.

### 26.2 Create a folder

1. Click **New Folder** in the sidebar header, or use a folder context menu.
2. Enter the folder name.
3. Confirm the action.

### 26.3 Create a note from a template

1. Open the folder context menu on the target folder.
2. Choose **New Note From Template**.
3. Enter the title.
4. Select a template or start fresh.

### 26.4 Search notes

1. Open Search.
2. Type a keyword, tag, or mixed query.
3. Select the desired result.

### 26.5 Visualize note relationships

1. Create notes with wiki-links between them.
2. Open **Graph View** from the sidebar footer.
3. Inspect the graph.
4. Optionally use the query panel to filter results.

### 26.6 Restore a deleted note

1. Open **Trash**.
2. Find the item.
3. Click **Restore**.

### 26.7 Export a note to PDF

1. Right-click a Markdown note in the file tree.
2. Choose **Export to PDF**.
3. Select the destination file path.

---

## 27. Best Practices

- Keep related notes in clearly named folders.
- Use headings so the Outline panel becomes useful.
- Use wiki-links to connect notes intentionally.
- Use tags for cross-cutting themes.
- Use templates for repeated note structures.
- Use Graph View for exploration, not as the only navigation method.
- Use Trash first instead of deleting content permanently.
- Keep custom themes in `.tessellum/.themes` and templates in `.tessellum/templates`.

---

## 28. Troubleshooting Guidance

### 28.1 I cannot see my note in search

Possible causes:

- the note was just created and indexing is still catching up;
- the query is too restrictive;
- the note does not contain the searched text or tag.

### 28.2 My custom theme does not appear

Check that:

- the file is inside `.tessellum/.themes`;
- the file extension is `.json`, `.yaml`, or `.yml`;
- the theme has a valid `name`;
- the theme has a valid `variant`;
- the file syntax is correct.

### 28.3 I deleted something by mistake

Open **Trash** and restore the item if it has not been permanently deleted.

### 28.4 The graph does not show what I expect

Check that:

- the notes contain valid wiki-links;
- the links point to the intended note names;
- the graph query panel is not filtering the graph unexpectedly.

---

## 29. Relationship with Companion Manuals

This user manual should be read together with:

- [2026-05-20-tessellum-installation-manual.md](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/docs/architecture/2026-05-20-tessellum-installation-manual.md), for software deployment on supported operating systems;
- [2026-05-20-tessellum-execution-manual.md](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/docs/architecture/2026-05-20-tessellum-execution-manual.md), for operational startup, runtime, and shutdown behavior;
- [2026-05-20-tessellum-programmers-manual.md](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/docs/architecture/2026-05-20-tessellum-programmers-manual.md), for internal architecture, maintenance, and extension guidance.

Together, these manuals cover deployment, execution, operation, and maintenance.

---

## 30. Final Notes

Tessellum is designed as a note-taking and knowledge-linking environment in which writing, organization, retrieval, and visual exploration form one continuous workflow.

For the final user, the most important pattern is simple:

1. create notes;
2. organize them;
3. connect them;
4. search them;
5. review them visually;
6. adapt the workspace using settings, plugins, and themes.

> [!success] Recommended first exercise
> Create three notes, connect them with `[[wiki links]]`, add one or two tags, then use Search, Backlinks, Outline, and Graph View to experience the complete Tessellum workflow.
