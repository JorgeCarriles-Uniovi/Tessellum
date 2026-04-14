import type { EditorView } from "@codemirror/view";

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

type ShortcutKeyEvent = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">;

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
