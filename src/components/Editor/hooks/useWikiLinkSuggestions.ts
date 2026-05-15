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
import { WikiLinkSuggestion } from '../WikiLinkSuggestionsMenu.tsx';
import {
    getSafeWikiLinkCursorCoords,
    getWikiLinkContext,
    type WikiLinkContext,
} from "./wikiLinkSuggestionsLogic";

interface MenuCoords {
    left: number;
    top: number;
    placement: 'bottom' | 'top';
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
// FILE CACHE HOOK (Replaced with backend search)
// ============================================================================

function useNoteSearch(vaultPath: string, query: string, isOpen: boolean) {
    const [suggestions, setSuggestions] = useState<WikiLinkSuggestion[]>([]);

    useEffect(() => {
        if (!vaultPath || !isOpen) return;

        const performSearch = async () => {
            try {
                interface NoteSuggestion {
                    name: string;
                    relative_path: string;
                    full_path: string;
                }
                const result = await invoke<NoteSuggestion[]>('search_notes', { vaultPath, query });

                const formattedSuggestions = result.map(f => ({
                    name: f.name,
                    relativePath: f.relative_path,
                    fullPath: f.full_path
                }));

                setSuggestions(formattedSuggestions);
            } catch (error) {
                console.error('Failed to search notes:', error);
            }
        };

        // Debounce search slightly
        const timeoutId = setTimeout(performSearch, 150);
        return () => clearTimeout(timeoutId);
    }, [vaultPath, query, isOpen]);

    return suggestions;
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
                        const cursorCoords = getSafeWikiLinkCursorCoords(view, cursorPos);
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

    const insertWikiLink = useInsertWikiLink(
        menuState.closeMenu,
        menuState.hasAlias,
        menuState.aliasText
    );

    const suggestions = useNoteSearch(vaultPath, menuState.query, menuState.isOpen);

    const latestSuggestionsRef = useRef(suggestions);
    useEffect(() => {
        latestSuggestionsRef.current = suggestions;
    }, [suggestions]);

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
        const maxIndex = Math.max(0, suggestions.length - 1);
        if (menuState.selectedIndex > maxIndex) {
            menuState.setSelectedIndex(maxIndex);
        }
    }, [suggestions.length, menuState.selectedIndex, menuState.setSelectedIndex]);

    return {
        wikiLinkSuggestionsExtension,
        wikiLinkSuggestionsProps: {
            isOpen: menuState.isOpen,
            position: menuState.position,
            selectedIndex: menuState.selectedIndex,
            query: menuState.query,
            filteredSuggestions: suggestions,
            insertWikiLink,
            closeMenu: menuState.closeMenu,
            setSelectedIndex: menuState.setSelectedIndex
        }
    };
}
