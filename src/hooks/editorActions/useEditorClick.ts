import React, { useCallback, RefObject } from 'react';
import { ReactCodeMirrorRef } from '@uiw/react-codemirror';

export function useEditorClick(editorRef: RefObject<ReactCodeMirrorRef>) {
    return useCallback((e: React.MouseEvent) => {
        const target = e.target as HTMLElement;

        // 1. Ignore interactions with clickable UI elements
        if (target.tagName === 'A' || target.tagName === 'BUTTON') return;

        // 2. Check if clicked on a rendered LaTeX element
        const latexElement = target.closest('.latex, .latex-inline');
        if (latexElement) {
            e.preventDefault();
            const view = editorRef.current?.view;
            if (!view) return;

            // Get the stored position from the data attribute
            const posAttr = latexElement.getAttribute('data-pos');
            if (!posAttr) {
                // Fallback to regular click handling if no position stored
                view.focus();
                return;
            }

            const pos = parseInt(posAttr, 10);

            // Find the line containing this position
            const line = view.state.doc.lineAt(pos);
            const lineText = line.text;

            // Search for LaTeX delimiters from the position
            // First, try to find block LaTeX ($$...$$)
            const blockRegex = /\$\$([\s\S]*?)\$\$/g;
            let match: RegExpExecArray | null;
            let matchStart = -1;
            let matchEnd = -1;
            let foundMatch = false;

            // Search in the current line and subsequent lines for block LaTeX
            let searchText = view.state.doc.sliceString(line.from, Math.min(line.to + 1000, view.state.doc.length));

            while ((match = blockRegex.exec(searchText)) !== null) {
                const absoluteStart = line.from + match.index;
                const absoluteEnd = absoluteStart + match[0].length;

                // Check if our position is within this match
                if (pos >= absoluteStart && pos < absoluteEnd) {
                    matchStart = absoluteStart;
                    matchEnd = absoluteEnd;
                    foundMatch = true;
                    break;
                }
            }

            // If no block match, try inline LaTeX ($...$)
            if (!foundMatch) {
                const inlineRegex = /\$([^\$\n]+?)\$/g;

                while ((match = inlineRegex.exec(lineText)) !== null) {
                    const absoluteStart = line.from + match.index;
                    const absoluteEnd = absoluteStart + match[0].length;

                    // Check if our position is within this match
                    if (pos >= absoluteStart && pos < absoluteEnd) {
                        matchStart = absoluteStart;
                        matchEnd = absoluteEnd;
                        foundMatch = true;
                        break;
                    }
                }
            }

            if (foundMatch && matchStart !== -1 && matchEnd !== -1) {
                // Select the entire LaTeX block (including delimiters)
                view.dispatch({
                    selection: { anchor: matchStart, head: matchEnd },
                    scrollIntoView: true
                });
            } else {
                // Fallback: just position cursor at the stored position
                view.dispatch({
                    selection: { anchor: pos, head: pos },
                    scrollIntoView: true
                });
            }

            view.focus();
            return;
        }

        // 3. Prevent default browser blur (Critical step)
        e.preventDefault();

        const view = editorRef.current?.view;
        if (!view) return;

        // 4. Calculate Text Position
        // posAtCoords returns the character index closest to the mouse (X, Y)
        const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });

        if (pos !== null) {
            // Case A: Clicked directly on or near a line
            // CodeMirror handles the "click past end of line" logic automatically here
            view.dispatch({ selection: { anchor: pos, head: pos } });
        } else {
            // Case B: Clicked in the margins or way below the text
            // We use the horizontal center of the editor to find the correct "vertical line"
            const rect = view.dom.getBoundingClientRect();
            const centerX = rect.left + (rect.width / 2);
            const loosePos = view.posAtCoords({ x: centerX, y: e.clientY });

            if (loosePos !== null) {
                // We found a line at this Y-level. Snap to the END of it.
                const line = view.state.doc.lineAt(loosePos);
                view.dispatch({ selection: { anchor: line.to, head: line.to } });
            } else {
                // Case C: Clicked way below everything (bottom padding). Go to end of doc.
                const length = view.state.doc.length;
                view.dispatch({ selection: { anchor: length, head: length } });
            }
        }

        // 5. Force Focus
        view.focus();
    }, [editorRef]);
}