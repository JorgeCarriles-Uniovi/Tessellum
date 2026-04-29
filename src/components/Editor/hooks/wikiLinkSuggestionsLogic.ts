import type { EditorView } from "@codemirror/view";

export interface WikiLinkContext {
    queryText: string;
    aliasText: string;
    hasAlias: boolean;
    bracketPos: number;
}

export function getSafeWikiLinkCursorCoords(view: EditorView, cursorPos: number) {
    const boundedPos = Math.max(0, Math.min(cursorPos, view.state.doc.length));
    try {
        return view.coordsAtPos(boundedPos);
    } catch (error) {
        console.warn("[editor-wikilink] coordsAtPos failed", {
            cursorPos,
            boundedPos,
            docLength: view.state.doc.length,
            error,
        });
        return null;
    }
}

/**
 * Extract wikilink context from the current cursor position.
 * Handles both [[query and [[target|alias while ignoring escaped openers.
 */
export function getWikiLinkContext(
    state: { doc: { lineAt: (pos: number) => { from: number; text: string } }; selection: { main: { from: number } } },
    cursorPos: number,
): WikiLinkContext | null {
    const line = state.doc.lineAt(cursorPos);
    const lineOffset = cursorPos - line.from;
    const lineText = line.text.slice(0, lineOffset);

    const bracketIndex = lineText.lastIndexOf("[[");
    if (bracketIndex === -1) {
        return null;
    }

    if (bracketIndex > 0 && lineText[bracketIndex - 1] === "\\") {
        return null;
    }

    const afterBrackets = lineText.slice(bracketIndex + 2);
    if (afterBrackets.includes("]]")) {
        return null;
    }

    const pipeIndex = afterBrackets.indexOf("|");
    if (pipeIndex !== -1) {
        return {
            queryText: afterBrackets.slice(0, pipeIndex),
            aliasText: afterBrackets.slice(pipeIndex + 1),
            hasAlias: true,
            bracketPos: line.from + bracketIndex,
        };
    }

    return {
        queryText: afterBrackets,
        aliasText: "",
        hasAlias: false,
        bracketPos: line.from + bracketIndex,
    };
}
