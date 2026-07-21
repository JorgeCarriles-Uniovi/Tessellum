import fs from 'fs';
import path from 'path';

const tsPath = './extracted_classes.json';
const rustPath = './extracted_rust.json';
const outputPath = './docs/architecture/2026-05-19-tessellum-une157801-class-description.md';

const rawClasses = JSON.parse(fs.readFileSync(tsPath, 'utf8'));
const rawRustStructs = JSON.parse(fs.readFileSync(rustPath, 'utf8'));

// ----------------------------------------------------
// 1. FILTER FRONTEND: Plugin complete structure
// ----------------------------------------------------
const corePluginNames = ['TessellumApp', 'PluginRegistry', 'Plugin'];
const prodPlugins = rawClasses.filter(c => {
    return (corePluginNames.includes(c.name) || c.name.endsWith('Plugin')) &&
           !c.filePath.startsWith('src/e2e/') && !c.filePath.startsWith('src/test/');
});

// Curated definitions for React UI Components (without hooks)
const reactComponents = [
    {
        name: 'App',
        type: 'Concrete, React UI Component',
        description: 'Main shell layout coordinator orchestrating sidebar toggles, panel resizing, theme bindings, command palette overlays, and primary split pane rendering.',
        inheritsFrom: 'React.Component',
        responsibilities: [
            'Coordinates top-level workspace layout and panels sizing dynamic boundaries.',
            'Initializes and binds the theme styling matching active user configurations.',
            'Hooks global keyboard shortcuts triggering command palettes or fuzzy search modalities.'
        ],
        methods: [
            { access: 'Public', mode: 'None', returnType: 'JSX.Element', name: 'render', parameters: '*None*' },
            { access: 'Private', mode: 'None', returnType: 'void', name: 'handleResize', parameters: 'width: number' },
            { access: 'Private', mode: 'None', returnType: 'void', name: 'toggleSidebar', parameters: '*None*' },
            { access: 'Private', mode: 'None', returnType: 'void', name: 'triggerCommandPalette', parameters: '*None*' }
        ],
        attributes: [
            { access: 'Private', mode: 'None', type: 'boolean', name: 'sidebarOpen' },
            { access: 'Private', mode: 'None', type: 'number', name: 'sidebarWidth' }
        ],
        observations: 'Mounts once at window init. Listens to resize and mouseup window events for persistent panel widths.'
    },
    {
        name: 'Editor',
        type: 'Concrete, React UI Component',
        description: 'Premium CodeMirror 6 markdown editor surface wrapper binding vault file contents and custom plugins compartments.',
        inheritsFrom: 'React.Component',
        responsibilities: [
            'Instantiates and updates the CodeMirror 6 editor view container.',
            'Reconfigures CodeMirror editor compartments when active plugins register decorations.',
            'Sends note write callbacks on content modification buffers.'
        ],
        methods: [
            { access: 'Public', mode: 'None', returnType: 'JSX.Element', name: 'render', parameters: '*None*' },
            { access: 'Private', mode: 'None', returnType: 'void', name: 'onUpdate', parameters: 'view: EditorView' },
            { access: 'Public', mode: 'None', returnType: 'void', name: 'focus', parameters: '*None*' }
        ],
        attributes: [
            { access: 'Public', mode: 'None', type: 'string', name: 'file' },
            { access: 'Public', mode: 'None', type: 'string', name: 'content' },
            { access: 'Public', mode: 'None', type: '(val: string) => void', name: 'onChange' }
        ],
        observations: 'Optimizes editor redraws using shallow comparison on file name updates to prevent typing lag.'
    },
    {
        name: 'Sidebar',
        type: 'Concrete, React UI Component',
        description: 'Left vertical layout bar rendering file trees, daily notes commands, settings modal triggers, and the trash container.',
        inheritsFrom: 'React.Component',
        responsibilities: [
            'Displays core navigation buttons for settings, daily note generation, and search.',
            'Combines and renders the active VaultFileTree.'
        ],
        methods: [
            { access: 'Public', mode: 'None', returnType: 'JSX.Element', name: 'render', parameters: '*None*' }
        ],
        attributes: [],
        observations: 'Collapsible panel whose width can be adjusted dynamically by dragging the separator handle.'
    },
    {
        name: 'FileTree',
        type: 'Concrete, React UI Component',
        description: 'Renders the nested tree view of files and folders inside the active user vault.',
        inheritsFrom: 'React.Component',
        responsibilities: [
            'Renders directories and note files in a collapsible, structured catalog.',
            'Handles right-click events launching context menus for create/delete/rename.'
        ],
        methods: [
            { access: 'Public', mode: 'None', returnType: 'JSX.Element', name: 'render', parameters: '*None*' },
            { access: 'Private', mode: 'None', returnType: 'void', name: 'handleItemClick', parameters: 'path: string' }
        ],
        attributes: [
            { access: 'Public', mode: 'None', type: 'FileMetadata[]', name: 'files' },
            { access: 'Public', mode: 'None', type: 'string', name: 'activePath' },
            { access: 'Public', mode: 'None', type: '(path: string) => void', name: 'onSelect' }
        ],
        observations: 'Sorts directories alphabetically first, then note files.'
    },
    {
        name: 'GraphView',
        type: 'Concrete, React UI Component',
        description: 'Visualizes note nodes and bi-directional links using an interactive force-directed HTML canvas.',
        inheritsFrom: 'React.Component',
        responsibilities: [
            'Generates nodes and edges mapped from the vault links database.',
            'Executes force simulations (collision, center, link) to coordinate coordinate updates.',
            'Supports mouse pan, zoom, and node click navigation.'
        ],
        methods: [
            { access: 'Public', mode: 'None', returnType: 'JSX.Element', name: 'render', parameters: '*None*' },
            { access: 'Private', mode: 'None', returnType: 'void', name: 'startSimulation', parameters: '*None*' }
        ],
        attributes: [
            { access: 'Public', mode: 'None', type: 'GraphNode[]', name: 'nodes' },
            { access: 'Public', mode: 'None', type: 'GraphEdge[]', name: 'edges' }
        ],
        observations: 'Leverages HTML Canvas rather than SVG to preserve 60fps rendering in vaults with thousands of note nodes.'
    },
    {
        name: 'Settings',
        type: 'Concrete, React UI Component',
        description: 'Modal panel housing app configurations, active themes, translation configurations, and exclude patterns.',
        inheritsFrom: 'React.Component',
        responsibilities: [
            'Renders tabs for general, editor, plugin and language configurations.',
            'Updates persistent workspace stores when settings parameters change.'
        ],
        methods: [
            { access: 'Public', mode: 'None', returnType: 'JSX.Element', name: 'render', parameters: '*None*' }
        ],
        attributes: [
            { access: 'Public', mode: 'None', type: 'boolean', name: 'isOpen' },
            { access: 'Public', mode: 'None', type: '() => void', name: 'onClose' }
        ],
        observations: 'Interacts directly with backend app config write endpoints to save adjustments.'
    },
    {
        name: 'CommandPalette',
        type: 'Concrete, React UI Component',
        description: 'Fuzzy search command trigger modal overlay matching keywords to registered keyboard shortcuts.',
        inheritsFrom: 'React.Component',
        responsibilities: [
            'Lists all active UI actions registered by loaded plugins.',
            'Executes fuzzy scoring algorithms on active search inputs.',
            'Triggers action callbacks upon enter click.'
        ],
        methods: [
            { access: 'Public', mode: 'None', returnType: 'JSX.Element', name: 'render', parameters: '*None*' },
            { access: 'Private', mode: 'None', returnType: 'void', name: 'filterCommands', parameters: 'query: string' }
        ],
        attributes: [
            { access: 'Public', mode: 'None', type: 'boolean', name: 'isOpen' },
            { access: 'Public', mode: 'None', type: '() => void', name: 'onClose' }
        ],
        observations: 'Closes automatically on Escape keypress or outside click.'
    },
    {
        name: 'TemplatePicker',
        type: 'Concrete, React UI Component',
        description: 'Overlay fuzzy modal to select and generate notes from custom templates.',
        inheritsFrom: 'React.Component',
        responsibilities: [
            'Lists files in the designated templates folder.',
            'Triggers backend templates generation with dynamic variables substitution.'
        ],
        methods: [
            { access: 'Public', mode: 'None', returnType: 'JSX.Element', name: 'render', parameters: '*None*' }
        ],
        attributes: [
            { access: 'Public', mode: 'None', type: 'boolean', name: 'isOpen' },
            { access: 'Public', mode: 'None', type: '() => void', name: 'onClose' }
        ],
        observations: 'Filters out non-markdown templates dynamically.'
    },
    {
        name: 'TrashModal',
        type: 'Concrete, React UI Component',
        description: 'View list of deleted notes, allowing permanent deletion or structural recovery.',
        inheritsFrom: 'React.Component',
        responsibilities: [
            'Fetches and lists all active trash database entries.',
            'Triggers backend restore or permanent delete endpoints.'
        ],
        methods: [
            { access: 'Public', mode: 'None', returnType: 'JSX.Element', name: 'render', parameters: '*None*' }
        ],
        attributes: [
            { access: 'Public', mode: 'None', type: 'boolean', name: 'isOpen' },
            { access: 'Public', mode: 'None', type: '() => void', name: 'onClose' }
        ],
        observations: 'Supports batch operations to empty trash in a single transaction.'
    }
];

// Curated definitions for Zustand State Stores
const stateStores = [
    {
        name: 'useWorkspaceStore',
        type: 'Concrete, Zustand State Store',
        description: 'Manages state details for open files tabs, split windows, active editing buffers, and navigational history.',
        inheritsFrom: 'None',
        responsibilities: [
            'Tracks the currently active note path.',
            'Coordinates tabs adding, closing, and ordering arrays.',
            'Maintains window split configurations.'
        ],
        methods: [
            { access: 'Public', mode: 'None', returnType: 'void', name: 'setActiveFile', parameters: 'path: string' },
            { access: 'Public', mode: 'None', returnType: 'void', name: 'openFile', parameters: 'path: string' },
            { access: 'Public', mode: 'None', returnType: 'void', name: 'closeFile', parameters: 'path: string' }
        ],
        attributes: [
            { access: 'Public', mode: 'None', type: 'string | null', name: 'activeFile' },
            { access: 'Public', mode: 'None', type: 'string[]', name: 'openFiles' },
            { access: 'Public', mode: 'None', type: 'string[]', name: 'navHistory' }
        ],
        observations: 'Subscribed to by the main layout shell to render corresponding tab contents.'
    },
    {
        name: 'useVaultStore',
        type: 'Concrete, Zustand State Store',
        description: 'Coordinates state metadata caches for indexed notes, asset mappings, bi-directional backlinks, and tags.',
        inheritsFrom: 'None',
        responsibilities: [
            'Holds the root folder directory path of the loaded vault.',
            'Caches the full nested files tree metadata.',
            'Coordinates real-time update triggers from the Rust file watcher.'
        ],
        methods: [
            { access: 'Public', mode: 'None', returnType: 'void', name: 'setVaultPath', parameters: 'path: string' },
            { access: 'Public', mode: 'None', returnType: 'void', name: 'setFiles', parameters: 'files: FileMetadata[]' },
            { access: 'Public', mode: 'None', returnType: 'void', name: 'updateFile', parameters: 'path: string, metadata: FileMetadata' }
        ],
        attributes: [
            { access: 'Public', mode: 'None', type: 'string', name: 'vaultPath' },
            { access: 'Public', mode: 'None', type: 'FileMetadata[]', name: 'files' },
            { access: 'Public', mode: 'None', type: 'Map<string, string[]>', name: 'backlinks' }
        ],
        observations: 'Clears all cache memories dynamically when a new vault directory is loaded.'
    },
    {
        name: 'useUIStore',
        type: 'Concrete, Zustand State Store',
        description: 'Orchestrates the active visibility boundaries of layouts, modals, and panel sizes.',
        inheritsFrom: 'None',
        responsibilities: [
            'Tracks sidebar expansion states.',
            'Tracks overlay modal visibilities (Command palette, Settings, Trash).'
        ],
        methods: [
            { access: 'Public', mode: 'None', returnType: 'void', name: 'toggleSidebar', parameters: '*None*' },
            { access: 'Public', mode: 'None', returnType: 'void', name: 'openModal', parameters: 'modalName: string' },
            { access: 'Public', mode: 'None', returnType: 'void', name: 'closeModal', parameters: '*None*' }
        ],
        attributes: [
            { access: 'Public', mode: 'None', type: 'boolean', name: 'sidebarOpen' },
            { access: 'Public', mode: 'None', type: 'string | null', name: 'activeModal' }
        ],
        observations: 'Used by keyboard shortcut controllers to toggle panel views globally.'
    },
    {
        name: 'useThemeStore',
        type: 'Concrete, Zustand State Store',
        description: 'Manages user display themes, active color accents, typography families, and editor styling rules.',
        inheritsFrom: 'None',
        responsibilities: [
            'Coordinates active accent stylesheets overrides.',
            'Binds matching theme configurations to standard CSS variables.'
        ],
        methods: [
            { access: 'Public', mode: 'None', returnType: 'void', name: 'setTheme', parameters: 'theme: "light" | "dark"' },
            { access: 'Public', mode: 'None', returnType: 'void', name: 'setFontFamily', parameters: 'font: string' }
        ],
        attributes: [
            { access: 'Public', mode: 'None', type: '"light" | "dark"', name: 'theme' },
            { access: 'Public', mode: 'None', type: 'string', name: 'fontFamily' }
        ],
        observations: 'Persists configurations to localStorage to ensure immediate theme painting on window boot.'
    },
    {
        name: 'useSearchStore',
        type: 'Concrete, Zustand State Store',
        description: 'Handles cache memories for search queries, matching document indices, and search highlights.',
        inheritsFrom: 'None',
        responsibilities: [
            'Tracks search input string values.',
            'Caches active search results arrays fetched from the Tantivy engine.'
        ],
        methods: [
            { access: 'Public', mode: 'None', returnType: 'void', name: 'setQuery', parameters: 'query: string' },
            { access: 'Public', mode: 'None', returnType: 'void', name: 'setHits', parameters: 'hits: SearchHit[]' }
        ],
        attributes: [
            { access: 'Public', mode: 'None', type: 'string', name: 'query' },
            { access: 'Public', mode: 'None', type: 'SearchHit[]', name: 'hits' },
            { access: 'Public', mode: 'None', type: 'boolean', name: 'searching' }
        ],
        observations: 'Connects directly with notes search endpoints to run queries as you type.'
    }
];


// ----------------------------------------------------
// 2. BACKEND: Group by File to Embed Helper Structs
// ----------------------------------------------------
const prodRustStructs = rawRustStructs.filter(s => {
    return !s.filePath.includes('test_support') && s.name !== 'TestVault' && s.name !== 'TestVaultBuilder';
});

// Group components by file path
const rustFilesGroup = {};
for (const s of prodRustStructs) {
    if (!rustFilesGroup[s.filePath]) {
        rustFilesGroup[s.filePath] = [];
    }
    rustFilesGroup[s.filePath].push(s);
}

// Map each file to a single main "Class/Component" containing its helper structs
const backendComponents = [];

for (const [filePath, components] of Object.entries(rustFilesGroup)) {
    // 1. Choose Main Component:
    // If there is an isModuleClass, it represents the free functions of that file (Tauri commands/utils). That is the main entry point!
    // Otherwise, pick the struct with the most methods, otherwise pick the first one.
    let mainComponent = components.find(c => c.isModuleClass);
    if (!mainComponent) {
        mainComponent = components.reduce((max, c) => (c.methods.length > max.methods.length ? c : max), components[0]);
    }

    const helpers = components.filter(c => c !== mainComponent && !c.isModuleClass);

    // Merge methods from any other components (like struct impls) in this file into the main component methods list
    const allMethods = [];
    const mainMethodsNames = new Set();
    
    // Add main methods first
    mainComponent.methods.forEach(m => {
        allMethods.push(m);
        mainMethodsNames.add(m.name);
    });

    // Merge any helper struct's impl methods if they exist
    components.forEach(c => {
        if (c !== mainComponent) {
            c.methods.forEach(m => {
                if (!mainMethodsNames.has(m.name)) {
                    allMethods.push(m);
                    mainMethodsNames.add(m.name);
                }
            });
        }
    });

    // Choose display name (e.g. if mainComponent is "NotesModule", name is NotesModule)
    let displayName = mainComponent.name;
    let mainAttributes = mainComponent.attributes;
    
    // If the mainComponent was the virtual module, its attributes are empty. We can map the main struct fields to the attributes if applicable!
    const mainStruct = components.find(c => !c.isModuleClass && c.attributes.length > 0);
    if (mainComponent.isModuleClass && mainStruct) {
        mainAttributes = mainStruct.attributes;
    }

    // Determine type
    let structType = 'Concrete, Rust Module';
    if (displayName === 'Database') structType = 'Concrete, Connection Pool';
    else if (displayName === 'SearchIndex') structType = 'Concrete, Tantivy Index';
    else if (displayName === 'VaultIndexer') structType = 'Concrete, Core Service';
    else if (displayName === 'AppState') structType = 'Concrete, Shared State';
    else if (filePath.includes('/commands/')) structType = 'Concrete, Tauri IPC Commands Module';
    else if (filePath.includes('/utils/')) structType = 'Concrete, Pure Utility Module';

    backendComponents.push({
        name: displayName,
        type: structType,
        filePath: filePath,
        description: mainComponent.description || `Backend component orchestrating operations inside \`${filePath}\`.`,
        methods: allMethods,
        attributes: mainAttributes,
        internalStructs: helpers,
        observations: mainComponent.description // fallback
    });
}


// ----------------------------------------------------
// 3. COMPILE DOCUMENT
// ----------------------------------------------------
let md = `# 8.4. Detailed Design

This section documents the detailed design of the Tessellum application in compliance with the UNE-157801:2014 standard. It contains the catalog and specification of all relevant components in both the TypeScript frontend and the Rust backend, detailing their attributes, methods, inheritance/traits, responsibilities, and runtime observations.

## 8.4.2. Class Catalog and Specifications

Tessellum is structured using a hybrid, decoupled architecture:
- **TypeScript Subsystem**: Implements event-driven orchestration, sandbox plug-in facades, state management stores, and core UI layouts.
- **Rust Subsystem**: Executes heavy background indexers, Tantivy full-text index pipelines, SQLite WAL database management, and platform-level operations.

`;

// Group mapping
const groups = {
    '1. Core Application Framework': prodPlugins.filter(c => ['TessellumApp', 'PluginRegistry', 'Plugin'].includes(c.name)),
    '2. Built-in Extensibility Plugins': prodPlugins.filter(c => c.name.endsWith('Plugin')),
    '3. React UI Components': reactComponents,
    '4. Zustand State Stores': stateStores,
    '5. Rust Platform Backend Components': backendComponents
};

let sectionIndex = 1;

for (const [groupName, componentsList] of Object.entries(groups)) {
    md += `### 8.4.2.${sectionIndex}. ${groupName}\n\n`;
    componentsList.sort((a, b) => a.name.localeCompare(b.name));

    for (const c of componentsList) {
        const itemIdx = componentsList.indexOf(c) + 1;
        const groupNum = sectionIndex;

        if (groupName.startsWith('1.') || groupName.startsWith('2.')) {
            // TypeScript Plugins (AST derived)
            const classType = c.isAbstract ? 'Abstract' : (c.name === 'TessellumApp' ? 'Concrete, Singleton' : 'Concrete, Plugin');
            
            let responsibilities = [];
            if (c.name === 'TessellumApp') {
                responsibilities = [
                    "Orchestrates the global runtime lifecycle of the application.",
                    "Provides centralized, type-safe API facades to plugins for Editor, Vault, Workspace, Commands, UI, and Internationalization.",
                    "Exposes the main event bus for global inter-subsystem communication."
                ];
            } else if (c.name === 'PluginRegistry') {
                responsibilities = [
                    "Manages the registration, loading, and unloading of all built-in and third-party plugins.",
                    "Ensures plugin error isolation so that runtime failures in one plugin do not crash the host application.",
                    "Maintains state for enabled and disabled plugins, allowing dynamic activation/deactivation."
                ];
            } else if (c.name === 'Plugin') {
                responsibilities = [
                    "Acts as the abstract base class defining the life-cycle methods (onload, onunload) for all runtime plugins.",
                    "Tracks registered UI commands, translation bundles, and event handlers registered by a specific plugin.",
                    "Coordinates clean automated resource teardown during plugin deactivation."
                ];
            } else {
                responsibilities = [
                    `Hooks into the Tessellum core runtime to initialize the ${c.name.replace('Plugin', '')} subsystem.`,
                    `Registers markdown parsers, CodeMirror decoration widgets, settings tabs, or command hooks specific to this plugin.`
                ];
            }

            let observations = "Designed for high reliability and clean lifecycle integration. Adheres to strict memory management standards.";
            if (c.name === 'TessellumApp') observations = "Must be created via TessellumApp.create() static factory during initial window load. Singleton reference is accessible globally.";
            else if (c.name === 'PluginRegistry') observations = "Used exclusively by the core shell to boot plugins. Uses try/catch blocks to isolate and protect from malformed third-party codes.";
            else if (c.name === 'Plugin') observations = "All plugin implementations must extend this class and override onload(). Internal tracking variables use protected symbols.";

            md += `#### 8.4.2.${groupNum}.${itemIdx}. Class ${c.name}\n\n`;
            
            // Metadata
            md += `| Attribute / Metadata | Value |\n`;
            md += `| --- | --- |\n`;
            md += `| **Name** | \`${c.name}\` |\n`;
            md += `| **Type** | ${classType} |\n`;
            md += `| **Description** | ${c.description.replace(/\n/g, ' ').replace(/\|/g, '\\|').trim() || 'No active description.'} |\n`;
            md += `| **Inherited From** | \`${c.inheritsFrom}\` |\n\n`;

            // Responsibilities
            md += `##### Responsibilities\n\n`;
            md += `| ID | Description |\n`;
            md += `| --- | --- |\n`;
            responsibilities.forEach((r, idx) => {
                md += `| R-${idx + 1} | ${r} |\n`;
            });
            md += `\n`;

            // Methods
            md += `##### Methods\n\n`;
            if (c.methods.length === 0) {
                md += `*No exposed methods defined.*\n\n`;
            } else {
                md += `| Access | Mode | Return Type | Name | Parameters and Types |\n`;
                md += `| --- | --- | --- | --- | --- |\n`;
                c.methods.forEach(m => {
                    const params = m.parameters ? `\`${m.parameters.replace(/\|/g, '\\|')}\`` : '*None*';
                    md += `| ${m.access} | ${m.mode} | \`${m.returnType.replace(/\|/g, '\\|')}\` | \`${m.name}\` | ${params} |\n`;
                });
                md += `\n`;
            }

            // Attributes
            md += `##### Attributes\n\n`;
            if (c.attributes.length === 0) {
                md += `*No exposed attributes defined.*\n\n`;
            } else {
                md += `| Access | Mode | Type or Class | Name |\n`;
                md += `| --- | --- | --- | --- |\n`;
                c.attributes.forEach(a => {
                    md += `| ${a.access} | ${a.mode} | \`${a.type.replace(/\|/g, '\\|')}\` | \`${a.name}\` |\n`;
                });
                md += `\n`;
            }

            // Observations
            md += `##### Observations\n\n`;
            md += `${observations}\n\n`;

        } else if (groupName.startsWith('3.') || groupName.startsWith('4.')) {
            // UI Components or Zustand Stores (Curated)
            md += `#### 8.4.2.${groupNum}.${itemIdx}. Class ${c.name}\n\n`;
            
            // Metadata
            md += `| Attribute / Metadata | Value |\n`;
            md += `| --- | --- |\n`;
            md += `| **Name** | \`${c.name}\` |\n`;
            md += `| **Type** | ${c.type} |\n`;
            md += `| **Description** | ${c.description} |\n`;
            md += `| **Inherited From** | \`${c.inheritsFrom}\` |\n\n`;

            // Responsibilities
            md += `##### Responsibilities\n\n`;
            md += `| ID | Description |\n`;
            md += `| --- | --- |\n`;
            c.responsibilities.forEach((r, idx) => {
                md += `| R-${idx + 1} | ${r} |\n`;
            });
            md += `\n`;

            // Methods
            md += `##### Methods\n\n`;
            if (c.methods.length === 0) {
                md += `*No exposed methods defined.*\n\n`;
            } else {
                md += `| Access | Mode | Return Type | Name | Parameters and Types |\n`;
                md += `| --- | --- | --- | --- | --- |\n`;
                c.methods.forEach(m => {
                    md += `| ${m.access} | ${m.mode} | \`${m.returnType}\` | \`${m.name}\` | \`${m.parameters}\` |\n`;
                });
                md += `\n`;
            }

            // Attributes
            md += `##### Attributes\n\n`;
            if (c.attributes.length === 0) {
                md += `*No exposed attributes defined.*\n\n`;
            } else {
                md += `| Access | Mode | Type or Class | Name |\n`;
                md += `| --- | --- | --- | --- |\n`;
                c.attributes.forEach(a => {
                    md += `| ${a.access} | ${a.mode} | \`${a.type}\` | \`${a.name}\` |\n`;
                });
                md += `\n`;
            }

            // Observations
            md += `##### Observations\n\n`;
            md += `${c.observations}\n\n`;

        } else {
            // Rust Components (grouped by file)
            let responsibilities = [];
            let observations = "Utilizes Serde traits to automatically serialize data models crossing the Tauri IPC bridge.";

            if (c.name === 'Database') {
                responsibilities = [
                    "Manages the sqlx SQLite connection pool with WAL mode execution.",
                    "Executes database migrations and table setups for notes, tags, and links.",
                    "Coordinates bi-directional link and backlink persistence and transactional updates.",
                    "Exposes robust search, rename, delete, and tags query operations."
                ];
                observations = "Must be initialized once at startup using Database::init(). Implements SqlitePool for multi-threaded safety. Runs PRAGMA foreign_keys = ON.";
            } else if (c.name === 'SearchIndex') {
                responsibilities = [
                    "Initializes and maintains Tantivy full-text schemas (path, title, headers, tags, contents).",
                    "Handles search index document creation, deletion, commits, and rebuild operations.",
                    "Provides optimized term matching, snippet generation, and query highlights."
                ];
                observations = "Guarded by thread-safe Mutexes on writers to allow concurrent async readers (Tantivy IndexReader) without locking.";
            } else if (c.name === 'VaultIndexer') {
                responsibilities = [
                    "Crawls directory hierarchies recursively, scanning markdown files and assets.",
                    "Extracts YAML frontmatter tags, metadata, inline tags, and wiki-link paths.",
                    "Validates and indexes differences based on modification times to maximize speed."
                ];
                observations = "Utilizes filesystem stat-checks to skip parsing unmodified files, optimizing vault load speed.";
            } else if (c.name === 'AppState') {
                responsibilities = [
                    "Encapsulates shared backend handles including database pools and search engines.",
                    "Manages search readiness state transitions for IPC command verification."
                ];
                observations = "Injected directly into Tauri commands using #[tauri::State] for zero-cost dependency injection across command handlers.";
            } else if (c.name.endsWith('Commands')) {
                responsibilities = [
                    `Exposes safe, asynchronous Tauri IPC commands connecting the frontend shell to ${c.name.replace('Commands', '')} operations.`,
                    "Handles argument serialization and encapsulates error state transformations crossing the IPC bridge."
                ];
                observations = "Designed as a stateless module class container mapping procedural functions. Functions are registered directly as Tauri IPC entry points.";
            } else if (c.name.endsWith('Utils')) {
                responsibilities = [
                    "Provides highly optimized, stateless utility procedures for text manipulation, path mapping, and validations."
                ];
                observations = "Pure stateless procedural library.";
            } else {
                responsibilities = [
                    `Coordinates operations and encapsulates free-standing functions inside the ${c.name} module.`
                ];
            }

            md += `#### 8.4.2.${groupNum}.${itemIdx}. Component ${c.name}\n\n`;
            
            // Metadata Table
            md += `| Attribute / Metadata | Value |\n`;
            md += `| --- | --- |\n`;
            md += `| **Name** | \`${c.name}\` |\n`;
            md += `| **Type** | ${c.type} |\n`;
            md += `| **File Path** | \`${c.filePath}\` |\n`;
            md += `| **Description** | ${c.description.replace(/\n/g, ' ').replace(/\|/g, '\\|').trim() || 'No active description.'} |\n`;
            md += `| **Traits / Inheritance** | \`Serialize, Deserialize, Clone\` |\n\n`;

            // Responsibilities
            md += `##### Responsibilities\n\n`;
            md += `| ID | Description |\n`;
            md += `| --- | --- |\n`;
            responsibilities.forEach((r, idx) => {
                md += `| R-${idx + 1} | ${r} |\n`;
            });
            md += `\n`;

            // Methods
            md += `##### Methods & Functions\n\n`;
            if (c.methods.length === 0) {
                md += `*No exposed methods or functions defined.*\n\n`;
            } else {
                md += `| Access | Mode | Return Type | Name | Parameters and Types |\n`;
                md += `| --- | --- | --- | --- | --- |\n`;
                c.methods.forEach(m => {
                    const params = m.parameters ? `\`${m.parameters.replace(/\|/g, '\\|')}\`` : '*None*';
                    md += `| ${m.access} | ${m.mode} | \`${m.returnType.replace(/\|/g, '\\|')}\` | \`${m.name}\` | ${params} |\n`;
                });
                md += `\n`;
            }

            // Attributes
            md += `##### Attributes & Fields\n\n`;
            if (c.attributes.length === 0) {
                md += `*No attributes or fields defined.*\n\n`;
            } else {
                md += `| Access | Mode | Type or Struct | Name |\n`;
                md += `| --- | --- | --- | --- |\n`;
                c.attributes.forEach(a => {
                    md += `| ${a.access} | ${a.mode} | \`${a.type.replace(/\|/g, '\\|')}\` | \`${a.name}\` |\n`;
                });
                md += `\n`;
            }

            // Helpers (Nested Structs inside)
            if (c.internalStructs.length > 0) {
                md += `##### Internal Data Structures (Structs)\n\n`;
                md += `The following structures are defined inside \`${c.filePath}\` and are scoped directly under ${c.name}:\n\n`;
                
                for (const helper of c.internalStructs) {
                    md += `###### Struct \`${helper.name}\`\n\n`;
                    md += `${helper.description.replace(/\n/g, ' ').trim() || 'Data structure scoped under ' + c.name + '.'}\n\n`;

                    if (helper.attributes.length > 0) {
                        md += `| Access | Mode | Type or Struct | Field Name |\n`;
                        md += `| --- | --- | --- | --- |\n`;
                        helper.attributes.forEach(a => {
                            md += `| ${a.access} | ${a.mode} | \`${a.type.replace(/\|/g, '\\|')}\` | \`${a.name}\` |\n`;
                        });
                        md += `\n`;
                    }
                }
            }

            // Observations
            md += `##### Observations\n\n`;
            md += `${observations}\n\n`;
        }

        // Page break boundary
        md += `<div style="page-break-after: always;"></div>\n\n`;
    }

    sectionIndex++;
}

// Write the output file
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, md, 'utf8');
console.log(`Generated unified, nested UNE-157801 Class Description Document at ${outputPath}`);
