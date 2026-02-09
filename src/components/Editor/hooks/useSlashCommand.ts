import {
    useState,
    useCallback,
    useMemo,
    useRef,
    useEffect,
    RefObject
} from 'react';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { CommandItem } from '../../../types.ts';
import { Prec } from "@codemirror/state";
import { COMMANDS } from "../../../constants/commands.tsx";

// ===== PURE UTILITIES (no React dependencies) =====

function getSlashContext(state: EditorState, cursorPos: number) {
    const line = state.doc.lineAt(cursorPos);
    const lineOffset = cursorPos - line.from;
    const slashPos = line.text.lastIndexOf('/', lineOffset);

    if (slashPos === -1) return null;

    const queryText = line.text.slice(slashPos + 1, lineOffset);
    const hasSpace = queryText.includes(' ');
    const cursorAfterSlash = lineOffset >= slashPos;

    return (hasSpace) || !cursorAfterSlash ? null : {
        queryText: queryText,
        absoluteSlashPos: line.from + slashPos
    };
}

function canTriggerSlash(state: EditorState, cursorPos: number) {
    if (cursorPos === 0) return true;
    const charBefore = state.doc.sliceString(cursorPos - 1, cursorPos);
    return charBefore === ' ' || charBefore === '\n';
}

interface MenuCoords {
    left: number;
    top: number;
    placement: 'bottom' | 'top';
}

function useSlashTrigger(isOpenRef: RefObject<boolean>, openMenu: (coords: MenuCoords) => void) {
    return useMemo(() => EditorView.domEventHandlers({
        keydown: (event, view) => {
            if (event.key === '/' && !(isOpenRef.current ?? false)) {
                const { state } = view;
                const cursorPos = state.selection.main.from;
                if (state.selection.main.empty && canTriggerSlash(state, cursorPos)) {

                    const cursorCoords = view.coordsAtPos(cursorPos);
                    const editorRect = view.dom.getBoundingClientRect();

                    if (cursorCoords && editorRect) {
                        // --- LÓGICA DE COLISIÓN ---
                        const MENU_HEIGHT = 320; // Altura máxima estimada del menú
                        const spaceBelow = window.innerHeight - cursorCoords.bottom;

                        // Si hay menos de 320px abajo, lo ponemos arriba
                        const placement = spaceBelow < MENU_HEIGHT ? 'top' : 'bottom';

                        // Cálculo de X (siempre igual)
                        const x = cursorCoords.left - editorRect.left;

                        // Cálculo de Y (Depende de si va arriba o abajo)
                        let y;
                        if (placement === 'bottom') {
                            // Si va abajo: Usamos la parte inferior del cursor
                            y = cursorCoords.bottom - editorRect.top;
                        } else {
                            // Si va arriba: Usamos la parte SUPERIOR del cursor (para que no tape el texto)
                            y = cursorCoords.top - editorRect.top;
                        }

                        openMenu({ left: x, top: y, placement });
                    }
                }
            }
            return false;
        }
    }), [openMenu, isOpenRef]);
}

// ===== MENU STATE HOOK =====

function useMenuState() {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0, placement: 'bottom' as 'bottom' | 'top' });
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);

    const isOpenRef = useRef(false);
    const selectedIndexRef = useRef(0);

    // Keep ref in sync
    useEffect(() => {
        selectedIndexRef.current = selectedIndex;
    }, [selectedIndex]);

    const openMenu = useCallback((coords: { left: number; top: number; placement: 'bottom' | 'top' }) => {
        setIsOpen(true);
        isOpenRef.current = true;
        setPosition({ x: coords.left, y: coords.top, placement: coords.placement });
        setQuery("");
        setSelectedIndex(0);
    }, []);

    const closeMenu = useCallback(() => {
        setIsOpen(false);
        isOpenRef.current = false;
    }, []);

    const updateQuery = useCallback((newQuery: string) => {
        setQuery(newQuery);
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
        openMenu,
        closeMenu,
        updateQuery,
        moveSelection,
        setSelectedIndex,
        selectedIndexRef
    };
}

// ===== DOCUMENT CHANGE TRACKING =====

function useDocumentTracking(isOpen: boolean, updateQuery: (q: string) => void, closeMenu: () => void) {
    return useMemo(() =>
            EditorView.updateListener.of((update) => {
                if (!isOpen || !update.docChanged) return;

                const context = getSlashContext(update.state, update.state.selection.main.from);

                if (context) {
                    updateQuery(context.queryText);
                } else {
                    closeMenu();
                }
            }),
        [isOpen, updateQuery, closeMenu]);
}

// ===== KEYBOARD HANDLING =====

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
        }
    ])), [isOpenRef, closeMenu, moveSelection, executeSelected]);
}

// ===== COMMAND EXECUTION =====

function useCommandExecution(closeMenu: () => void) {
    return useCallback((view: EditorView, item: CommandItem) => {
        const { state } = view;
        const context = getSlashContext(state, state.selection.main.from);

        if (!context) return;

        view.dispatch({
            changes: {
                from: context.absoluteSlashPos,
                to: state.selection.main.from,
                insert: item.insertText
            },
            selection: {
                anchor: context.absoluteSlashPos + item.cursorOffset
            }
        });

        closeMenu();
        view.focus();
    }, [closeMenu]);
}

// ===== MAIN HOOK =====

export function useSlashCommand() {
    const menuState = useMenuState();
    const performCommandInternal = useCommandExecution(menuState.closeMenu);

    const filteredCommands = useMemo(() => {
        return COMMANDS.filter(cmd =>
            cmd.label.toLowerCase().includes(menuState.query.toLowerCase()) ||
            cmd.value.includes(menuState.query.toLowerCase())
        );
    }, [menuState.query]);

    const latestCommandsRef = useRef(filteredCommands);
    useEffect(() => {
        latestCommandsRef.current = filteredCommands;
    }, [filteredCommands]);

    const executeSelected = useCallback((view: EditorView) => {
        const cmds = latestCommandsRef.current;
        if (!cmds?.length) return false;

        const selectedCommand = cmds[menuState.selectedIndexRef.current];
        if (selectedCommand) {
            performCommandInternal(view, selectedCommand);
            return true;
        }
        return false;
    }, [performCommandInternal, menuState.selectedIndexRef]);

    const moveSelection = useCallback((dir: 'up' | 'down') => {
        const cmds = latestCommandsRef.current;
        const maxIndex = Math.max(0, (cmds?.length ?? 0) - 1);
        menuState.moveSelection(dir, maxIndex);
        return true;
    }, [menuState.moveSelection]);

    const keymapExtension = useKeyboardHandling(
        menuState.isOpenRef,
        menuState.closeMenu,
        moveSelection,
        executeSelected
    );

    const slashTriggerExtension = useSlashTrigger(
        menuState.isOpenRef,
        menuState.openMenu
    );

    const updateListener = useDocumentTracking(
        menuState.isOpen,
        menuState.updateQuery,
        menuState.closeMenu
    );

    const slashExtension = useMemo(
        () => [updateListener, keymapExtension, slashTriggerExtension],
        [updateListener, keymapExtension, slashTriggerExtension]
    );

    useEffect(() => {
        const maxIndex = Math.max(0, filteredCommands.length - 1);
        if (menuState.selectedIndex > maxIndex) {
            menuState.setSelectedIndex(maxIndex);
        }
    }, [filteredCommands.length, menuState.selectedIndex, menuState.setSelectedIndex]);

    return {
        slashExtension,
        slashProps: {
            isOpen: menuState.isOpen,
            position: menuState.position,
            selectedIndex: menuState.selectedIndex,
            query: menuState.query,
            filteredCommands,
            performCommand: performCommandInternal,
            closeMenu: menuState.closeMenu,
            setSelectedIndex: menuState.setSelectedIndex
        }
    };
}