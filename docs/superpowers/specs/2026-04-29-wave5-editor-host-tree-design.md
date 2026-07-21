# Wave 5 Editor Host and File Tree Design

## Objective

Wave 5 covers the remaining frontend host-orchestration slice around the editor shell and file-tree component layer. The focus is on logic-bearing React components and their supporting hooks where branch coverage depends on keyboard handling, menu state, view-state guards, and selection orchestration rather than on simple rendering.

## In Scope

- `src/components/Editor/Editor.tsx`
- `src/components/Editor/editorViewHelpers.ts`
- `src/components/Editor/CalloutPicker.tsx`
- `src/components/Editor/SlashMenu.tsx`
- `src/components/Editor/TableSizePicker.tsx`
- `src/components/Editor/TabStrip.tsx`
- `src/components/Editor/WikiLinkSuggestionsMenu.tsx`
- `src/components/Editor/workspaceOverview/WorkspaceOverview.tsx`
- `src/components/Editor/hooks/useEditorExtensions.ts`
- `src/components/Editor/hooks/usePropertyAutocomplete.ts`
- `src/components/Editor/hooks/useSlashCommand.ts`
- `src/components/Editor/hooks/useTagAutocomplete.ts`
- `src/components/Editor/hooks/useWikiLinkSuggestions.ts`
- `src/components/Editor/hooks/slashCommandLogic.ts`
- `src/components/Editor/hooks/wikiLinkSuggestionsLogic.ts`
- `src/components/FileTree/FileTree.tsx`
- `src/components/FileTree/FileNode.tsx`

## Out of Scope

- CSS files
- `index` files
- Pure asset files
- Remaining app-shell, settings, graph, and backend files assigned to later waves

## Testability Strategy

1. Extract branch-heavy pure logic from `Editor.tsx` and the autocomplete hooks into dedicated helper files so the host component stays smaller and the tests stay deterministic.
2. Keep each test independent by resetting Zustand state, Tauri mocks, DOM cleanup, and singleton app state after every case.
3. Cover host components through public interaction contracts: keyboard events, clicks, drag intent, and store-visible side effects.
4. Use lightweight component mocks only where full editor runtime setup would add noise without adding branch confidence.

## Branch Targets

### Editor Host

- Empty-state action selection for open-vault vs open-note flows
- Media note branch vs editable note branch
- Read-only guard vs editable content updates
- Selection toolbar enabled vs disabled
- Relative time and preview metadata formatting

### Editor Menus and Hooks

- Slash context valid vs invalid parsing
- Wikilink context simple vs alias vs escaped vs closed parsing
- Property/tag autocomplete success vs backend failure
- Editor extension assembly with cached bundle, loaded bundle, and failed bundle branches
- Menu keyboard navigation, outside-click close, hover selection, and confirm actions
- Tab reorder activation threshold and cleanup
- Workspace overview keyboard wraparound and close behavior

### File Tree

- Single select vs modifier toggle vs range select
- Context-menu preselection
- Directory expand/collapse from keyboard
- Empty folder display branch
- Drag intent forwarding from the tree host

## Acceptance Criteria

- Every in-scope logic-bearing file above has direct automated coverage in Wave 5.
- Tests demonstrate specification-based, structure-based, and error-guessing techniques.
- The seam extraction reduces cognitive complexity without changing behavior.
- The Wave 5 suites remain isolated and order-independent.
