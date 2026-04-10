export interface TaskListItem {
    markerStart: number;
    markerEnd: number;
    lineStart: number;
    lineEnd: number;
    marker: string;
    checked: boolean;
    lineText: string;
}

const TASK_LIST_MARKER_RE = /^(\s*)(-\s\[(?: |x|X)?\])(?=\s|$)/;

function isCheckedMarker(marker: string): boolean {
    return /\[[xX]\]/.test(marker);
}

/**
 * Finds markdown task list markers on unordered list lines.
 * The marker range excludes indentation so the list layout stays intact.
 */
export function findTaskListItems(docText: string): TaskListItem[] {
    const items: TaskListItem[] = [];
    const normalizedText = docText.replace(/\r\n/g, "\n");
    const lines = normalizedText.split("\n");
    let offset = 0;

    for (const lineText of lines) {
        const match = TASK_LIST_MARKER_RE.exec(lineText);

        if (match) {
            const indent = match[1] ?? "";
            const marker = match[2];
            const markerStart = offset + indent.length;

            items.push({
                markerStart,
                markerEnd: markerStart + marker.length,
                lineStart: offset,
                lineEnd: offset + lineText.length,
                marker,
                checked: isCheckedMarker(marker),
                lineText,
            });
        }

        offset += lineText.length + 1;
    }

    return items;
}

/**
 * Normalizes task toggles to the requested compact unchecked form.
 */
export function getToggledTaskMarker(_marker: string, checked: boolean): string {
    return checked ? "- [ ]" : "- [x]";
}
