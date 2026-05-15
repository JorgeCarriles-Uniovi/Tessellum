import type { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

export interface SlashContext {
    queryText: string;
    absoluteSlashPos: number;
}

export interface MenuCoords {
    left: number;
    top: number;
    placement: "bottom" | "top";
}

export function getSlashContext(state: EditorState, cursorPos: number): SlashContext | null {
    const line = state.doc.lineAt(cursorPos);
    const lineOffset = cursorPos - line.from;
    const slashPos = line.text.lastIndexOf("/", lineOffset);

    if (slashPos === -1) {
        return null;
    }

    const queryText = line.text.slice(slashPos + 1, lineOffset);
    const hasSpace = queryText.includes(" ");
    const cursorAfterSlash = lineOffset >= slashPos;

    if (hasSpace || !cursorAfterSlash) {
        return null;
    }

    return {
        queryText,
        absoluteSlashPos: line.from + slashPos,
    };
}

export function canTriggerSlash(state: EditorState, cursorPos: number): boolean {
    if (cursorPos === 0) {
        return true;
    }

    const charBefore = state.doc.sliceString(cursorPos - 1, cursorPos);
    return charBefore === " " || charBefore === "\n";
}

export function getSafeCursorCoords(view: EditorView, cursorPos: number) {
    const boundedPos = Math.max(0, Math.min(cursorPos, view.state.doc.length));
    try {
        return view.coordsAtPos(boundedPos);
    } catch (error) {
        console.warn("[editor-slash] coordsAtPos failed", {
            cursorPos,
            boundedPos,
            docLength: view.state.doc.length,
            error,
        });
        return null;
    }
}
