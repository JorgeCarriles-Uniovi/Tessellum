import {
    useState,
    useCallback,
    useMemo,
    useRef,
    useEffect,
    RefObject
} from 'react';
import { EditorView, keymap } from '@codemirror/view';
import { Prec } from "@codemirror/state";
import { invoke } from "@tauri-apps/api/core";
import { FileMetadata } from '../../../types.ts';
import { WikiLinkSuggestion } from '../WikiLinkSuggestionsMenu.tsx';

// ============================================================================
// TYPES
// ============================================================================

interface MenuCoords {
    left: number;
    top: number;
    placement: 'bottom' | 'top';
}

interface WikiLinkContext {
    queryText: string;      // Text after [[ (before |)
    aliasText: string;      // Text after | (if present)
    hasAlias: boolean;      // Whether user typed |
    bracketPos: number;     // Absolute position of [[
}

// ============================================================================
// PURE UTILITIES
// ============================================================================

/**
 * Extract wikilink context from current cursor position
 * Handles: [[query or [[target|alias
 */
function getWikiLinkContext(state: { doc: any; selection: { main: { from: number } } }, cursorPos: number): WikiLinkContext | null {
    const line = state.doc.lineAt(cursorPos);
    const lineOffset = cursorPos - line.from;
    const lineText = line.text.slice(0, lineOffset);

    // Find the last [[ that isn't escaped
    const bracketIndex = lineText.lastIndexOf('[[');
    if (bracketIndex === -1) return null;

    // Check if escaped
    if (bracketIndex > 0 && lineText[bracketIndex - 1] === '\\') return null;

    // Check we haven't closed the bracket yet
    const afterBrackets = lineText.slice(bracketIndex + 2);
    if (afterBrackets.includes(']]')) return null;

    // Parse the content: check for alias separator
    const pipeIndex = afterBrackets.indexOf('|');

    if (pipeIndex !== -1) {
        return {
            queryText: afterBrackets.slice(0, pipeIndex),
            aliasText: afterBrackets.slice(pipeIndex + 1),
            hasAlias: true,
            bracketPos: line.from + bracketIndex
        };
    }

    return {
        queryText: afterBrackets,
        aliasText: '',
        hasAlias: false,
        bracketPos: line.from + bracketIndex
    };
}

// ============================================================================
// MENU STATE HOOK
// ============================================================================

function useMenuState() {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0, placement: 'bottom' as 'bottom' | 'top' });
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [hasAlias, setHasAlias] = useState(false);
    const [aliasText, setAliasText] = useState("");

    const isOpenRef = useRef(false);
    const selectedIndexRef = useRef(0);

    useEffect(() => {
        selectedIndexRef.current = selectedIndex;
    }, [selectedIndex]);

    const openMenu = useCallback((coords: MenuCoords) => {
        setIsOpen(true);
        isOpenRef.current = true;
        setPosition({ x: coords.left, y: coords.top, placement: coords.placement });
        setQuery("");
        setSelectedIndex(0);
        setHasAlias(false);
        setAliasText("");
    }, []);

    const closeMenu = useCallback(() => {
        setIsOpen(false);
        isOpenRef.current = false;
    }, []);

    const updateContext = useCallback((q: string, alias: string, hasAl: boolean) => {
        setQuery(q);
        setAliasText(alias);
        setHasAlias(hasAl);
    }, []);

    const moveSelection = useCallback((direction: 'up' | 'down', maxIndex: number) => {
        setSelectedIndex(prev => {
            if (direction === 'up') return prev > 0 ? prev - 1 : maxIndex;
            return prev < maxIndex ? prev + 1 : 0;
        });
    }, []);

    return {
        isOpen,
        isOpenRef,
        position,
        query,
        selectedIndex,
        hasAlias,
        aliasText,
        openMenu,
        closeMenu,
        updateContext,
        moveSelection,
        setSelectedIndex,
        selectedIndexRef
    };
}

// ============================================================================
// FILE CACHE HOOK
// ============================================================================

function useFileCache(vaultPath: string) {
    const [files, setFiles] = useState<WikiLinkSuggestion[]>([]);
    const cacheRef = useRef<WikiLinkSuggestion[]>([]);

    useEffect(() => {
        if (!vaultPath) return;

        const loadFiles = async () => {
            try {
                const result = await invoke<FileMetadata[]>('list_files', { vaultPath });
                const suggestions = result
                    .filter(f => !f.is_dir && f.filename.endsWith('.md'))
                    .map(f => {
                        // Calculate relative path from vault
                        let relativePath = f.path.replace(vaultPath, '');
                        // Normalize slashes and remove leading slash
                        relativePath = relativePath.replace(/\\/g, '/').replace(/^\//, '');

                        return {
                            name: f.filename.replace('.md', ''),
                            relativePath: relativePath,
                            fullPath: f.path
                        };
                    });

                setFiles(suggestions);
                cacheRef.current = suggestions;
            } catch (error) {
                console.error('Failed to load files for wikilink suggestions:', error);
            }
        };

        loadFiles();

        // Refresh periodically
        const interval = setInterval(loadFiles, 30000);
        return () => clearInterval(interval);
    }, [vaultPath]);

    return { files, cacheRef };
}

// ============================================================================
// TRIGGER HOOK - Detects [[ and opens menu
// ============================================================================

function useWikiLinkTrigger(
    isOpenRef: RefObject<boolean>,
    openMenu: (coords: MenuCoords) => void
) {
    return useMemo(() => EditorView.domEventHandlers({
        keydown: (event, view) => {
            // Detect [ being typed
            if (event.key === '[' && !(isOpenRef.current ?? false)) {
                const { state } = view;
                const cursorPos = state.selection.main.from;

                // Check if previous char is also [
                if (cursorPos > 0) {
                    const prevChar = state.doc.sliceString(cursorPos - 1, cursorPos);
                    if (prevChar === '[') {
                        // We have [[, open the menu
                        const cursorCoords = view.coordsAtPos(cursorPos);
                        const editorRect = view.dom.getBoundingClientRect();

                        if (cursorCoords && editorRect) {
                            const MENU_HEIGHT = 400;
                            const spaceBelow = window.innerHeight - cursorCoords.bottom;
                            const placement = spaceBelow < MENU_HEIGHT ? 'top' : 'bottom';

                            const x = cursorCoords.left - editorRect.left;
                            const y = placement === 'bottom'
                                ? cursorCoords.bottom - editorRect.top
                                : cursorCoords.top - editorRect.top;

                            openMenu({ left: x, top: y, placement });
                        }
                    }
                }
            }
            return false;
        }
    }), [openMenu, isOpenRef]);
}

// ============================================================================
// DOCUMENT TRACKING - Updates query as user types
// ============================================================================

function useDocumentTracking(
    isOpen: boolean,
    updateContext: (q: string, alias: string, hasAlias: boolean) => void,
    closeMenu: () => void
) {
    return useMemo(() =>
            EditorView.updateListener.of((update) => {
                if (!isOpen || !update.docChanged) return;

                const context = getWikiLinkContext(update.state, update.state.selection.main.from);

                if (context) {
                    updateContext(context.queryText, context.aliasText, context.hasAlias);
                } else {
                    closeMenu();
                }
            }),
        [isOpen, updateContext, closeMenu]);
}

// ============================================================================
// KEYBOARD HANDLING
// ============================================================================

function useKeyboardHandling(
    isOpenRef: RefObject<boolean>,
    closeMenu: () => void,
    moveSelection: (dir: 'up' | 'down') => boolean,
    executeSelected: (view: EditorView) => boolean
) {
    return useMemo(() => Prec.highest(keymap.of([
        {
            key: "ArrowUp",
            run: () => {
                if (!isOpenRef.current) return false;
                return moveSelection('up');
            }
        },
        {
            key: "ArrowDown",
            run: () => {
                if (!isOpenRef.current) return false;
                return moveSelection('down');
            }
        },
        {
            key: "Enter",
            run: (view) => {
                if (!isOpenRef.current) return false;
                return executeSelected(view);
            }
        },
        {
            key: "Escape",
            run: () => {
                if (!isOpenRef.current) return false;
                closeMenu();
                return true;
            }
        },
        {
            key: "Tab",
            run: (view) => {
                if (!isOpenRef.current) return false;
                return executeSelected(view);
            }
        }
    ])), [isOpenRef, closeMenu, moveSelection, executeSelected]);
}

// ============================================================================
// COMMAND EXECUTION - Inserts the wikilink
// ============================================================================

function useInsertWikiLink(closeMenu: () => void, hasAlias: boolean, aliasText: string) {
    return useCallback((view: EditorView, suggestion: WikiLinkSuggestion) => {
        const { state } = view;
        const context = getWikiLinkContext(state, state.selection.main.from);

        if (!context) return;

        // Build the replacement text - only the content, not the brackets
        // since the editor already auto-closes ]]
        let insertText: string;

        if (hasAlias || context.hasAlias) {
            // User typed |, insert with alias: NoteName|alias
            const alias = aliasText || context.aliasText || suggestion.name;
            insertText = `${suggestion.name}|${alias}`;
        } else {
            // Simple link: just the note name
            insertText = suggestion.name;
        }

        // Replace from after [[ to current cursor position
        const insertFrom = context.bracketPos + 2; // After [[

        view.dispatch({
            changes: {
                from: insertFrom,
                to: state.selection.main.from,
                insert: insertText
            },
            selection: {
                anchor: insertFrom + insertText.length
            }
        });

        closeMenu();
        view.focus();
    }, [closeMenu, hasAlias, aliasText]);
}

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useWikiLinkSuggestions(vaultPath: string) {
    const menuState = useMenuState();
    const { files } = useFileCache(vaultPath);
    const insertWikiLink = useInsertWikiLink(
        menuState.closeMenu,
        menuState.hasAlias,
        menuState.aliasText
    );

    // Filter suggestions based on query
    const filteredSuggestions = useMemo(() => {
        if (!menuState.query) return files;

        const lowerQuery = menuState.query.toLowerCase();
        return files.filter(f =>
            f.name.toLowerCase().includes(lowerQuery) ||
            f.relativePath.toLowerCase().includes(lowerQuery)
        );
    }, [files, menuState.query]);

    const latestSuggestionsRef = useRef(filteredSuggestions);
    useEffect(() => {
        latestSuggestionsRef.current = filteredSuggestions;
    }, [filteredSuggestions]);

    // Execute selected suggestion
    const executeSelected = useCallback((view: EditorView) => {
        const suggestions = latestSuggestionsRef.current;
        if (!suggestions?.length) return false;

        const selected = suggestions[menuState.selectedIndexRef.current];
        if (selected) {
            insertWikiLink(view, selected);
            return true;
        }
        return false;
    }, [insertWikiLink, menuState.selectedIndexRef]);

    // Move selection with wrapping
    const moveSelection = useCallback((dir: 'up' | 'down') => {
        const suggestions = latestSuggestionsRef.current;
        const maxIndex = Math.max(0, (suggestions?.length ?? 0) - 1);
        menuState.moveSelection(dir, maxIndex);
        return true;
    }, [menuState.moveSelection]);

    // Extensions
    const keymapExtension = useKeyboardHandling(
        menuState.isOpenRef,
        menuState.closeMenu,
        moveSelection,
        executeSelected
    );

    const triggerExtension = useWikiLinkTrigger(
        menuState.isOpenRef,
        menuState.openMenu
    );

    const updateListener = useDocumentTracking(
        menuState.isOpen,
        menuState.updateContext,
        menuState.closeMenu
    );

    const wikiLinkSuggestionsExtension = useMemo(
        () => [updateListener, keymapExtension, triggerExtension],
        [updateListener, keymapExtension, triggerExtension]
    );

    // Reset selection when filtered list changes
    useEffect(() => {
        const maxIndex = Math.max(0, filteredSuggestions.length - 1);
        if (menuState.selectedIndex > maxIndex) {
            menuState.setSelectedIndex(maxIndex);
        }
    }, [filteredSuggestions.length, menuState.selectedIndex, menuState.setSelectedIndex]);

    return {
        wikiLinkSuggestionsExtension,
        wikiLinkSuggestionsProps: {
            isOpen: menuState.isOpen,
            position: menuState.position,
            selectedIndex: menuState.selectedIndex,
            query: menuState.query,
            filteredSuggestions,
            insertWikiLink,
            closeMenu: menuState.closeMenu,
            setSelectedIndex: menuState.setSelectedIndex
        }
    };
}
