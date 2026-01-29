import {
    useState,
    useCallback,
    useMemo,
    useRef,
    useEffect,
    RefObject
} from 'react';
import { EditorView, keymap } from '@codemirror/view';
import { CommandItem } from '../../types';
import { Prec } from "@codemirror/state";
import {COMMANDS} from "../../constants/commands.tsx";

// ===== PURE UTILITIES (no React dependencies) =====

function getSlashContext(state: any, cursorPos: number) {
    const line = state.doc.lineAt(cursorPos);
    const lineOffset = cursorPos - line.from;
    const slashPos = line.text.lastIndexOf('/', lineOffset);

    if (slashPos === -1) return null;

    const queryText = line.text.slice(slashPos + 1, lineOffset);
    const hasSpace = queryText.includes(' ');
    const cursorAfterSlash = lineOffset >= slashPos;

    return (Boolean(hasSpace)) || !cursorAfterSlash ? null : {
        queryText: queryText,
        absoluteSlashPos: line.from + slashPos
    };
}

function canTriggerSlash(state: unknown, cursorPos: number) {
    if (cursorPos === 0) return true;
    const charBefore = state.doc.sliceString(cursorPos - 1, cursorPos);
    return charBefore === ' ' || charBefore === '\n';
}

function useSlashTrigger(isOpenRef: RefObject<boolean>, openMenu: (coords: any) => void) {
    return useMemo(() => EditorView.domEventHandlers({
        keydown: (event, view) => {
            if (event.key === '/' && !(isOpenRef.current ?? false)) {
                const { state } = view;
                const cursorPos = state.selection.main.from;
                if (state.selection.main.empty && canTriggerSlash(state, cursorPos)) {
                    const coords = view.coordsAtPos(cursorPos);
                    if (coords) openMenu(coords);
                    // Do NOT prevent default. We want the "/" to be typed.
                }
            }
            return false;
        }
    }), [openMenu, isOpenRef]);
}

// ===== MENU STATE HOOK =====

function useMenuState() {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);

    const isOpenRef = useRef(false);
    const selectedIndexRef = useRef(0);

    // Keep ref in sync
    useEffect(() => {
        selectedIndexRef.current = selectedIndex;
    }, [selectedIndex]);

    const openMenu = useCallback((coords: { left: number; top: number }) => {
        setIsOpen(true);
        isOpenRef.current = true;
        setPosition({ x: coords.left, y: coords.top });
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
    // We use Prec.highest to ensure this runs BEFORE the editor moves the cursor
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

export function useSlashCommand(
) {
    const menuState = useMenuState();
    const performCommandInternal = useCommandExecution(menuState.closeMenu);

    // 1. Calculate filtered commands internally
    const filteredCommands = useMemo(() => {
        return COMMANDS.filter(cmd =>
            cmd.label.toLowerCase().includes(menuState.query.toLowerCase()) ||
            cmd.value.includes(menuState.query.toLowerCase())
        );
    }, [menuState.query]);

    // 1. Ref holding the latest filteredCommands for use in keyboard handlers without stale closures
    const latestCommandsRef = useRef(filteredCommands);
    useEffect(() => {
        latestCommandsRef.current = filteredCommands;
    }, [filteredCommands]);

    // 2. Stable Callbacks
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

    // 3. Assemble Extensions
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

    // 4. Clamping Effect
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
            closeMenu: menuState.closeMenu
        }
    };
}