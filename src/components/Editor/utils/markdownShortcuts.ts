import type { EditorView } from "@codemirror/view";

export type MarkdownAction = "bold" | "italic" | "strikethrough";
export type ListType = "bulleted" | "numbered" | "todo";

export type InlineMarkdownAction = {
    id: MarkdownAction;
    label: string;
};

export type TextSelectionRange = {
    from: number;
    to: number;
};

export type TextSelectionResult = {
    text: string;
    selection: {
        anchor: number;
        head: number;
    };
};

const MARKDOWN_MARKERS: Record<MarkdownAction, string> = {
    bold: "**",
    italic: "*",
    strikethrough: "~~",
};

const INLINE_MARKDOWN_ACTIONS: InlineMarkdownAction[] = [
    { id: "bold", label: "Bold" },
    { id: "italic", label: "Italic" },
    { id: "strikethrough", label: "Strike" },
];

type ShortcutKeyEvent = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">;

export function getMarkdownMarker(action: MarkdownAction): string {
    return MARKDOWN_MARKERS[action];
}

export function getInlineMarkdownActions(): InlineMarkdownAction[] {
    return INLINE_MARKDOWN_ACTIONS;
}

export function toggleMarkdownWrap(
    text: string,
    selection: TextSelectionRange,
    marker: string
): TextSelectionResult {
    const { from, to } = selection;
    const selectedText = text.slice(from, to);
    const prefix = text.slice(Math.max(0, from - marker.length), from);
    const suffix = text.slice(to, to + marker.length);

    if (from !== to && prefix === marker && suffix === marker) {
        return {
            text: `${text.slice(0, from - marker.length)}${selectedText}${text.slice(to + marker.length)}`,
            selection: {
                anchor: from - marker.length,
                head: to - marker.length,
            },
        };
    }

    if (from === to) {
        const wrapped = `${marker}${marker}`;
        return {
            text: `${text.slice(0, from)}${wrapped}${text.slice(to)}`,
            selection: {
                anchor: from + marker.length,
                head: from + marker.length,
            },
        };
    }

    return {
        text: `${text.slice(0, from)}${marker}${selectedText}${marker}${text.slice(to)}`,
        selection: {
            anchor: from + marker.length,
            head: to + marker.length,
        },
    };
}

export function matchesTabNavigationShortcut(event: ShortcutKeyEvent, direction: "next" | "previous"): boolean {
    if (event.altKey || event.key !== "Tab") {
        return false;
    }

    const usesPrimaryModifier = event.ctrlKey || event.metaKey;
    if (!usesPrimaryModifier) {
        return false;
    }

    return direction === "previous" ? event.shiftKey : !event.shiftKey;
}

export function matchesMarkdownShortcut(event: ShortcutKeyEvent, action: "bold" | "italic"): boolean {
    if (event.altKey || event.shiftKey) {
        return false;
    }

    const usesPrimaryModifier = event.ctrlKey || event.metaKey;
    if (!usesPrimaryModifier) {
        return false;
    }

    const normalizedKey = event.key.toLowerCase();
    return action === "bold" ? normalizedKey === "b" : normalizedKey === "i";
}

export function applyMarkdownShortcut(view: EditorView | null | undefined, marker: string): boolean {
    if (!view) {
        return false;
    }

    const selection = view.state.selection.main;
    const result = toggleMarkdownWrap(
        view.state.doc.toString(),
        { from: selection.from, to: selection.to },
        marker
    );

    view.dispatch({
        changes: {
            from: 0,
            to: view.state.doc.length,
            insert: result.text,
        },
        selection: {
            anchor: result.selection.anchor,
            head: result.selection.head,
        },
    });

    return true;
}

export function applyListFormatting(view: EditorView | null | undefined, listType: ListType): boolean {
    if (!view) {
        return false;
    }

    const { state } = view;
    const selection = state.selection.main;
    const fromLine = state.doc.lineAt(selection.from);
    const toLine = state.doc.lineAt(selection.to);

    const changes = [];
    let allHavePrefix = true;

    const getPrefixRegex = (type: ListType) => {
        if (type === "bulleted") return /^[-*]\s/;
        if (type === "numbered") return /^\d+\.\s/;
        if (type === "todo") return /^- \[(?: |x)\]\s/i;
        return /^$/;
    };
    const anyListRegex = /^(- \[(?: |x)\]\s|\d+\.\s|[-*]\s)/i;
    const targetRegex = getPrefixRegex(listType);

    for (let i = fromLine.number; i <= toLine.number; i++) {
        const line = state.doc.line(i);
        if (!targetRegex.test(line.text) && line.text.trim().length > 0) {
            allHavePrefix = false;
            break;
        }
    }

    let itemNumber = 1;
    for (let i = fromLine.number; i <= toLine.number; i++) {
        const line = state.doc.line(i);
        if (line.text.trim().length === 0 && fromLine.number !== toLine.number) continue;

        const match = line.text.match(anyListRegex);
        const currentPrefix = match ? match[0] : "";
        const replaceFrom = line.from;
        const replaceTo = line.from + currentPrefix.length;

        if (allHavePrefix) {
            changes.push({ from: replaceFrom, to: replaceTo, insert: "" });
        } else {
            let newPrefix = "";
            if (listType === "bulleted") {
                newPrefix = "- ";
            } else if (listType === "numbered") {
                newPrefix = `${itemNumber}. `;
                itemNumber++;
            } else if (listType === "todo") {
                newPrefix = "- [ ] ";
            }
            changes.push({ from: replaceFrom, to: replaceTo, insert: newPrefix });
        }
    }

    view.dispatch({ changes });
    return true;
}
