# 8.4. Detailed Design

This section documents the detailed design of the Tessellum application in compliance with the UNE-157801:2014 standard. It contains the catalog and specification of all relevant components in both the TypeScript frontend and the Rust backend, detailing their attributes, methods, inheritance/traits, responsibilities, and runtime observations.

## 8.4.2. Class Catalog and Specifications

Tessellum is structured using a hybrid, decoupled architecture:
- **TypeScript Subsystem**: Implements event-driven orchestration, sandbox plug-in facades, state management stores, and core UI layouts.
- **Rust Subsystem**: Executes heavy background indexers, Tantivy full-text index pipelines, SQLite WAL database management, and platform-level operations.

### 8.4.2.1. 1. Core Application Framework

#### 8.4.2.1.1. Class Plugin

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `Plugin` |
| **Type** | Abstract |
| **Description** | Base class for all plugins.  Lifecycle: 1. PluginRegistry instantiates the plugin 2. Registry sets `plugin.app` and `plugin.manifest` before calling `onload()` 3. Plugin calls convenience methods in `onload()` 4. Plugin calls `plugin[PLUGIN_CLEANUP]()` when the app is unloaded |
| **Inherited From** | `None` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Acts as the abstract base class defining the life-cycle methods (onload, onunload) for all runtime plugins. |
| R-2 | Tracks registered UI commands, translation bundles, and event handlers registered by a specific plugin. |
| R-3 | Coordinates clean automated resource teardown during plugin deactivation. |

##### Methods

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | Abstract | `void` | `onload` | *None* |
| Public | None | `void` | `onunload` | *None* |
| Public | None | `void` | `registerEditorExtension` | `ext: Extension \| Extension[]` |
| Public | None | `void` | `registerCommand` | `command: Command` |
| Public | None | `void` | `registerTranslations` | `bundles: PluginTranslationBundles` |
| Public | None | `void` | `registerEvent` | `ref: EventRef` |
| Public | None | `void` | `[PLUGIN_CLEANUP]` | *None* |

##### Attributes

| Access | Mode | Type or Class | Name |
| --- | --- | --- | --- |
| Public | None | `TessellumApp` | `app` |
| Public | None | `PluginManifest` | `manifest` |
| Private | None | `EventRef[]` | `_eventRefs` |

##### Observations

All plugin implementations must extend this class and override onload(). Internal tracking variables use protected symbols.

<div style="page-break-after: always;"></div>

#### 8.4.2.1.2. Class PluginRegistry

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `PluginRegistry` |
| **Type** | Concrete, Plugin |
| **Description** | Central registry for managing plugin lifecycle with error isolation.  Each plugin is registered with its manifest and class constructor. The registry owns instantiation, injects the app reference and handles load/unload with try/catch so one failure doesn't affect others. |
| **Inherited From** | `None` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Manages the registration, loading, and unloading of all built-in and third-party plugins. |
| R-2 | Ensures plugin error isolation so that runtime failures in one plugin do not crash the host application. |
| R-3 | Maintains state for enabled and disabled plugins, allowing dynamic activation/deactivation. |

##### Methods

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | None | `void` | `constructor` | `app: TessellumApp` |
| Public | None | `void` | `register` | `manifest: PluginManifest, PluginClass: new () => Plugin` |
| Public | None | `void` | `loadAll` | *None* |
| Public | None | `void` | `unloadAll` | *None* |
| Public | None | `void` | `enable` | `id: string` |
| Public | None | `void` | `disable` | `id: string` |
| Public | None | `T \| undefined` | `getPlugin` | `id: string` |
| Public | None | `boolean` | `isDisabled` | `id: string` |
| Public | None | `{ manifest: PluginManifest; enabled: boolean }[]` | `list` | *None* |
| Public | None | `void` | `initializeDisabled` | `ids: string[]` |
| Public | None | `{ ok: boolean; error?: string }` | `setEnabled` | `id: string, enabled: boolean` |

##### Attributes

| Access | Mode | Type or Class | Name |
| --- | --- | --- | --- |
| Private | None | `any` | `plugins` |
| Private | None | `any` | `disabled` |
| Private | None | `TessellumApp` | `app` |

##### Observations

Used exclusively by the core shell to boot plugins. Uses try/catch blocks to isolate and protect from malformed third-party codes.

<div style="page-break-after: always;"></div>

#### 8.4.2.1.3. Class TessellumApp

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `TessellumApp` |
| **Type** | Concrete, Singleton |
| **Description** | Central app singleton for managing plugins, events, and API access.  Accessible from anywhere: - Editor extensions: `TessellumApp.instance` - React components: `useTessellumApp()` hook  Use `TessellumApp.create()` instead of `new TessellumApp()` to create a new instance. |
| **Inherited From** | `None` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Orchestrates the global runtime lifecycle of the application. |
| R-2 | Provides centralized, type-safe API facades to plugins for Editor, Vault, Workspace, Commands, UI, and Internationalization. |
| R-3 | Exposes the main event bus for global inter-subsystem communication. |

##### Methods

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Private | None | `void` | `constructor` | *None* |
| Public | Static | `TessellumApp` | `create` | *None* |

##### Attributes

| Access | Mode | Type or Class | Name |
| --- | --- | --- | --- |
| Private | Static | `TessellumApp \| null` | `_instance` |
| Public | Final | `EditorAPI` | `editor` |
| Public | Final | `VaultAPI` | `vault` |
| Public | Final | `WorkspaceAPI` | `workspace` |
| Public | Final | `CommandAPI` | `commands` |
| Public | Final | `UIAPI` | `ui` |
| Public | Final | `I18nAPI` | `i18n` |
| Public | Final | `EventBus` | `events` |
| Public | Final | `PluginRegistry` | `plugins` |

##### Observations

Must be created via TessellumApp.create() static factory during initial window load. Singleton reference is accessible globally.

<div style="page-break-after: always;"></div>

### 8.4.2.2. 2. Built-in Extensibility Plugins

#### 8.4.2.2.1. Class CalloutPlugin

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `CalloutPlugin` |
| **Type** | Concrete, Plugin |
| **Description** | Callout Plugin — wraps the existing createCalloutPlugin factory. |
| **Inherited From** | `Plugin` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Hooks into the Tessellum core runtime to initialize the Callout subsystem. |
| R-2 | Registers markdown parsers, CodeMirror decoration widgets, settings tabs, or command hooks specific to this plugin. |

##### Methods

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | None | `any` | `onload` | *None* |

##### Attributes

| Access | Mode | Type or Class | Name |
| --- | --- | --- | --- |
| Public | Static | `PluginManifest` | `manifest` |

##### Observations

Designed for high reliability and clean lifecycle integration. Adheres to strict memory management standards.

<div style="page-break-after: always;"></div>

#### 8.4.2.2.2. Class CodePlugin

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `CodePlugin` |
| **Type** | Concrete, Plugin |
| **Description** | No active description. |
| **Inherited From** | `Plugin` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Hooks into the Tessellum core runtime to initialize the Code subsystem. |
| R-2 | Registers markdown parsers, CodeMirror decoration widgets, settings tabs, or command hooks specific to this plugin. |

##### Methods

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | None | `any` | `onload` | *None* |

##### Attributes

| Access | Mode | Type or Class | Name |
| --- | --- | --- | --- |
| Public | Static | `PluginManifest` | `manifest` |

##### Observations

Designed for high reliability and clean lifecycle integration. Adheres to strict memory management standards.

<div style="page-break-after: always;"></div>

#### 8.4.2.2.3. Class CoreCommandsPlugin

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `CoreCommandsPlugin` |
| **Type** | Concrete, Plugin |
| **Description** | Core Commands Plugin — registers all basic markdown slash commands. |
| **Inherited From** | `Plugin` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Hooks into the Tessellum core runtime to initialize the CoreCommands subsystem. |
| R-2 | Registers markdown parsers, CodeMirror decoration widgets, settings tabs, or command hooks specific to this plugin. |

##### Methods

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | None | `any` | `onload` | *None* |

##### Attributes

| Access | Mode | Type or Class | Name |
| --- | --- | --- | --- |
| Public | Static | `PluginManifest` | `manifest` |

##### Observations

Designed for high reliability and clean lifecycle integration. Adheres to strict memory management standards.

<div style="page-break-after: always;"></div>

#### 8.4.2.2.4. Class CoreUIActionsPlugin

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `CoreUIActionsPlugin` |
| **Type** | Concrete, Plugin |
| **Description** | No active description. |
| **Inherited From** | `Plugin` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Hooks into the Tessellum core runtime to initialize the CoreUIActions subsystem. |
| R-2 | Registers markdown parsers, CodeMirror decoration widgets, settings tabs, or command hooks specific to this plugin. |

##### Methods

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | None | `any` | `onload` | *None* |

##### Attributes

| Access | Mode | Type or Class | Name |
| --- | --- | --- | --- |
| Public | Static | `PluginManifest` | `manifest` |

##### Observations

Designed for high reliability and clean lifecycle integration. Adheres to strict memory management standards.

<div style="page-break-after: always;"></div>

#### 8.4.2.2.5. Class DailyNotesPlugin

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `DailyNotesPlugin` |
| **Type** | Concrete, Plugin |
| **Description** | No active description. |
| **Inherited From** | `Plugin` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Hooks into the Tessellum core runtime to initialize the DailyNotes subsystem. |
| R-2 | Registers markdown parsers, CodeMirror decoration widgets, settings tabs, or command hooks specific to this plugin. |

##### Methods

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | None | `any` | `onload` | *None* |

##### Attributes

| Access | Mode | Type or Class | Name |
| --- | --- | --- | --- |
| Public | Static | `PluginManifest` | `manifest` |

##### Observations

Designed for high reliability and clean lifecycle integration. Adheres to strict memory management standards.

<div style="page-break-after: always;"></div>

#### 8.4.2.2.6. Class DividerPlugin

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `DividerPlugin` |
| **Type** | Concrete, Plugin |
| **Description** | No active description. |
| **Inherited From** | `Plugin` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Hooks into the Tessellum core runtime to initialize the Divider subsystem. |
| R-2 | Registers markdown parsers, CodeMirror decoration widgets, settings tabs, or command hooks specific to this plugin. |

##### Methods

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | None | `any` | `onload` | *None* |

##### Attributes

| Access | Mode | Type or Class | Name |
| --- | --- | --- | --- |
| Public | Static | `PluginManifest` | `manifest` |

##### Observations

Designed for high reliability and clean lifecycle integration. Adheres to strict memory management standards.

<div style="page-break-after: always;"></div>

#### 8.4.2.2.7. Class FrontmatterPlugin

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `FrontmatterPlugin` |
| **Type** | Concrete, Plugin |
| **Description** | Frontmatter Plugin — renders YAML frontmatter as a properties widget. |
| **Inherited From** | `Plugin` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Hooks into the Tessellum core runtime to initialize the Frontmatter subsystem. |
| R-2 | Registers markdown parsers, CodeMirror decoration widgets, settings tabs, or command hooks specific to this plugin. |

##### Methods

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | None | `any` | `onload` | *None* |

##### Attributes

| Access | Mode | Type or Class | Name |
| --- | --- | --- | --- |
| Public | Static | `PluginManifest` | `manifest` |

##### Observations

Designed for high reliability and clean lifecycle integration. Adheres to strict memory management standards.

<div style="page-break-after: always;"></div>

#### 8.4.2.2.8. Class InlineCodePlugin

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `InlineCodePlugin` |
| **Type** | Concrete, Plugin |
| **Description** | No active description. |
| **Inherited From** | `Plugin` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Hooks into the Tessellum core runtime to initialize the InlineCode subsystem. |
| R-2 | Registers markdown parsers, CodeMirror decoration widgets, settings tabs, or command hooks specific to this plugin. |

##### Methods

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | None | `any` | `onload` | *None* |

##### Attributes

| Access | Mode | Type or Class | Name |
| --- | --- | --- | --- |
| Public | Static | `PluginManifest` | `manifest` |

##### Observations

Designed for high reliability and clean lifecycle integration. Adheres to strict memory management standards.

<div style="page-break-after: always;"></div>

#### 8.4.2.2.9. Class InlineTagsPlugin

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `InlineTagsPlugin` |
| **Type** | Concrete, Plugin |
| **Description** | Inline Tags Plugin — styles matching #tags inside the editor text view. |
| **Inherited From** | `Plugin` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Hooks into the Tessellum core runtime to initialize the InlineTags subsystem. |
| R-2 | Registers markdown parsers, CodeMirror decoration widgets, settings tabs, or command hooks specific to this plugin. |

##### Methods

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | None | `any` | `onload` | *None* |

##### Attributes

| Access | Mode | Type or Class | Name |
| --- | --- | --- | --- |
| Public | Static | `PluginManifest` | `manifest` |

##### Observations

Designed for high reliability and clean lifecycle integration. Adheres to strict memory management standards.

<div style="page-break-after: always;"></div>

#### 8.4.2.2.10. Class MarkdownPreviewPlugin

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `MarkdownPreviewPlugin` |
| **Type** | Concrete, Plugin |
| **Description** | No active description. |
| **Inherited From** | `Plugin` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Hooks into the Tessellum core runtime to initialize the MarkdownPreview subsystem. |
| R-2 | Registers markdown parsers, CodeMirror decoration widgets, settings tabs, or command hooks specific to this plugin. |

##### Methods

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | None | `any` | `onload` | *None* |

##### Attributes

| Access | Mode | Type or Class | Name |
| --- | --- | --- | --- |
| Public | Static | `PluginManifest` | `manifest` |

##### Observations

Designed for high reliability and clean lifecycle integration. Adheres to strict memory management standards.

<div style="page-break-after: always;"></div>

#### 8.4.2.2.11. Class MathPlugin

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `MathPlugin` |
| **Type** | Concrete, Plugin |
| **Description** | No active description. |
| **Inherited From** | `Plugin` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Hooks into the Tessellum core runtime to initialize the Math subsystem. |
| R-2 | Registers markdown parsers, CodeMirror decoration widgets, settings tabs, or command hooks specific to this plugin. |

##### Methods

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | None | `any` | `onload` | *None* |

##### Attributes

| Access | Mode | Type or Class | Name |
| --- | --- | --- | --- |
| Public | Static | `PluginManifest` | `manifest` |

##### Observations

Designed for high reliability and clean lifecycle integration. Adheres to strict memory management standards.

<div style="page-break-after: always;"></div>

#### 8.4.2.2.12. Class MediaEmbedPlugin

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `MediaEmbedPlugin` |
| **Type** | Concrete, Plugin |
| **Description** | No active description. |
| **Inherited From** | `Plugin` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Hooks into the Tessellum core runtime to initialize the MediaEmbed subsystem. |
| R-2 | Registers markdown parsers, CodeMirror decoration widgets, settings tabs, or command hooks specific to this plugin. |

##### Methods

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | None | `any` | `onload` | *None* |

##### Attributes

| Access | Mode | Type or Class | Name |
| --- | --- | --- | --- |
| Public | Static | `PluginManifest` | `manifest` |

##### Observations

Designed for high reliability and clean lifecycle integration. Adheres to strict memory management standards.

<div style="page-break-after: always;"></div>

#### 8.4.2.2.13. Class MediaPastePlugin

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `MediaPastePlugin` |
| **Type** | Concrete, Plugin |
| **Description** | No active description. |
| **Inherited From** | `Plugin` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Hooks into the Tessellum core runtime to initialize the MediaPaste subsystem. |
| R-2 | Registers markdown parsers, CodeMirror decoration widgets, settings tabs, or command hooks specific to this plugin. |

##### Methods

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | None | `any` | `onload` | *None* |

##### Attributes

| Access | Mode | Type or Class | Name |
| --- | --- | --- | --- |
| Public | Static | `PluginManifest` | `manifest` |

##### Observations

Designed for high reliability and clean lifecycle integration. Adheres to strict memory management standards.

<div style="page-break-after: always;"></div>

#### 8.4.2.2.14. Class MermaidPlugin

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `MermaidPlugin` |
| **Type** | Concrete, Plugin |
| **Description** | Mermaid Plugin — renders mermaid code blocks as diagrams. |
| **Inherited From** | `Plugin` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Hooks into the Tessellum core runtime to initialize the Mermaid subsystem. |
| R-2 | Registers markdown parsers, CodeMirror decoration widgets, settings tabs, or command hooks specific to this plugin. |

##### Methods

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | None | `any` | `onload` | *None* |

##### Attributes

| Access | Mode | Type or Class | Name |
| --- | --- | --- | --- |
| Public | Static | `PluginManifest` | `manifest` |

##### Observations

Designed for high reliability and clean lifecycle integration. Adheres to strict memory management standards.

<div style="page-break-after: always;"></div>

#### 8.4.2.2.15. Class Plugin

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `Plugin` |
| **Type** | Abstract |
| **Description** | Base class for all plugins.  Lifecycle: 1. PluginRegistry instantiates the plugin 2. Registry sets `plugin.app` and `plugin.manifest` before calling `onload()` 3. Plugin calls convenience methods in `onload()` 4. Plugin calls `plugin[PLUGIN_CLEANUP]()` when the app is unloaded |
| **Inherited From** | `None` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Acts as the abstract base class defining the life-cycle methods (onload, onunload) for all runtime plugins. |
| R-2 | Tracks registered UI commands, translation bundles, and event handlers registered by a specific plugin. |
| R-3 | Coordinates clean automated resource teardown during plugin deactivation. |

##### Methods

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | Abstract | `void` | `onload` | *None* |
| Public | None | `void` | `onunload` | *None* |
| Public | None | `void` | `registerEditorExtension` | `ext: Extension \| Extension[]` |
| Public | None | `void` | `registerCommand` | `command: Command` |
| Public | None | `void` | `registerTranslations` | `bundles: PluginTranslationBundles` |
| Public | None | `void` | `registerEvent` | `ref: EventRef` |
| Public | None | `void` | `[PLUGIN_CLEANUP]` | *None* |

##### Attributes

| Access | Mode | Type or Class | Name |
| --- | --- | --- | --- |
| Public | None | `TessellumApp` | `app` |
| Public | None | `PluginManifest` | `manifest` |
| Private | None | `EventRef[]` | `_eventRefs` |

##### Observations

All plugin implementations must extend this class and override onload(). Internal tracking variables use protected symbols.

<div style="page-break-after: always;"></div>

#### 8.4.2.2.16. Class TablePlugin

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `TablePlugin` |
| **Type** | Concrete, Plugin |
| **Description** | No active description. |
| **Inherited From** | `Plugin` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Hooks into the Tessellum core runtime to initialize the Table subsystem. |
| R-2 | Registers markdown parsers, CodeMirror decoration widgets, settings tabs, or command hooks specific to this plugin. |

##### Methods

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | None | `any` | `onload` | *None* |

##### Attributes

| Access | Mode | Type or Class | Name |
| --- | --- | --- | --- |
| Public | Static | `PluginManifest` | `manifest` |

##### Observations

Designed for high reliability and clean lifecycle integration. Adheres to strict memory management standards.

<div style="page-break-after: always;"></div>

#### 8.4.2.2.17. Class TaskListPlugin

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `TaskListPlugin` |
| **Type** | Concrete, Plugin |
| **Description** | No active description. |
| **Inherited From** | `Plugin` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Hooks into the Tessellum core runtime to initialize the TaskList subsystem. |
| R-2 | Registers markdown parsers, CodeMirror decoration widgets, settings tabs, or command hooks specific to this plugin. |

##### Methods

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | None | `any` | `onload` | *None* |

##### Attributes

| Access | Mode | Type or Class | Name |
| --- | --- | --- | --- |
| Public | Static | `PluginManifest` | `manifest` |

##### Observations

Designed for high reliability and clean lifecycle integration. Adheres to strict memory management standards.

<div style="page-break-after: always;"></div>

#### 8.4.2.2.18. Class WikiLinkPlugin

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `WikiLinkPlugin` |
| **Type** | Concrete, Plugin |
| **Description** | WikiLink Plugin — wraps the existing createWikiLinkPlugin factory.  Navigation on link click delegates back to WorkspaceAPI.openNote(). |
| **Inherited From** | `Plugin` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Hooks into the Tessellum core runtime to initialize the WikiLink subsystem. |
| R-2 | Registers markdown parsers, CodeMirror decoration widgets, settings tabs, or command hooks specific to this plugin. |

##### Methods

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | None | `any` | `onload` | *None* |

##### Attributes

| Access | Mode | Type or Class | Name |
| --- | --- | --- | --- |
| Public | Static | `PluginManifest` | `manifest` |

##### Observations

Designed for high reliability and clean lifecycle integration. Adheres to strict memory management standards.

<div style="page-break-after: always;"></div>

### 8.4.2.3. 3. React UI Components

#### 8.4.2.3.1. Class App

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `App` |
| **Type** | Concrete, React UI Component |
| **Description** | Main shell layout coordinator orchestrating sidebar toggles, panel resizing, theme bindings, command palette overlays, and primary split pane rendering. |
| **Inherited From** | `React.Component` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Coordinates top-level workspace layout and panels sizing dynamic boundaries. |
| R-2 | Initializes and binds the theme styling matching active user configurations. |
| R-3 | Hooks global keyboard shortcuts triggering command palettes or fuzzy search modalities. |

##### Methods

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | None | `JSX.Element` | `render` | `*None*` |
| Private | None | `void` | `handleResize` | `width: number` |
| Private | None | `void` | `toggleSidebar` | `*None*` |
| Private | None | `void` | `triggerCommandPalette` | `*None*` |

##### Attributes

| Access | Mode | Type or Class | Name |
| --- | --- | --- | --- |
| Private | None | `boolean` | `sidebarOpen` |
| Private | None | `number` | `sidebarWidth` |

##### Observations

Mounts once at window init. Listens to resize and mouseup window events for persistent panel widths.

<div style="page-break-after: always;"></div>

#### 8.4.2.3.2. Class CommandPalette

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `CommandPalette` |
| **Type** | Concrete, React UI Component |
| **Description** | Fuzzy search command trigger modal overlay matching keywords to registered keyboard shortcuts. |
| **Inherited From** | `React.Component` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Lists all active UI actions registered by loaded plugins. |
| R-2 | Executes fuzzy scoring algorithms on active search inputs. |
| R-3 | Triggers action callbacks upon enter click. |

##### Methods

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | None | `JSX.Element` | `render` | `*None*` |
| Private | None | `void` | `filterCommands` | `query: string` |

##### Attributes

| Access | Mode | Type or Class | Name |
| --- | --- | --- | --- |
| Public | None | `boolean` | `isOpen` |
| Public | None | `() => void` | `onClose` |

##### Observations

Closes automatically on Escape keypress or outside click.

<div style="page-break-after: always;"></div>

#### 8.4.2.3.3. Class Editor

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `Editor` |
| **Type** | Concrete, React UI Component |
| **Description** | Premium CodeMirror 6 markdown editor surface wrapper binding vault file contents and custom plugins compartments. |
| **Inherited From** | `React.Component` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Instantiates and updates the CodeMirror 6 editor view container. |
| R-2 | Reconfigures CodeMirror editor compartments when active plugins register decorations. |
| R-3 | Sends note write callbacks on content modification buffers. |

##### Methods

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | None | `JSX.Element` | `render` | `*None*` |
| Private | None | `void` | `onUpdate` | `view: EditorView` |
| Public | None | `void` | `focus` | `*None*` |

##### Attributes

| Access | Mode | Type or Class | Name |
| --- | --- | --- | --- |
| Public | None | `string` | `file` |
| Public | None | `string` | `content` |
| Public | None | `(val: string) => void` | `onChange` |

##### Observations

Optimizes editor redraws using shallow comparison on file name updates to prevent typing lag.

<div style="page-break-after: always;"></div>

#### 8.4.2.3.4. Class FileTree

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `FileTree` |
| **Type** | Concrete, React UI Component |
| **Description** | Renders the nested tree view of files and folders inside the active user vault. |
| **Inherited From** | `React.Component` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Renders directories and note files in a collapsible, structured catalog. |
| R-2 | Handles right-click events launching context menus for create/delete/rename. |

##### Methods

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | None | `JSX.Element` | `render` | `*None*` |
| Private | None | `void` | `handleItemClick` | `path: string` |

##### Attributes

| Access | Mode | Type or Class | Name |
| --- | --- | --- | --- |
| Public | None | `FileMetadata[]` | `files` |
| Public | None | `string` | `activePath` |
| Public | None | `(path: string) => void` | `onSelect` |

##### Observations

Sorts directories alphabetically first, then note files.

<div style="page-break-after: always;"></div>

#### 8.4.2.3.5. Class GraphView

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `GraphView` |
| **Type** | Concrete, React UI Component |
| **Description** | Visualizes note nodes and bi-directional links using an interactive force-directed HTML canvas. |
| **Inherited From** | `React.Component` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Generates nodes and edges mapped from the vault links database. |
| R-2 | Executes force simulations (collision, center, link) to coordinate coordinate updates. |
| R-3 | Supports mouse pan, zoom, and node click navigation. |

##### Methods

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | None | `JSX.Element` | `render` | `*None*` |
| Private | None | `void` | `startSimulation` | `*None*` |

##### Attributes

| Access | Mode | Type or Class | Name |
| --- | --- | --- | --- |
| Public | None | `GraphNode[]` | `nodes` |
| Public | None | `GraphEdge[]` | `edges` |

##### Observations

Leverages HTML Canvas rather than SVG to preserve 60fps rendering in vaults with thousands of note nodes.

<div style="page-break-after: always;"></div>

#### 8.4.2.3.6. Class Settings

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `Settings` |
| **Type** | Concrete, React UI Component |
| **Description** | Modal panel housing app configurations, active themes, translation configurations, and exclude patterns. |
| **Inherited From** | `React.Component` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Renders tabs for general, editor, plugin and language configurations. |
| R-2 | Updates persistent workspace stores when settings parameters change. |

##### Methods

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | None | `JSX.Element` | `render` | `*None*` |

##### Attributes

| Access | Mode | Type or Class | Name |
| --- | --- | --- | --- |
| Public | None | `boolean` | `isOpen` |
| Public | None | `() => void` | `onClose` |

##### Observations

Interacts directly with backend app config write endpoints to save adjustments.

<div style="page-break-after: always;"></div>

#### 8.4.2.3.7. Class Sidebar

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `Sidebar` |
| **Type** | Concrete, React UI Component |
| **Description** | Left vertical layout bar rendering file trees, daily notes commands, settings modal triggers, and the trash container. |
| **Inherited From** | `React.Component` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Displays core navigation buttons for settings, daily note generation, and search. |
| R-2 | Combines and renders the active VaultFileTree. |

##### Methods

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | None | `JSX.Element` | `render` | `*None*` |

##### Attributes

*No exposed attributes defined.*

##### Observations

Collapsible panel whose width can be adjusted dynamically by dragging the separator handle.

<div style="page-break-after: always;"></div>

#### 8.4.2.3.8. Class TemplatePicker

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `TemplatePicker` |
| **Type** | Concrete, React UI Component |
| **Description** | Overlay fuzzy modal to select and generate notes from custom templates. |
| **Inherited From** | `React.Component` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Lists files in the designated templates folder. |
| R-2 | Triggers backend templates generation with dynamic variables substitution. |

##### Methods

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | None | `JSX.Element` | `render` | `*None*` |

##### Attributes

| Access | Mode | Type or Class | Name |
| --- | --- | --- | --- |
| Public | None | `boolean` | `isOpen` |
| Public | None | `() => void` | `onClose` |

##### Observations

Filters out non-markdown templates dynamically.

<div style="page-break-after: always;"></div>

#### 8.4.2.3.9. Class TrashModal

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `TrashModal` |
| **Type** | Concrete, React UI Component |
| **Description** | View list of deleted notes, allowing permanent deletion or structural recovery. |
| **Inherited From** | `React.Component` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Fetches and lists all active trash database entries. |
| R-2 | Triggers backend restore or permanent delete endpoints. |

##### Methods

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | None | `JSX.Element` | `render` | `*None*` |

##### Attributes

| Access | Mode | Type or Class | Name |
| --- | --- | --- | --- |
| Public | None | `boolean` | `isOpen` |
| Public | None | `() => void` | `onClose` |

##### Observations

Supports batch operations to empty trash in a single transaction.

<div style="page-break-after: always;"></div>

### 8.4.2.4. 4. Zustand State Stores

#### 8.4.2.4.1. Class useSearchStore

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `useSearchStore` |
| **Type** | Concrete, Zustand State Store |
| **Description** | Handles cache memories for search queries, matching document indices, and search highlights. |
| **Inherited From** | `None` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Tracks search input string values. |
| R-2 | Caches active search results arrays fetched from the Tantivy engine. |

##### Methods

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | None | `void` | `setQuery` | `query: string` |
| Public | None | `void` | `setHits` | `hits: SearchHit[]` |

##### Attributes

| Access | Mode | Type or Class | Name |
| --- | --- | --- | --- |
| Public | None | `string` | `query` |
| Public | None | `SearchHit[]` | `hits` |
| Public | None | `boolean` | `searching` |

##### Observations

Connects directly with notes search endpoints to run queries as you type.

<div style="page-break-after: always;"></div>

#### 8.4.2.4.2. Class useThemeStore

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `useThemeStore` |
| **Type** | Concrete, Zustand State Store |
| **Description** | Manages user display themes, active color accents, typography families, and editor styling rules. |
| **Inherited From** | `None` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Coordinates active accent stylesheets overrides. |
| R-2 | Binds matching theme configurations to standard CSS variables. |

##### Methods

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | None | `void` | `setTheme` | `theme: "light" | "dark"` |
| Public | None | `void` | `setFontFamily` | `font: string` |

##### Attributes

| Access | Mode | Type or Class | Name |
| --- | --- | --- | --- |
| Public | None | `"light" | "dark"` | `theme` |
| Public | None | `string` | `fontFamily` |

##### Observations

Persists configurations to localStorage to ensure immediate theme painting on window boot.

<div style="page-break-after: always;"></div>

#### 8.4.2.4.3. Class useUIStore

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `useUIStore` |
| **Type** | Concrete, Zustand State Store |
| **Description** | Orchestrates the active visibility boundaries of layouts, modals, and panel sizes. |
| **Inherited From** | `None` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Tracks sidebar expansion states. |
| R-2 | Tracks overlay modal visibilities (Command palette, Settings, Trash). |

##### Methods

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | None | `void` | `toggleSidebar` | `*None*` |
| Public | None | `void` | `openModal` | `modalName: string` |
| Public | None | `void` | `closeModal` | `*None*` |

##### Attributes

| Access | Mode | Type or Class | Name |
| --- | --- | --- | --- |
| Public | None | `boolean` | `sidebarOpen` |
| Public | None | `string | null` | `activeModal` |

##### Observations

Used by keyboard shortcut controllers to toggle panel views globally.

<div style="page-break-after: always;"></div>

#### 8.4.2.4.4. Class useVaultStore

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `useVaultStore` |
| **Type** | Concrete, Zustand State Store |
| **Description** | Coordinates state metadata caches for indexed notes, asset mappings, bi-directional backlinks, and tags. |
| **Inherited From** | `None` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Holds the root folder directory path of the loaded vault. |
| R-2 | Caches the full nested files tree metadata. |
| R-3 | Coordinates real-time update triggers from the Rust file watcher. |

##### Methods

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | None | `void` | `setVaultPath` | `path: string` |
| Public | None | `void` | `setFiles` | `files: FileMetadata[]` |
| Public | None | `void` | `updateFile` | `path: string, metadata: FileMetadata` |

##### Attributes

| Access | Mode | Type or Class | Name |
| --- | --- | --- | --- |
| Public | None | `string` | `vaultPath` |
| Public | None | `FileMetadata[]` | `files` |
| Public | None | `Map<string, string[]>` | `backlinks` |

##### Observations

Clears all cache memories dynamically when a new vault directory is loaded.

<div style="page-break-after: always;"></div>

#### 8.4.2.4.5. Class useWorkspaceStore

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `useWorkspaceStore` |
| **Type** | Concrete, Zustand State Store |
| **Description** | Manages state details for open files tabs, split windows, active editing buffers, and navigational history. |
| **Inherited From** | `None` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Tracks the currently active note path. |
| R-2 | Coordinates tabs adding, closing, and ordering arrays. |
| R-3 | Maintains window split configurations. |

##### Methods

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | None | `void` | `setActiveFile` | `path: string` |
| Public | None | `void` | `openFile` | `path: string` |
| Public | None | `void` | `closeFile` | `path: string` |

##### Attributes

| Access | Mode | Type or Class | Name |
| --- | --- | --- | --- |
| Public | None | `string | null` | `activeFile` |
| Public | None | `string[]` | `openFiles` |
| Public | None | `string[]` | `navHistory` |

##### Observations

Subscribed to by the main layout shell to render corresponding tab contents.

<div style="page-break-after: always;"></div>

### 8.4.2.5. 5. Rust Platform Backend Components

#### 8.4.2.5.1. Component AppStateModule

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `AppStateModule` |
| **Type** | Concrete, Rust Module |
| **File Path** | `src-tauri/src/models/app_state.rs` |
| **Description** | Procedural module class encapsulating free-standing functions inside `src-tauri/src/models/app_state.rs`. |
| **Traits / Inheritance** | `Serialize, Deserialize, Clone` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Coordinates operations and encapsulates free-standing functions inside the AppStateModule module. |

##### Methods & Functions

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Private | Static | `Self` | `default` | *None* |
| Public | Static | `Self` | `new` | `db: Database, search_index: SearchIndex` |

##### Attributes & Fields

| Access | Mode | Type or Struct | Name |
| --- | --- | --- | --- |
| Public | None | `SearchReadinessStatus` | `status` |
| Public | None | `u32` | `attempt_count` |
| Public | None | `u32` | `max_attempts` |
| Public | None | `Option<String>` | `last_error` |
| Public | None | `Option<String>` | `vault_path` |

##### Internal Data Structures (Structs)

The following structures are defined inside `src-tauri/src/models/app_state.rs` and are scoped directly under AppStateModule:

###### Struct `SearchReadinessState`

Data structure scoped under AppStateModule.

| Access | Mode | Type or Struct | Field Name |
| --- | --- | --- | --- |
| Public | None | `SearchReadinessStatus` | `status` |
| Public | None | `u32` | `attempt_count` |
| Public | None | `u32` | `max_attempts` |
| Public | None | `Option<String>` | `last_error` |
| Public | None | `Option<String>` | `vault_path` |

###### Struct `AppState`

Represents the application state that contains shared resources such as a file watcher and a database connection.  # Fields  * `watcher` - A thread-safe, optional wrapper around a `RecommendedWatcher` instance. This watcher is typically used for monitoring file system events. It is wrapped in a `Mutex` to ensure safe concurrent access across threads.  * `db` - A thread-safe, optional shared reference to a `Database` instance. The `Database` is wrapped in an `Arc` for shared ownership across threads. Internally, sqlx handles concurrent access through its connection pool.  * `file_index` - Cached FileIndex to resolve links quickly without traversing the FS. * `asset_index` - Cached AssetIndex for media embeds.

| Access | Mode | Type or Struct | Field Name |
| --- | --- | --- | --- |
| Public | None | `tokio::sync::Mutex<Option<RecommendedWatcher>>` | `watcher` |
| Public | None | `Arc<Database>` | `db` |
| Public | None | `Arc<Mutex<Option<FileIndex>>>` | `file_index` |
| Public | None | `Arc<Mutex<Option<AssetIndex>>>` | `asset_index` |
| Public | None | `Arc<Mutex<SearchIndex>>` | `search_index` |
| Public | None | `Mutex<SearchReadinessState>` | `search_readiness` |

##### Observations

Utilizes Serde traits to automatically serialize data models crossing the Tauri IPC bridge.

<div style="page-break-after: always;"></div>

#### 8.4.2.5.2. Component AssetIndex

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `AssetIndex` |
| **Type** | Concrete, Rust Module |
| **File Path** | `src-tauri/src/models/asset_index.rs` |
| **Description** | Backend component orchestrating operations inside `src-tauri/src/models/asset_index.rs`. |
| **Traits / Inheritance** | `Serialize, Deserialize, Clone` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Coordinates operations and encapsulates free-standing functions inside the AssetIndex module. |

##### Methods & Functions

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | Static | `Result<Self, String>` | `build` | `vault_path: &str` |
| Public | None | `Option<PathBuf>` | `resolve` | `vault_path: &str, link_target: &str` |

##### Attributes & Fields

| Access | Mode | Type or Struct | Name |
| --- | --- | --- | --- |
| Private | None | `HashMap<String` | `name_to_paths` |

##### Observations

Utilizes Serde traits to automatically serialize data models crossing the Tauri IPC bridge.

<div style="page-break-after: always;"></div>

#### 8.4.2.5.3. Component AssetsModule

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `AssetsModule` |
| **Type** | Concrete, Tauri IPC Commands Module |
| **File Path** | `src-tauri/src/commands/assets.rs` |
| **Description** | Procedural module class encapsulating free-standing functions inside `src-tauri/src/commands/assets.rs`. |
| **Traits / Inheritance** | `Serialize, Deserialize, Clone` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Coordinates operations and encapsulates free-standing functions inside the AssetsModule module. |

##### Methods & Functions

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Private | Static | `bool` | `is_supported_ext` | `ext: &str` |
| Private | Static | `bool` | `is_supported_asset` | `path: &Path` |
| Private | Static | `String` | `to_asset_path` | `path: &Path` |
| Private | Static, Async | `Result<Option<String>, TessellumError>` | `resolve_asset_inner` | `state: &AppState, vault_path: &str, target: &str, source_path: Option<&str>, mode: &str` |
| Private | Static, Async | `Result<String, TessellumError>` | `save_asset_inner` | `state: &AppState, vault_path: &str, target_dir: &str, base_name: &str, extension: &str, bytes: Vec<u8>` |
| Public | Static, Async | `Result<Option<String>, TessellumError>` | `resolve_asset` | `state: State<'_, AppState>, vault_path: String, target: String, source_path: Option<String>, mode: String` |
| Public | Static, Async | `Result<String, TessellumError>` | `save_asset` | `state: State<'_, AppState>, vault_path: String, target_dir: String, base_name: String, extension: String, bytes: Vec<u8>` |

##### Attributes & Fields

*No attributes or fields defined.*

##### Observations

Utilizes Serde traits to automatically serialize data models crossing the Tauri IPC bridge.

<div style="page-break-after: always;"></div>

#### 8.4.2.5.4. Component ClipboardModule

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `ClipboardModule` |
| **Type** | Concrete, Tauri IPC Commands Module |
| **File Path** | `src-tauri/src/commands/clipboard.rs` |
| **Description** | Procedural module class encapsulating free-standing functions inside `src-tauri/src/commands/clipboard.rs`. |
| **Traits / Inheritance** | `Serialize, Deserialize, Clone` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Coordinates operations and encapsulates free-standing functions inside the ClipboardModule module. |

##### Methods & Functions

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Private | Static | `(&str, &str)` | `split_file_name` | `file_name: &str` |
| Private | Static | `bool) -> String` | `next_available_name` | `file_name: &str, exists: impl Fn(&str` |
| Private | Static | `PathBuf` | `resolve_unique_target_path` | `destination_dir: &Path, file_name: &str` |
| Private | Static, Async | `Result<String, TessellumError>` | `copy_file_entry` | `source_path: &Path, destination_dir: &Path` |
| Private | Static, Async | `Result<(), TessellumError>` | `copy_directory_contents` | `source_dir: &Path, destination_dir: &Path` |
| Private | Static, Async | `Result<String, TessellumError>` | `copy_directory_entry` | `source_path: &Path, destination_dir: &Path` |
| Private | Static, Async | `Result<Option<String>, TessellumError>` | `copy_clipboard_entry` | `source_path: &Path, destination_dir: &Path` |
| Private | Static | `Result<Vec<u8>, TessellumError>` | `build_file_drop_data` | `paths: &[PathBuf]` |
| Private | Static | `Result<Vec<PathBuf>, TessellumError>` | `read_clipboard_file_paths` | *None* |
| Private | Static | `Result<Vec<PathBuf>, TessellumError>` | `read_clipboard_file_paths` | *None* |
| Private | Static | `Result<(), TessellumError>` | `write_clipboard_file_paths` | `paths: &[PathBuf]` |
| Private | Static | `Result<(), TessellumError>` | `write_clipboard_file_paths` | `_: &[PathBuf]` |
| Public | Static, Async | `Result<(), TessellumError>` | `write_file_paths_to_clipboard` | `paths: Vec<String>` |
| Public | Static, Async | `Result<ClipboardImportResult, TessellumError>` | `import_clipboard_files` | `vault_path: String, destination_dir: String` |

##### Attributes & Fields

| Access | Mode | Type or Struct | Name |
| --- | --- | --- | --- |
| Public | None | `Vec<String>` | `imported_paths` |
| Public | None | `usize` | `skipped_count` |

##### Internal Data Structures (Structs)

The following structures are defined inside `src-tauri/src/commands/clipboard.rs` and are scoped directly under ClipboardModule:

###### Struct `ClipboardImportResult`

Data structure scoped under ClipboardModule.

| Access | Mode | Type or Struct | Field Name |
| --- | --- | --- | --- |
| Public | None | `Vec<String>` | `imported_paths` |
| Public | None | `usize` | `skipped_count` |

###### Struct `DropFilesHeader`

Data structure scoped under ClipboardModule.

| Access | Mode | Type or Struct | Field Name |
| --- | --- | --- | --- |
| Private | None | `u32` | `p_files` |
| Private | None | `i32` | `pt_x` |
| Private | None | `i32` | `pt_y` |
| Private | None | `i32` | `f_nc` |
| Private | None | `i32` | `f_wide` |

##### Observations

Utilizes Serde traits to automatically serialize data models crossing the Tauri IPC bridge.

<div style="page-break-after: always;"></div>

#### 8.4.2.5.5. Component ConfigModule

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `ConfigModule` |
| **Type** | Concrete, Pure Utility Module |
| **File Path** | `src-tauri/src/utils/config.rs` |
| **Description** | Procedural module class encapsulating free-standing functions inside `src-tauri/src/utils/config.rs`. |
| **Traits / Inheritance** | `Serialize, Deserialize, Clone` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Coordinates operations and encapsulates free-standing functions inside the ConfigModule module. |

##### Methods & Functions

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Private | Static | `Self` | `default` | *None* |
| Private | Static | `Self` | `default` | *None* |
| Private | Static | `String` | `default_daily_notes_path_template` | *None* |
| Private | Static | `String` | `default_daily_notes_template_name` | *None* |
| Public | Static | `PathBuf` | `config_path` | `vault_path: &str` |
| Public | Static | `Result<AppConfig, TessellumError>` | `load_or_init_config` | `vault_path: &str` |
| Private | Static | `Result<(), TessellumError>` | `write_config` | `path: &Path, config: &AppConfig` |

##### Attributes & Fields

| Access | Mode | Type or Struct | Name |
| --- | --- | --- | --- |
| Public | None | `String` | `path_template` |
| Public | None | `String` | `template_name` |

##### Internal Data Structures (Structs)

The following structures are defined inside `src-tauri/src/utils/config.rs` and are scoped directly under ConfigModule:

###### Struct `DailyNotesConfig`

Data structure scoped under ConfigModule.

| Access | Mode | Type or Struct | Field Name |
| --- | --- | --- | --- |
| Public | None | `String` | `path_template` |
| Public | None | `String` | `template_name` |

###### Struct `AppConfig`

Data structure scoped under ConfigModule.

| Access | Mode | Type or Struct | Field Name |
| --- | --- | --- | --- |
| Public | None | `DailyNotesConfig` | `daily_notes` |

##### Observations

Utilizes Serde traits to automatically serialize data models crossing the Tauri IPC bridge.

<div style="page-break-after: always;"></div>

#### 8.4.2.5.6. Component Database

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `Database` |
| **Type** | Concrete, Connection Pool |
| **File Path** | `src-tauri/src/db.rs` |
| **Description** | Backend component orchestrating operations inside `src-tauri/src/db.rs`. |
| **Traits / Inheritance** | `Serialize, Deserialize, Clone` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Manages the sqlx SQLite connection pool with WAL mode execution. |
| R-2 | Executes database migrations and table setups for notes, tags, and links. |
| R-3 | Coordinates bi-directional link and backlink persistence and transactional updates. |
| R-4 | Exposes robust search, rename, delete, and tags query operations. |

##### Methods & Functions

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | Static, Async | `Result<Self, sqlx::Error>` | `init` | `db_path: &str` |
| Public | Async | `Result<(), sqlx::Error>` | `index_file` | `path: &str, modified: i64, size: u64, frontmatter_json: Option<&str>, inline_tags_json: Option<&str>, resolved_links: &[String]` |
| Public | Async | `Result<(), sqlx::Error>` | `set_note_tags` | `path: &str, tags: &[String]` |
| Public | Async | `Result<Vec<String>, sqlx::Error>` | `get_outgoing_links` | `source_path: &str` |
| Public | Async | `Result<Vec<String>, sqlx::Error>` | `get_backlinks` | `target_path: &str` |
| Public | Async | `Result<Vec<(String, String)>, sqlx::Error>` | `get_all_links` | *None* |
| Public | Async | `Result<(), sqlx::Error>` | `update_file_path` | `old_path: &str, new_path: &str` |
| Public | Async | `Result<(), sqlx::Error>` | `delete_file` | `path: &str` |
| Public | Async | `Result<usize, sqlx::Error>` | `delete_files_by_prefix` | `prefix: &str` |
| Public | Async | `Result<Vec<String>, sqlx::Error>` | `get_orphaned_files` | *None* |
| Public | Async | `Result<Vec<(String, String)>, sqlx::Error>` | `get_broken_links` | *None* |
| Public | Async | `Result<Vec<(String, i64)>, sqlx::Error>` | `get_all_indexed_files` | *None* |
| Public | Async | `Result<Vec<(String, i64, i64)>, sqlx::Error>` | `get_all_search_files` | *None* |
| Public | Async | `Result<(), sqlx::Error>` | `upsert_search_file` | `path: &str, modified: i64, is_markdown: bool` |
| Public | Async | `Result<usize, sqlx::Error>` | `delete_search_files` | `paths: &[String]` |
| Public | Async | `Result<(), sqlx::Error>` | `update_search_file_path` | `old_path: &str, new_path: &str` |
| Public | Async | `Result<usize, sqlx::Error>` | `batch_delete_files` | `paths: &[String]` |
| Public | Async | `Result<(Vec<String>, u32), sqlx::Error>` | `search_notes_by_tags` | `tags: &[String], match_all: bool, limit: u32, offset: u32` |
| Public | Async | `Result<Option<String>, sqlx::Error>` | `get_frontmatter` | `path: &str` |
| Public | Async | `Result<Vec<String>, sqlx::Error>` | `get_all_tags` | *None* |
| Public | Async | `Result<std::collections::HashMap<String, Vec<String>>, sqlx::Error>` | `get_files_tags` | *None* |
| Public | Async | `Result<Vec<String>, sqlx::Error>` | `get_file_tags` | `path: &str` |
| Public | Async | `Result<Vec<String>, sqlx::Error>` | `get_all_property_keys` | *None* |
| Public | Async | `Result<Option<(String, String, Vec<String>)>, sqlx::Error>` | `get_note_projection` | `note_id: &str` |
| Public | Async | `Result<Vec<(String, String, Vec<String>)>, sqlx::Error>` | `get_note_projection_rows` | *None* |

##### Attributes & Fields

| Access | Mode | Type or Struct | Name |
| --- | --- | --- | --- |
| Private | None | `Pool<Sqlite>` | `pool` |

##### Observations

Must be initialized once at startup using Database::init(). Implements SqlitePool for multi-threaded safety. Runs PRAGMA foreign_keys = ON.

<div style="page-break-after: always;"></div>

#### 8.4.2.5.7. Component ErrorModule

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `ErrorModule` |
| **Type** | Concrete, Rust Module |
| **File Path** | `src-tauri/src/error.rs` |
| **Description** | Procedural module class encapsulating free-standing functions inside `src-tauri/src/error.rs`. |
| **Traits / Inheritance** | `Serialize, Deserialize, Clone` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Coordinates operations and encapsulates free-standing functions inside the ErrorModule module. |

##### Methods & Functions

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Private | Static | `Self` | `from` | `e: TessellumError` |

##### Attributes & Fields

*No attributes or fields defined.*

##### Observations

Utilizes Serde traits to automatically serialize data models crossing the Tauri IPC bridge.

<div style="page-break-after: always;"></div>

#### 8.4.2.5.8. Component FileIndex

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `FileIndex` |
| **Type** | Concrete, Rust Module |
| **File Path** | `src-tauri/src/models/file_index.rs` |
| **Description** | Backend component orchestrating operations inside `src-tauri/src/models/file_index.rs`. |
| **Traits / Inheritance** | `Serialize, Deserialize, Clone` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Coordinates operations and encapsulates free-standing functions inside the FileIndex module. |

##### Methods & Functions

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | Static | `Result<Self, String>` | `build` | `vault_path: &str` |
| Public | None | `Option<PathBuf>` | `resolve` | `vault_path: &str, link_target: &str` |
| Public | None | `PathBuf` | `resolve_or_default` | `vault_path: &str, link_target: &str` |

##### Attributes & Fields

| Access | Mode | Type or Struct | Name |
| --- | --- | --- | --- |
| Private | None | `HashMap<String` | `name_to_paths` |

##### Observations

Utilizes Serde traits to automatically serialize data models crossing the Tauri IPC bridge.

<div style="page-break-after: always;"></div>

#### 8.4.2.5.9. Component FileMetadata

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `FileMetadata` |
| **Type** | Concrete, Rust Module |
| **File Path** | `src-tauri/src/models/file_metadata.rs` |
| **Description** | Backend component orchestrating operations inside `src-tauri/src/models/file_metadata.rs`. |
| **Traits / Inheritance** | `Serialize, Deserialize, Clone` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Coordinates operations and encapsulates free-standing functions inside the FileMetadata module. |

##### Methods & Functions

*No exposed methods or functions defined.*

##### Attributes & Fields

| Access | Mode | Type or Struct | Name |
| --- | --- | --- | --- |
| Public | None | `String` | `path` |
| Public | None | `String` | `filename` |
| Public | None | `bool` | `is_dir` |
| Public | None | `u64` | `size` |
| Public | None | `i64` | `last_modified` |

##### Observations

Utilizes Serde traits to automatically serialize data models crossing the Tauri IPC bridge.

<div style="page-break-after: always;"></div>

#### 8.4.2.5.10. Component FoldersModule

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `FoldersModule` |
| **Type** | Concrete, Tauri IPC Commands Module |
| **File Path** | `src-tauri/src/commands/folders.rs` |
| **Description** | Procedural module class encapsulating free-standing functions inside `src-tauri/src/commands/folders.rs`. |
| **Traits / Inheritance** | `Serialize, Deserialize, Clone` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Coordinates operations and encapsulates free-standing functions inside the FoldersModule module. |

##### Methods & Functions

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | Static, Async | `Result<String, String>` | `create_folder` | `vault_path: String, folder_name: String` |

##### Attributes & Fields

*No attributes or fields defined.*

##### Observations

Utilizes Serde traits to automatically serialize data models crossing the Tauri IPC bridge.

<div style="page-break-after: always;"></div>

#### 8.4.2.5.11. Component FrontmatterModule

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `FrontmatterModule` |
| **Type** | Concrete, Pure Utility Module |
| **File Path** | `src-tauri/src/utils/frontmatter.rs` |
| **Description** | Procedural module class encapsulating free-standing functions inside `src-tauri/src/utils/frontmatter.rs`. |
| **Traits / Inheritance** | `Serialize, Deserialize, Clone` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Coordinates operations and encapsulates free-standing functions inside the FrontmatterModule module. |

##### Methods & Functions

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | Static | `Option<(String, String)>` | `parse_frontmatter` | `content: &str` |
| Public | Static | `Result<String, String>` | `frontmatter_to_json` | `yaml_str: &str` |
| Public | Static | `&str` | `strip_frontmatter` | `content: &str` |

##### Attributes & Fields

*No attributes or fields defined.*

##### Observations

Utilizes Serde traits to automatically serialize data models crossing the Tauri IPC bridge.

<div style="page-break-after: always;"></div>

#### 8.4.2.5.12. Component GrafeoProjectionModule

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `GrafeoProjectionModule` |
| **Type** | Concrete, Rust Module |
| **File Path** | `src-tauri/src/grafeo_projection.rs` |
| **Description** | Procedural module class encapsulating free-standing functions inside `src-tauri/src/grafeo_projection.rs`. |
| **Traits / Inheritance** | `Serialize, Deserialize, Clone` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Coordinates operations and encapsulates free-standing functions inside the GrafeoProjectionModule module. |

##### Methods & Functions

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | Static | `String` | `title_from_note_id` | `note_id: &str` |
| Public | Static | `Result<(), String>` | `init_connection` | `db_path: PathBuf` |
| Private | Static | `Result<&'static GrafeoDB, String>` | `get_database` | *None* |
| Public | Static, Async | `()` | `sync_note_upsert` | `_connection: &Mutex<(` |
| Public | Static | `()` | `sync_link_create` | `_connection: &Mutex<(` |
| Public | Static | `()` | `sync_link_delete` | `_connection: &Mutex<(` |
| Public | Static | `()` | `sync_note_delete` | `_connection: &Mutex<(` |
| Public | Static, Async | `()` | `sync_full` | `_connection: &Mutex<(` |
| Public | Static | `Result<Value, String>` | `execute_query` | `query: &str` |
| Private | Static | `Value` | `grafeo_value_to_json` | `value: &grafeo::Value` |

##### Attributes & Fields

*No attributes or fields defined.*

##### Observations

Utilizes Serde traits to automatically serialize data models crossing the Tauri IPC bridge.

<div style="page-break-after: always;"></div>

#### 8.4.2.5.13. Component GraphModule

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `GraphModule` |
| **Type** | Concrete, Tauri IPC Commands Module |
| **File Path** | `src-tauri/src/commands/graph.rs` |
| **Description** | Procedural module class encapsulating free-standing functions inside `src-tauri/src/commands/graph.rs`. |
| **Traits / Inheritance** | `Serialize, Deserialize, Clone` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Coordinates operations and encapsulates free-standing functions inside the GraphModule module. |

##### Methods & Functions

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Private | Static | `String` | `path_to_label` | `path: &str, vault_path: &str` |
| Public | Static, Async | `Result<GraphData, TessellumError>` | `get_graph_data` | `state: State<'_, AppState>, vault_path: String` |
| Public | Static | `Result<serde_json::Value, TessellumError>` | `execute_graph_query` | `cypher: String` |
| Public | Static, Async | `Result<GraphData, TessellumError>` | `build_graph_data` | `state: &AppState, vault_path: &str` |

##### Attributes & Fields

| Access | Mode | Type or Struct | Name |
| --- | --- | --- | --- |
| Public | None | `String` | `id` |
| Public | None | `String` | `label` |
| Public | None | `bool` | `exists` |
| Public | None | `bool` | `orphan` |
| Public | None | `Vec<String>` | `tags` |

##### Internal Data Structures (Structs)

The following structures are defined inside `src-tauri/src/commands/graph.rs` and are scoped directly under GraphModule:

###### Struct `GraphNode`

Data structure scoped under GraphModule.

| Access | Mode | Type or Struct | Field Name |
| --- | --- | --- | --- |
| Public | None | `String` | `id` |
| Public | None | `String` | `label` |
| Public | None | `bool` | `exists` |
| Public | None | `bool` | `orphan` |
| Public | None | `Vec<String>` | `tags` |

###### Struct `GraphEdge`

Data structure scoped under GraphModule.

| Access | Mode | Type or Struct | Field Name |
| --- | --- | --- | --- |
| Public | None | `String` | `source` |
| Public | None | `String` | `target` |
| Public | None | `bool` | `broken` |

###### Struct `GraphData`

Data structure scoped under GraphModule.

| Access | Mode | Type or Struct | Field Name |
| --- | --- | --- | --- |
| Public | None | `Vec<GraphNode>` | `nodes` |
| Public | None | `Vec<GraphEdge>` | `edges` |

##### Observations

Utilizes Serde traits to automatically serialize data models crossing the Tauri IPC bridge.

<div style="page-break-after: always;"></div>

#### 8.4.2.5.14. Component IndexerModule

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `IndexerModule` |
| **Type** | Concrete, Tauri IPC Commands Module |
| **File Path** | `src-tauri/src/commands/indexer.rs` |
| **Description** | Procedural module class encapsulating free-standing functions inside `src-tauri/src/commands/indexer.rs`. |
| **Traits / Inheritance** | `Serialize, Deserialize, Clone` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Coordinates operations and encapsulates free-standing functions inside the IndexerModule module. |

##### Methods & Functions

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Private | Static | `Self` | `from` | `stats: IndexStats` |
| Public | Static, Async | `Result<SyncResult, TessellumError>` | `sync_vault` | `state: State<'_, AppState>, kuzu_state: State<'_, ManagedGrafeoConnection>, vault_path: String` |
| Public | Static, Async | `Result<SyncResult, TessellumError>` | `run_sync_vault` | `state: &AppState, grafeo_state: &ManagedGrafeoConnection, vault_path: &str` |

##### Attributes & Fields

| Access | Mode | Type or Struct | Name |
| --- | --- | --- | --- |
| Public | None | `bool` | `success` |
| Public | None | `usize` | `files_indexed` |
| Public | None | `usize` | `files_deleted` |
| Public | None | `usize` | `files_skipped` |
| Public | None | `u128` | `duration_ms` |
| Public | None | `Option<String>` | `error` |

##### Internal Data Structures (Structs)

The following structures are defined inside `src-tauri/src/commands/indexer.rs` and are scoped directly under IndexerModule:

###### Struct `SyncResult`

Data structure scoped under IndexerModule.

| Access | Mode | Type or Struct | Field Name |
| --- | --- | --- | --- |
| Public | None | `bool` | `success` |
| Public | None | `usize` | `files_indexed` |
| Public | None | `usize` | `files_deleted` |
| Public | None | `usize` | `files_skipped` |
| Public | None | `u128` | `duration_ms` |
| Public | None | `Option<String>` | `error` |

##### Observations

Utilizes Serde traits to automatically serialize data models crossing the Tauri IPC bridge.

<div style="page-break-after: always;"></div>

#### 8.4.2.5.15. Component LibModule

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `LibModule` |
| **Type** | Concrete, Rust Module |
| **File Path** | `src-tauri/src/lib.rs` |
| **Description** | Procedural module class encapsulating free-standing functions inside `src-tauri/src/lib.rs`. |
| **Traits / Inheritance** | `Serialize, Deserialize, Clone` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Coordinates operations and encapsulates free-standing functions inside the LibModule module. |

##### Methods & Functions

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Private | Static | `std::io::Error` | `startup_error` | `stage: &str, message: impl Into<String>` |
| Private | Static | `PathBuf` | `startup_log_path` | *None* |
| Private | Static | `()` | `append_startup_log` | `message: &str` |
| Public | Static | `()` | `run` | *None* |

##### Attributes & Fields

*No attributes or fields defined.*

##### Observations

Utilizes Serde traits to automatically serialize data models crossing the Tauri IPC bridge.

<div style="page-break-after: always;"></div>

#### 8.4.2.5.16. Component LinksModule

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `LinksModule` |
| **Type** | Concrete, Tauri IPC Commands Module |
| **File Path** | `src-tauri/src/commands/links.rs` |
| **Description** | Procedural module class encapsulating free-standing functions inside `src-tauri/src/commands/links.rs`. |
| **Traits / Inheritance** | `Serialize, Deserialize, Clone` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Coordinates operations and encapsulates free-standing functions inside the LinksModule module. |

##### Methods & Functions

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | Static | `Vec<WikiLink>` | `extract_wikilinks` | `content: &str` |
| Public | Static, Async | `Result<Vec<String>, TessellumError>` | `get_backlinks` | `state: State<'_, AppState>, path: String` |
| Public | Static, Async | `Result<Vec<String>, TessellumError>` | `get_outgoing_links` | `state: State<'_, AppState>, path: String` |
| Public | Static, Async | `Result<Vec<(String, String)>, TessellumError>` | `get_all_links` | `state: State<'_, AppState>` |
| Public | Static, Async | `Result<Option<String>, TessellumError>` | `resolve_wikilink` | `state: State<'_, AppState>, vault_path: String, target: String` |

##### Attributes & Fields

*No attributes or fields defined.*

##### Observations

Utilizes Serde traits to automatically serialize data models crossing the Tauri IPC bridge.

<div style="page-break-after: always;"></div>

#### 8.4.2.5.17. Component MainModule

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `MainModule` |
| **Type** | Concrete, Rust Module |
| **File Path** | `src-tauri/src/main.rs` |
| **Description** | Procedural module class encapsulating free-standing functions inside `src-tauri/src/main.rs`. |
| **Traits / Inheritance** | `Serialize, Deserialize, Clone` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Coordinates operations and encapsulates free-standing functions inside the MainModule module. |

##### Methods & Functions

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Private | Static | `()` | `main` | *None* |

##### Attributes & Fields

*No attributes or fields defined.*

##### Observations

Utilizes Serde traits to automatically serialize data models crossing the Tauri IPC bridge.

<div style="page-break-after: always;"></div>

#### 8.4.2.5.18. Component ModModule

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `ModModule` |
| **Type** | Concrete, Pure Utility Module |
| **File Path** | `src-tauri/src/utils/mod.rs` |
| **Description** | Procedural module class encapsulating free-standing functions inside `src-tauri/src/utils/mod.rs`. |
| **Traits / Inheritance** | `Serialize, Deserialize, Clone` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Coordinates operations and encapsulates free-standing functions inside the ModModule module. |

##### Methods & Functions

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | Static | `String` | `normalize_path` | `path: &str` |

##### Attributes & Fields

*No attributes or fields defined.*

##### Observations

Utilizes Serde traits to automatically serialize data models crossing the Tauri IPC bridge.

<div style="page-break-after: always;"></div>

#### 8.4.2.5.19. Component NotesModule

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `NotesModule` |
| **Type** | Concrete, Tauri IPC Commands Module |
| **File Path** | `src-tauri/src/commands/notes.rs` |
| **Description** | Procedural module class encapsulating free-standing functions inside `src-tauri/src/commands/notes.rs`. |
| **Traits / Inheritance** | `Serialize, Deserialize, Clone` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Coordinates operations and encapsulates free-standing functions inside the NotesModule module. |

##### Methods & Functions

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Private | Static | `PathBuf` | `get_trash_dir` | `vault_root: &Path` |
| Private | Static | `Result<PathBuf, TessellumError>` | `canonicalize_existing_path` | `path: &Path` |
| Private | Static | `Result<PathBuf, TessellumError>` | `validate_top_level_trash_entry` | `trash_item_path: &Path, vault_root: &Path` |
| Private | Static | `(usize, String)` | `candidate_directory_priority` | `path: &Path` |
| Private | Static | `PathBuf` | `resolve_restore_directory` | `vault_root: &Path, parent_label: &str` |
| Private | Static | `Option<TrashItemMetadata>` | `build_trash_item_metadata` | `vault_root: &Path, entry_path: &Path` |
| Private | Static | `Result<Vec<TrashItemMetadata>, TessellumError>` | `list_trash_items_internal` | `vault_root: &Path` |
| Private | Static | `Result<PathBuf, TessellumError>` | `restore_trash_item_internal_for_tests` | `vault_root: &Path, trash_item_path: &Path` |
| Private | Static, Async | `()` | `refresh_indexes_after_restore` | `state: &State<'_, AppState>, kuzu_state: &State<'_, ManagedGrafeoConnection>, vault_path: &str` |
| Private | Static | `String` | `build_daily_note_relative_path` | `template: &str, now: chrono::DateTime<Local>` |
| Private | Static | `Result<(), TessellumError>` | `validate_template_name` | `template_name: &str` |
| Private | Static, Async | `Result<NoteSyncDelta, TessellumError>` | `index_note_content` | `state: &State<'_, AppState>, vault_path: &str, path: &str, content: &str` |
| Private | Static, Async | `()` | `sync_note_delta_non_critical` | `state: &State<'_, AppState>, kuzu_state: &State<'_, ManagedGrafeoConnection>, delta: NoteSyncDelta` |
| Public | Static, Async | `Result<String, TessellumError>` | `create_note` | `state: State<'_, AppState>, kuzu_state: State<'_, ManagedGrafeoConnection>, vault_path: String, title: String` |
| Public | Static, Async | `Result<FileMetadata, TessellumError>` | `get_or_create_daily_note` | `state: State<'_, AppState>, kuzu_state: State<'_, ManagedGrafeoConnection>, vault_path: String` |
| Private | Static, Async | `Result<(), TessellumError>` | `trash_item_internal` | `state: State<'_, AppState>, kuzu_state: State<'_, ManagedGrafeoConnection>, item_path: String, vault_path: String` |
| Public | Static, Async | `Result<(), TessellumError>` | `trash_item` | `state: State<'_, AppState>, kuzu_state: State<'_, ManagedGrafeoConnection>, item_path: String, vault_path: String` |
| Public | Static, Async | `Result<TrashItemsResult, TessellumError>` | `trash_items` | `state: State<'_, AppState>, kuzu_state: State<'_, ManagedGrafeoConnection>, item_paths: Vec<String>, vault_path: String` |
| Public | Static, Async | `Result<Vec<TrashItemMetadata>, TessellumError>` | `list_trash_items` | `vault_path: String` |
| Public | Static, Async | `Result<String, TessellumError>` | `restore_trash_item` | `state: State<'_, AppState>, kuzu_state: State<'_, ManagedGrafeoConnection>, trash_item_path: String, vault_path: String` |
| Public | Static, Async | `Result<(), TessellumError>` | `delete_trash_item_permanently` | `trash_item_path: String, vault_path: String` |
| Public | Static, Async | `Result<String, TessellumError>` | `read_file` | `vault_path: String, path: String` |
| Public | Static, Async | `Result<(), TessellumError>` | `write_file` | `state: State<'_, AppState>, kuzu_state: State<'_, ManagedGrafeoConnection>, vault_path: String, path: String, content: String` |
| Public | Static, Async | `Result<Vec<(String, i64)>, TessellumError>` | `get_all_notes` | `state: State<'_, AppState>` |
| Public | Static, Async | `Result<Vec<NoteSuggestion>, TessellumError>` | `search_notes` | `state: State<'_, AppState>, vault_path: String, query: String` |
| Public | Static, Async | `Result<Vec<String>, TessellumError>` | `get_all_tags` | `state: State<'_, AppState>` |
| Public | Static, Async | `Result<Vec<String>, TessellumError>` | `get_file_tags` | `state: State<'_, AppState>, path: String` |
| Public | Static, Async | `Result<Vec<String>, TessellumError>` | `get_all_property_keys` | `state: State<'_, AppState>` |

##### Attributes & Fields

| Access | Mode | Type or Struct | Name |
| --- | --- | --- | --- |
| Private | None | `String` | `note_id` |
| Private | None | `Vec<String>` | `previous_links` |
| Private | None | `Vec<String>` | `current_links` |

##### Internal Data Structures (Structs)

The following structures are defined inside `src-tauri/src/commands/notes.rs` and are scoped directly under NotesModule:

###### Struct `NoteSyncDelta`

Data structure scoped under NotesModule.

| Access | Mode | Type or Struct | Field Name |
| --- | --- | --- | --- |
| Private | None | `String` | `note_id` |
| Private | None | `Vec<String>` | `previous_links` |
| Private | None | `Vec<String>` | `current_links` |

###### Struct `TrashItemsResult`

Data structure scoped under NotesModule.

| Access | Mode | Type or Struct | Field Name |
| --- | --- | --- | --- |
| Private | None | `Vec<String>` | `deleted_paths` |
| Private | None | `Vec<TrashItemFailure>` | `failed` |

###### Struct `TrashItemFailure`

Data structure scoped under NotesModule.

| Access | Mode | Type or Struct | Field Name |
| --- | --- | --- | --- |
| Private | None | `String` | `item_path` |
| Private | None | `String` | `message` |

###### Struct `TrashItemMetadata`

Data structure scoped under NotesModule.

| Access | Mode | Type or Struct | Field Name |
| --- | --- | --- | --- |
| Private | None | `String` | `path` |
| Private | None | `String` | `filename` |
| Private | None | `String` | `display_name` |
| Private | None | `String` | `original_name` |
| Private | None | `String` | `parent_label` |
| Private | None | `String` | `restore_path` |
| Private | None | `bool` | `is_dir` |
| Private | None | `u128` | `timestamp` |

###### Struct `NoteSuggestion`

Data structure scoped under NotesModule.

| Access | Mode | Type or Struct | Field Name |
| --- | --- | --- | --- |
| Public | None | `String` | `name` |
| Public | None | `String` | `relative_path` |
| Public | None | `String` | `full_path` |

##### Observations

Utilizes Serde traits to automatically serialize data models crossing the Tauri IPC bridge.

<div style="page-break-after: always;"></div>

#### 8.4.2.5.20. Component PdfExportModule

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `PdfExportModule` |
| **Type** | Concrete, Tauri IPC Commands Module |
| **File Path** | `src-tauri/src/commands/pdf_export.rs` |
| **Description** | Procedural module class encapsulating free-standing functions inside `src-tauri/src/commands/pdf_export.rs`. |
| **Traits / Inheritance** | `Serialize, Deserialize, Clone` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Coordinates operations and encapsulates free-standing functions inside the PdfExportModule module. |

##### Methods & Functions

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Private | Static | `Result<(), TessellumError>` | `validate_export_request` | `request: &PdfExportRequest` |
| Private | Static | `Vec<NormalizedOutlineEntry>` | `normalize_outline_entries` | `outline: &[PdfExportOutlineItem], total_pages: u32` |
| Private | Static | `Object` | `encode_outline_title` | `title: &str` |
| Private | Static | `f32` | `resolve_page_height_points` | `document: &Document, page_id: ObjectId` |
| Private | Static | `f32` | `heading_top_position_points` | `page_height_points: f32, offset_within_page_px: f32` |
| Private | Static | `Dictionary` | `build_outline_action` | `page_id: ObjectId, top_position_points: f32` |
| Private | Static | `Result<ObjectId, TessellumError>` | `build_outline_objects` | `document: &mut Document, outline: &[NormalizedOutlineEntry], page_ids: &[ObjectId]` |
| Private | Static | `Result<(), TessellumError>` | `inject_outline_into_pdf` | `destination_path: &Path, outline: &[PdfExportOutlineItem]` |
| Private | Static | `Vec<PathBuf>` | `candidate_browser_paths` | *None* |
| Private | Static | `Result<PathBuf, TessellumError>` | `find_print_browser` | *None* |
| Private | Static | `Vec<String>` | `build_print_pdf_args` | `html_url: &str, destination_path: &Path` |
| Private | Static, Async | `Result<(), TessellumError>` | `render_html_to_pdf` | `html_path: &Path, destination_path: &Path` |
| Private | Static, Async | `Result<(), TessellumError>` | `render_html_to_pdf` | `_html_path: &Path, _destination_path: &Path` |
| Public | Static, Async | `Result<(), TessellumError>` | `export_markdown_pdf` | `request: PdfExportRequest` |

##### Attributes & Fields

| Access | Mode | Type or Struct | Name |
| --- | --- | --- | --- |
| Public | None | `String` | `title` |
| Public | None | `u32` | `level` |
| Public | None | `u32` | `line_number` |
| Public | None | `u32` | `page` |
| Public | None | `f32` | `offset_within_page_px` |

##### Internal Data Structures (Structs)

The following structures are defined inside `src-tauri/src/commands/pdf_export.rs` and are scoped directly under PdfExportModule:

###### Struct `PdfExportOutlineItem`

Data structure scoped under PdfExportModule.

| Access | Mode | Type or Struct | Field Name |
| --- | --- | --- | --- |
| Public | None | `String` | `title` |
| Public | None | `u32` | `level` |
| Public | None | `u32` | `line_number` |
| Public | None | `u32` | `page` |
| Public | None | `f32` | `offset_within_page_px` |

###### Struct `PdfExportRequest`

Data structure scoped under PdfExportModule.

| Access | Mode | Type or Struct | Field Name |
| --- | --- | --- | --- |
| Public | None | `String` | `destination_path` |
| Public | None | `String` | `document_title` |
| Public | None | `String` | `html` |
| Public | None | `Vec<PdfExportOutlineItem>` | `outline` |

###### Struct `NormalizedOutlineEntry`

Data structure scoped under PdfExportModule.

| Access | Mode | Type or Struct | Field Name |
| --- | --- | --- | --- |
| Private | None | `String` | `title` |
| Private | None | `u32` | `level` |
| Private | None | `u32` | `page` |
| Private | None | `f32` | `offset_within_page_px` |
| Private | None | `Option<usize>` | `parent_index` |

##### Observations

Utilizes Serde traits to automatically serialize data models crossing the Tauri IPC bridge.

<div style="page-break-after: always;"></div>

#### 8.4.2.5.21. Component SanitizeModule

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `SanitizeModule` |
| **Type** | Concrete, Pure Utility Module |
| **File Path** | `src-tauri/src/utils/sanitize.rs` |
| **Description** | Procedural module class encapsulating free-standing functions inside `src-tauri/src/utils/sanitize.rs`. |
| **Traits / Inheritance** | `Serialize, Deserialize, Clone` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Coordinates operations and encapsulates free-standing functions inside the SanitizeModule module. |

##### Methods & Functions

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | Static | `String` | `sanitize_string` | `s: String` |

##### Attributes & Fields

*No attributes or fields defined.*

##### Observations

Utilizes Serde traits to automatically serialize data models crossing the Tauri IPC bridge.

<div style="page-break-after: always;"></div>

#### 8.4.2.5.22. Component SearchModule

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `SearchModule` |
| **Type** | Concrete, Tauri IPC Commands Module |
| **File Path** | `src-tauri/src/commands/search.rs` |
| **Description** | Procedural module class encapsulating free-standing functions inside `src-tauri/src/commands/search.rs`. |
| **Traits / Inheritance** | `Serialize, Deserialize, Clone` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Coordinates operations and encapsulates free-standing functions inside the SearchModule module. |

##### Methods & Functions

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Private | Static | `()` | `log_readiness_transition` | `vault_path: &str, from: &SearchReadinessStatus, to: &SearchReadinessStatus, attempt: u32, detail: &str` |
| Private | Static | `String` | `status_to_string` | `status: &SearchReadinessStatus` |
| Private | Static | `SearchReadinessResponse` | `readiness_response` | `state: &SearchReadinessState` |
| Private | Static | `usize` | `mismatch_threshold` | `expected_markdown_count: usize` |
| Private | Static | `bool` | `is_markdown_path` | `path: &str` |
| Private | Static | `usize` | `count_mismatches_with_early_exit` | `expected_paths: &HashSet<String>, indexed_paths: &HashSet<String>, stop_after: usize` |
| Private | Static, Async | `Result<CoherenceResult, TessellumError>` | `compute_markdown_coherence` | `state: &State<'_, AppState>` |
| Private | Static | `bool` | `needs_rebuild` | `coherence: &CoherenceResult` |
| Public | Static, Async | `Result<SearchReadinessResponse, TessellumError>` | `get_search_readiness` | `state: State<'_, AppState>, vault_path: String` |
| Public | Static, Async | `Result<SearchReadinessResponse, TessellumError>` | `reset_search_readiness_attempts` | `state: State<'_, AppState>, vault_path: String` |
| Public | Static, Async | `Result<SearchReadinessResponse, TessellumError>` | `ensure_search_ready` | `state: State<'_, AppState>, kuzu_state: State<'_, ManagedGrafeoConnection>, vault_path: String` |
| Public | Static, Async | `Result<FullTextSearchResponse, TessellumError>` | `search_full_text` | `state: State<'_, AppState>, vault_path: String, request: FullTextSearchRequest` |
| Public | Static, Async | `Result<TagSearchResponse, TessellumError>` | `search_tags` | `state: State<'_, AppState>, vault_path: String, request: TagSearchRequest` |
| Public | Static, Async | `Result<IndexRebuildResult, TessellumError>` | `rebuild_search_index` | `state: State<'_, AppState>, vault_path: String` |
| Private | Static, Async | `Result<IndexRebuildResult, TessellumError>` | `rebuild_search_index_internal` | `state: &AppState, vault_path: String` |
| Private | Static | `String` | `make_relative_path` | `vault_path: &str, full_path: &str` |
| Private | Static, Async | `Option<String>` | `read_snippet` | `path: &str, query: &str` |

##### Attributes & Fields

| Access | Mode | Type or Struct | Name |
| --- | --- | --- | --- |
| Public | None | `Vec<String>` | `tags` |
| Public | None | `TagMatchMode` | `match_mode` |

##### Internal Data Structures (Structs)

The following structures are defined inside `src-tauri/src/commands/search.rs` and are scoped directly under SearchModule:

###### Struct `TagFilter`

Data structure scoped under SearchModule.

| Access | Mode | Type or Struct | Field Name |
| --- | --- | --- | --- |
| Public | None | `Vec<String>` | `tags` |
| Public | None | `TagMatchMode` | `match_mode` |

###### Struct `FullTextSearchRequest`

Data structure scoped under SearchModule.

| Access | Mode | Type or Struct | Field Name |
| --- | --- | --- | --- |
| Public | None | `String` | `query` |
| Public | None | `Option<u32>` | `limit` |
| Public | None | `Option<u32>` | `offset` |
| Public | None | `Option<bool>` | `include_snippets` |
| Public | None | `Option<TagFilter>` | `tag_filter` |

###### Struct `TagSearchRequest`

Data structure scoped under SearchModule.

| Access | Mode | Type or Struct | Field Name |
| --- | --- | --- | --- |
| Public | None | `Vec<String>` | `tags` |
| Public | None | `TagMatchMode` | `match_mode` |
| Public | None | `Option<u32>` | `limit` |
| Public | None | `Option<u32>` | `offset` |

###### Struct `SearchHit`

Data structure scoped under SearchModule.

| Access | Mode | Type or Struct | Field Name |
| --- | --- | --- | --- |
| Public | None | `String` | `path` |
| Public | None | `String` | `relative_path` |
| Public | None | `String` | `title` |
| Public | None | `f32` | `score` |
| Public | None | `Option<String>` | `snippet` |
| Public | None | `Vec<String>` | `tags` |

###### Struct `FullTextSearchResponse`

Data structure scoped under SearchModule.

| Access | Mode | Type or Struct | Field Name |
| --- | --- | --- | --- |
| Public | None | `u32` | `total` |
| Public | None | `Vec<SearchHit>` | `hits` |

###### Struct `TagSearchResponse`

Data structure scoped under SearchModule.

| Access | Mode | Type or Struct | Field Name |
| --- | --- | --- | --- |
| Public | None | `u32` | `total` |
| Public | None | `Vec<SearchHit>` | `hits` |

###### Struct `IndexRebuildResult`

Data structure scoped under SearchModule.

| Access | Mode | Type or Struct | Field Name |
| --- | --- | --- | --- |
| Public | None | `usize` | `indexed_files` |
| Public | None | `usize` | `deleted_files` |
| Public | None | `u128` | `duration_ms` |

###### Struct `SearchReadinessResponse`

Data structure scoped under SearchModule.

| Access | Mode | Type or Struct | Field Name |
| --- | --- | --- | --- |
| Public | None | `String` | `status` |
| Public | None | `u32` | `attempt_count` |
| Public | None | `u32` | `max_attempts` |
| Public | None | `u64` | `retry_delay_ms` |
| Public | None | `bool` | `reopen_required` |
| Public | None | `Option<String>` | `last_error` |

###### Struct `CoherenceResult`

Data structure scoped under SearchModule.

| Access | Mode | Type or Struct | Field Name |
| --- | --- | --- | --- |
| Private | None | `usize` | `expected_markdown_count` |
| Private | None | `usize` | `indexed_markdown_count` |
| Private | None | `usize` | `mismatch_count` |
| Private | None | `usize` | `mismatch_threshold` |

##### Observations

Utilizes Serde traits to automatically serialize data models crossing the Tauri IPC bridge.

<div style="page-break-after: always;"></div>

#### 8.4.2.5.23. Component SearchModule

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `SearchModule` |
| **Type** | Concrete, Rust Module |
| **File Path** | `src-tauri/src/search.rs` |
| **Description** | Procedural module class encapsulating free-standing functions inside `src-tauri/src/search.rs`. |
| **Traits / Inheritance** | `Serialize, Deserialize, Clone` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Coordinates operations and encapsulates free-standing functions inside the SearchModule module. |

##### Methods & Functions

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Private | Static | `Vec<String>` | `tokenize_query` | `query: &str` |
| Public | Static | `Result<Self, String>` | `open_or_create` | `index_dir: &Path` |
| Public | None | `&Path` | `index_dir` | *None* |
| Public | None | `Result<(), String>` | `clear` | *None* |
| Public | None | `Result<(), String>` | `index_batch` | `docs: &[SearchDoc], delete_paths: &[String]` |
| Public | None | `Result<(), String>` | `delete_path` | `path: &str` |
| Public | None | `Result<Vec<(SearchDoc, f32)>, String>` | `search` | `query: &str, tags: &[String], match_all_tags: bool, limit: usize, offset: usize` |
| Public | None | `Result<Vec<String>, String>` | `indexed_paths` | *None* |
| Private | Static | `(Schema, SearchFields)` | `build_schema` | *None* |
| Private | None | `Result<IndexWriter, String>` | `writer` | *None* |
| Private | None | `Result<(), String>` | `delete_path_with_writer` | `writer: &mut IndexWriter, path: &str` |

##### Attributes & Fields

| Access | Mode | Type or Struct | Name |
| --- | --- | --- | --- |
| Private | None | `Index` | `index` |
| Private | None | `IndexReader` | `reader` |
| Private | None | `SearchFields` | `fields` |
| Private | None | `PathBuf` | `index_dir` |

##### Internal Data Structures (Structs)

The following structures are defined inside `src-tauri/src/search.rs` and are scoped directly under SearchModule:

###### Struct `SearchIndex`

Data structure scoped under SearchModule.

| Access | Mode | Type or Struct | Field Name |
| --- | --- | --- | --- |
| Private | None | `Index` | `index` |
| Private | None | `IndexReader` | `reader` |
| Private | None | `SearchFields` | `fields` |
| Private | None | `PathBuf` | `index_dir` |

###### Struct `SearchFields`

Data structure scoped under SearchModule.

| Access | Mode | Type or Struct | Field Name |
| --- | --- | --- | --- |
| Public | None | `Field` | `path` |
| Public | None | `Field` | `title` |
| Public | None | `Field` | `body` |
| Public | None | `Field` | `tags` |

###### Struct `SearchDoc`

Data structure scoped under SearchModule.

| Access | Mode | Type or Struct | Field Name |
| --- | --- | --- | --- |
| Public | None | `String` | `path` |
| Public | None | `String` | `title` |
| Public | None | `String` | `body` |
| Public | None | `Vec<String>` | `tags` |

##### Observations

Utilizes Serde traits to automatically serialize data models crossing the Tauri IPC bridge.

<div style="page-break-after: always;"></div>

#### 8.4.2.5.24. Component TagsModule

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `TagsModule` |
| **Type** | Concrete, Pure Utility Module |
| **File Path** | `src-tauri/src/utils/tags.rs` |
| **Description** | Procedural module class encapsulating free-standing functions inside `src-tauri/src/utils/tags.rs`. |
| **Traits / Inheritance** | `Serialize, Deserialize, Clone` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Coordinates operations and encapsulates free-standing functions inside the TagsModule module. |

##### Methods & Functions

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Private | Static | `bool` | `is_fence_line` | `line: &str` |
| Private | Static | `bool` | `is_block_line` | `line: &str` |
| Private | Static | `String` | `strip_inline_code_spans_for_tag_scan` | `line: &str` |
| Public | Static | `Vec<String>` | `extract_tags` | `content: &str` |
| Private | Static | `String` | `normalize_tag` | `tag: &str` |

##### Attributes & Fields

*No attributes or fields defined.*

##### Observations

Utilizes Serde traits to automatically serialize data models crossing the Tauri IPC bridge.

<div style="page-break-after: always;"></div>

#### 8.4.2.5.25. Component TemplatesModule

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `TemplatesModule` |
| **Type** | Concrete, Tauri IPC Commands Module |
| **File Path** | `src-tauri/src/commands/templates.rs` |
| **Description** | Procedural module class encapsulating free-standing functions inside `src-tauri/src/commands/templates.rs`. |
| **Traits / Inheritance** | `Serialize, Deserialize, Clone` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Coordinates operations and encapsulates free-standing functions inside the TemplatesModule module. |

##### Methods & Functions

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Private | Static | `std::path::PathBuf` | `templates_dir` | `vault_path: &str` |
| Private | Static | `String` | `apply_placeholders` | `content: &str, title: &str, vault_path: &str, now: DateTime<Local>` |
| Public | Static, Async | `Result<Vec<TemplateInfo>, TessellumError>` | `list_templates` | `vault_path: String` |
| Public | Static, Async | `Result<String, TessellumError>` | `create_note_from_template` | `state: State<'_, AppState>, vault_path: String, target_dir: String, template_path: String, title: String` |

##### Attributes & Fields

| Access | Mode | Type or Struct | Name |
| --- | --- | --- | --- |
| Public | None | `String` | `name` |
| Public | None | `String` | `path` |

##### Internal Data Structures (Structs)

The following structures are defined inside `src-tauri/src/commands/templates.rs` and are scoped directly under TemplatesModule:

###### Struct `TemplateInfo`

Data structure scoped under TemplatesModule.

| Access | Mode | Type or Struct | Field Name |
| --- | --- | --- | --- |
| Public | None | `String` | `name` |
| Public | None | `String` | `path` |

##### Observations

Utilizes Serde traits to automatically serialize data models crossing the Tauri IPC bridge.

<div style="page-break-after: always;"></div>

#### 8.4.2.5.26. Component TrashModule

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `TrashModule` |
| **Type** | Concrete, Rust Module |
| **File Path** | `src-tauri/src/trash.rs` |
| **Description** | Procedural module class encapsulating free-standing functions inside `src-tauri/src/trash.rs`. |
| **Traits / Inheritance** | `Serialize, Deserialize, Clone` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Coordinates operations and encapsulates free-standing functions inside the TrashModule module. |

##### Methods & Functions

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | Static | `Option<String>` | `generate_trash_name` | `path: &Path, timestamp: u128` |
| Private | Static | `(&str, Option<&str>)` | `split_name_parts` | `name: &str` |
| Private | Static | `String` | `with_collision_suffix` | `name: &str, collision_index: usize` |
| Private | Static | `&str` | `strip_extension_for_parsing` | `name: &str` |
| Private | Static | `&str` | `strip_collision_suffix_for_parsing` | `name: &str` |
| Public | Static | `Option<PathBuf>` | `generate_unique_trash_path` | `trash_dir: &Path, source_path: &Path, timestamp: u128` |
| Public | Static | `std::io::Result<()>` | `rename_recursively` | `dir: &Path, timestamp: u128` |
| Public | Static | `Option<u128>` | `parse_trash_timestamp` | `name: &str` |
| Public | Static | `Option<ParsedTrashName>` | `parse_trash_entry_name` | `name: &str, is_dir: bool` |
| Public | Static | `Option<PathBuf>` | `build_restored_destination_path` | `destination_dir: &Path, original_name: &str` |
| Public | Static | `std::io::Result<()>` | `permanently_delete_trash_entry` | `path: &Path` |
| Public | Static | `std::io::Result<()>` | `restore_trashed_names_recursively` | `dir: &Path` |
| Public | Static | `PurgeReport` | `purge_expired_trash` | `vault_path: &str, retention_days: u64` |
| Private | Static | `PurgeReport` | `purge_expired_trash_with_now` | `vault_path: &Path, retention_days: u64, now_ms: u128` |

##### Attributes & Fields

| Access | Mode | Type or Struct | Name |
| --- | --- | --- | --- |
| Public | None | `usize` | `deleted` |
| Public | None | `usize` | `skipped_invalid_name` |
| Public | None | `usize` | `errors` |

##### Internal Data Structures (Structs)

The following structures are defined inside `src-tauri/src/trash.rs` and are scoped directly under TrashModule:

###### Struct `PurgeReport`

Data structure scoped under TrashModule.

| Access | Mode | Type or Struct | Field Name |
| --- | --- | --- | --- |
| Public | None | `usize` | `deleted` |
| Public | None | `usize` | `skipped_invalid_name` |
| Public | None | `usize` | `errors` |

###### Struct `ParsedTrashName`

Data structure scoped under TrashModule.

| Access | Mode | Type or Struct | Field Name |
| --- | --- | --- | --- |
| Public | None | `String` | `original_name` |
| Public | None | `String` | `parent_label` |

##### Observations

Utilizes Serde traits to automatically serialize data models crossing the Tauri IPC bridge.

<div style="page-break-after: always;"></div>

#### 8.4.2.5.27. Component ValidateModule

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `ValidateModule` |
| **Type** | Concrete, Pure Utility Module |
| **File Path** | `src-tauri/src/utils/validate.rs` |
| **Description** | Procedural module class encapsulating free-standing functions inside `src-tauri/src/utils/validate.rs`. |
| **Traits / Inheritance** | `Serialize, Deserialize, Clone` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Coordinates operations and encapsulates free-standing functions inside the ValidateModule module. |

##### Methods & Functions

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | Static | `Result<PathBuf, String>` | `validate_path_in_vault` | `path: &str, vault_path: &str` |
| Public | Static | `bool` | `is_hidden_or_special` | `path: &std::path::Path` |

##### Attributes & Fields

*No attributes or fields defined.*

##### Observations

Utilizes Serde traits to automatically serialize data models crossing the Tauri IPC bridge.

<div style="page-break-after: always;"></div>

#### 8.4.2.5.28. Component VaultIndexer

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `VaultIndexer` |
| **Type** | Concrete, Core Service |
| **File Path** | `src-tauri/src/indexer.rs` |
| **Description** | Vault indexer for syncing database with filesystem. |
| **Traits / Inheritance** | `Serialize, Deserialize, Clone` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Crawls directory hierarchies recursively, scanning markdown files and assets. |
| R-2 | Extracts YAML frontmatter tags, metadata, inline tags, and wiki-link paths. |
| R-3 | Validates and indexes differences based on modification times to maximize speed. |

##### Methods & Functions

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Public | Static, Async | `Result<IndexStats, String>` | `full_sync` | `db: &Database, search_index: std::sync::Arc<tokio::sync::Mutex<SearchIndex>>, vault_path: &str` |
| Private | Static | `Result<HashMap<String, (i64, bool)>, String>` | `collect_filesystem_files` | `vault_path: &str` |
| Private | Static, Async | `Result<(), String>` | `index_single_file` | `db: &Database, vault_path: &str, file_path: &str, file_index: &FileIndex, docs_to_index: &mut Vec<SearchDoc>` |

##### Attributes & Fields

*No attributes or fields defined.*

##### Internal Data Structures (Structs)

The following structures are defined inside `src-tauri/src/indexer.rs` and are scoped directly under VaultIndexer:

###### Struct `IndexStats`

Data structure scoped under VaultIndexer.

| Access | Mode | Type or Struct | Field Name |
| --- | --- | --- | --- |
| Public | None | `usize` | `files_indexed` |
| Public | None | `usize` | `files_deleted` |
| Public | None | `usize` | `files_skipped` |
| Public | None | `u128` | `duration_ms` |

##### Observations

Utilizes filesystem stat-checks to skip parsing unmodified files, optimizing vault load speed.

<div style="page-break-after: always;"></div>

#### 8.4.2.5.29. Component VaultModule

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `VaultModule` |
| **Type** | Concrete, Tauri IPC Commands Module |
| **File Path** | `src-tauri/src/commands/vault.rs` |
| **Description** | Procedural module class encapsulating free-standing functions inside `src-tauri/src/commands/vault.rs`. |
| **Traits / Inheritance** | `Serialize, Deserialize, Clone` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Coordinates operations and encapsulates free-standing functions inside the VaultModule module. |

##### Methods & Functions

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Private | Static, Async | `Result<(), TessellumError>` | `rewrite_backlinks` | `backlinks: &[String], old_stem: &str, new_stem: &str` |
| Private | Static | `String` | `derive_renamed_filename` | `old_path: &Path, clean_name: &str` |
| Public | Static | `Result<Vec<FileMetadata>, TessellumError>` | `list_files` | `vault_path: String` |
| Public | Static, Async | `Result<bool, TessellumError>` | `ensure_feature_demo_in_empty_vault` | `vault_path: String` |
| Public | Static, Async | `Result<String, TessellumError>` | `rename_file` | `state: tauri::State<'_, crate::models::AppState>, _grafeo_state: tauri::State<'_, ManagedGrafeoConnection>, vault_path: String, old_path: String, new_name: String` |
| Public | Static, Async | `Result<Vec<String>, TessellumError>` | `move_items` | `state: tauri::State<'_, crate::models::AppState>, _grafeo_state: tauri::State<'_, ManagedGrafeoConnection>, vault_path: String, item_paths: Vec<String>, dest_dir: String` |
| Public | Static | `Result<Vec<TreeNode>, TessellumError>` | `list_files_tree` | `vault_path: String` |
| Private | Static | `()` | `sort_nodes` | `nodes: &mut Vec<TreeNode>` |
| Public | Static | `Result<(), String>` | `set_vault_path` | `app: tauri::AppHandle, path: String` |
| Private | Static | `()` | `spawn_trash_retention_cleanup` | `vault_path: std::path::PathBuf` |

##### Attributes & Fields

| Access | Mode | Type or Struct | Name |
| --- | --- | --- | --- |
| Public | None | `String` | `id` |
| Public | None | `String` | `name` |
| Public | None | `bool` | `is_dir` |
| Public | None | `Vec<TreeNode>` | `children` |
| Public | None | `Option<FileMetadata>` | `file` |

##### Internal Data Structures (Structs)

The following structures are defined inside `src-tauri/src/commands/vault.rs` and are scoped directly under VaultModule:

###### Struct `TreeNode`

Data structure scoped under VaultModule.

| Access | Mode | Type or Struct | Field Name |
| --- | --- | --- | --- |
| Public | None | `String` | `id` |
| Public | None | `String` | `name` |
| Public | None | `bool` | `is_dir` |
| Public | None | `Vec<TreeNode>` | `children` |
| Public | None | `Option<FileMetadata>` | `file` |

##### Observations

Utilizes Serde traits to automatically serialize data models crossing the Tauri IPC bridge.

<div style="page-break-after: always;"></div>

#### 8.4.2.5.30. Component WatcherModule

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `WatcherModule` |
| **Type** | Concrete, Tauri IPC Commands Module |
| **File Path** | `src-tauri/src/commands/watcher.rs` |
| **Description** | Procedural module class encapsulating free-standing functions inside `src-tauri/src/commands/watcher.rs`. |
| **Traits / Inheritance** | `Serialize, Deserialize, Clone` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Coordinates operations and encapsulates free-standing functions inside the WatcherModule module. |

##### Methods & Functions

| Access | Mode | Return Type | Name | Parameters and Types |
| --- | --- | --- | --- | --- |
| Private | Static | `bool` | `should_emit_change` | `last_emit: &mut Instant, now: Instant` |
| Public | Static, Async | `Result<(), TessellumError>` | `watch_vault` | `vault_path: String, handle: AppHandle, state: State<'_, AppState>` |
| Public | Static, Async | `Result<(), TessellumError>` | `unwatch_vault` | `state: State<'_, AppState>` |

##### Attributes & Fields

*No attributes or fields defined.*

##### Observations

Utilizes Serde traits to automatically serialize data models crossing the Tauri IPC bridge.

<div style="page-break-after: always;"></div>

#### 8.4.2.5.31. Component WikiLink

| Attribute / Metadata | Value |
| --- | --- |
| **Name** | `WikiLink` |
| **Type** | Concrete, Rust Module |
| **File Path** | `src-tauri/src/models/wikilink.rs` |
| **Description** | Backend component orchestrating operations inside `src-tauri/src/models/wikilink.rs`. |
| **Traits / Inheritance** | `Serialize, Deserialize, Clone` |

##### Responsibilities

| ID | Description |
| --- | --- |
| R-1 | Coordinates operations and encapsulates free-standing functions inside the WikiLink module. |

##### Methods & Functions

*No exposed methods or functions defined.*

##### Attributes & Fields

| Access | Mode | Type or Struct | Name |
| --- | --- | --- | --- |
| Public | None | `String` | `target` |
| Public | None | `Option<String>` | `alias` |

##### Observations

Utilizes Serde traits to automatically serialize data models crossing the Tauri IPC bridge.

<div style="page-break-after: always;"></div>

