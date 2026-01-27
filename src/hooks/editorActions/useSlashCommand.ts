import { useState, useCallback, useMemo } from 'react';
import { EditorView } from '@codemirror/view';
import { CommandItem } from '../../types';

export function useSlashCommand() {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);

    // This Extension handles key events inside the editor
    const slashExtension = useMemo(() => EditorView.domEventHandlers({
        keydown: (event, view) => {
            if (!isOpen) {
                // Trigger logic: "/" key
                if (event.key === '/') {
                    const { state } = view;
                    const range = state.selection.main;
                    // Check if at start of line OR preceded by space
                    const charBefore = state.doc.sliceString(range.from - 1, range.from);

                    if (range.empty && (range.from === 0 || charBefore === ' ' || charBefore === '\n')) {
                        const coords = view.coordsAtPos(range.from);
                        if (coords) {
                            setIsOpen(true);
                            setPosition({ x: coords.left, y: coords.top });
                            setQuery("");
                            setSelectedIndex(0);
                            // We do NOT preventDefault here, we want the '/' to appear
                        }
                    }
                }
                return;
            }

            // --- Menu is OPEN navigation logic ---

            if (event.key === 'Escape') {
                setIsOpen(false);
                event.preventDefault();
                return;
            }

            if (event.key === 'ArrowUp') {
                setSelectedIndex(prev => Math.max(0, prev - 1));
                event.preventDefault();
                return;
            }

            if (event.key === 'ArrowDown') {
                // Note: ideally you pass the filtered list length here to clamp
                setSelectedIndex(prev => prev + 1);
                event.preventDefault();
                return;
            }

            if (event.key === 'Enter') {
                event.preventDefault();
                // We handle execution in the component via 'onSelect' usually,
                // but strictly speaking, keydown needs to fire an event or we need access to the data here.
                // For simplicity, we can let the UI render handle the click, or emit a custom event.

                // Better approach: Trigger a custom callback prop if we moved this logic into the component
                return;
            }
        },

        // Listen to input to update the query string (e.g. "/h1")
        input: (event, view) => {
            if (isOpen) {
                // Find where the '/' command started.
                // This is a naive implementation; for production, track the 'start position' in state.
                const range = view.state.selection.main;
                const line = view.state.doc.lineAt(range.from);
                const lineText = line.text;

                // Look backward from cursor for the last '/'
                const lastSlash = lineText.lastIndexOf('/', range.from - line.from);
                if (lastSlash !== -1) {
                    const typedText = lineText.slice(lastSlash + 1, range.from - line.from);
                    // If user typed space, close menu
                    if (typedText.includes(' ')) {
                        setIsOpen(false);
                    } else {
                        setQuery(typedText);
                    }
                } else {
                    setIsOpen(false); // Slash was deleted
                }
            }
        }
    }), [isOpen]);

    // The Action: What happens when user selects an item
    const performCommand = useCallback((view: EditorView, item: CommandItem) => {
        const range = view.state.selection.main;
        const line = view.state.doc.lineAt(range.from);

        // Calculate start of the command (where the '/' is)
        const lineText = line.text;
        const slashPos = lineText.lastIndexOf('/', range.from - line.from);
        const absoluteSlashPos = line.from + slashPos;

        view.dispatch({
            changes: {
                from: absoluteSlashPos, // Start replacing at '/'
                to: range.from,         // End replacing at cursor
                insert: item.insertText
            },
            selection: {
                // Move cursor to specific offset (e.g. inside brackets)
                anchor: absoluteSlashPos + item.cursorOffset
            }
        });

        setIsOpen(false);
        view.focus();
    }, []);

    return {
        slashExtension,
        slashProps: {
            isOpen,
            position,
            selectedIndex,
            query,
            performCommand,
            closeMenu: () => setIsOpen(false)
        }
    };
}