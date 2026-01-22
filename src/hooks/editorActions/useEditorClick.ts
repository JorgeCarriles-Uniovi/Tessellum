import React, { useCallback, RefObject } from 'react';
import { ReactCodeMirrorRef } from '@uiw/react-codemirror';

export function useEditorClick(editorRef: RefObject<ReactCodeMirrorRef>) {
    return useCallback((e: React.MouseEvent) => {
        const target = e.target as HTMLElement;

        // 1. Ignore interactions with clickable UI elements
        if (target.tagName === 'A' || target.tagName === 'BUTTON') return;

        // 2. Prevent default browser blur (Critical step)
        e.preventDefault();

        const view = editorRef.current?.view;
        if (!view) return;

        // 3. Calculate Text Position
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

        // 4. Force Focus
        view.focus();
    }, [editorRef]);
}