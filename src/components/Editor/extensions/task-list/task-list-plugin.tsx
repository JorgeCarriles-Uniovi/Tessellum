import { StateField, type Extension } from "@codemirror/state";
import { EditorView, type DecorationSet, WidgetType } from "@codemirror/view";
import { createRoot, type Root } from "react-dom/client";
import { buildPreviewDecorations } from "../shared-preview-plugin";
import { markdownPreviewForceHideFacet } from "../markdown-preview-plugin";
import {
    findTaskListItems,
    getToggledTaskMarker,
    type TaskListItem,
} from "./task-list-parser";
import { TaskListCheckbox } from "./task-list-checkbox";

interface TaskListPreviewRange extends TaskListItem {
    start: number;
    end: number;
    block: false;
}

function getTaskListRanges(docText: string): TaskListPreviewRange[] {
    return findTaskListItems(docText).map((item) => ({
        ...item,
        start: item.markerStart,
        end: item.markerEnd,
        block: false,
    }));
}

function isTaskLineFocused(state: EditorView["state"], range: TaskListPreviewRange): boolean {
    const selection = state.selection.main;
    return selection.from <= range.lineEnd && selection.to >= range.lineStart;
}

function toggleTaskItem(view: EditorView, range: TaskListPreviewRange): void {
    view.dispatch({
        changes: {
            from: range.markerStart,
            to: range.markerEnd,
            insert: getToggledTaskMarker(range.marker, range.checked),
        },
    });
    view.focus();
}

function buildTaskListDecorations(state: EditorView["state"]): DecorationSet {
    return buildPreviewDecorations(state, getTaskListRanges(state.doc.toString()), {
        createWidget: (range) => new TaskListCheckboxWidget(range),
        isFocused: isTaskLineFocused,
    });
}

class TaskListCheckboxWidget extends WidgetType {
    private root: Root | null = null;
    private dom: HTMLElement | null = null;

    constructor(private readonly range: TaskListPreviewRange) {
        super();
    }

    eq(other: TaskListCheckboxWidget): boolean {
        return (
            this.range.markerStart === other.range.markerStart &&
            this.range.markerEnd === other.range.markerEnd &&
            this.range.checked === other.range.checked &&
            this.range.marker === other.range.marker
        );
    }

    toDOM(view: EditorView): HTMLElement {
        this.dom = document.createElement("span");
        this.dom.className = "cm-task-list-checkbox";
        this.root = createRoot(this.dom);
        this.render(view);
        return this.dom;
    }

    updateDOM(dom: HTMLElement, view: EditorView): boolean {
        if (this.root && dom === this.dom) {
            this.render(view);
            return true;
        }

        return false;
    }

    destroy(): void {
        if (this.root) {
            this.root.unmount();
            this.root = null;
            this.dom = null;
        }
    }

    ignoreEvent(): boolean {
        return true;
    }

    private render(view: EditorView): void {
        this.root?.render(
            <TaskListCheckbox
                checked={this.range.checked}
                onToggle={() => toggleTaskItem(view, this.range)}
            />
        );
    }
}

type TaskListDecorationState = {
    decorations: DecorationSet;
    forceHide: boolean;
};

const taskListStateField = StateField.define<TaskListDecorationState>({
    create(state) {
        const forceHide = state.facet(markdownPreviewForceHideFacet);
        return {
            decorations: buildTaskListDecorations(state),
            forceHide,
        };
    },
    update(currentState, transaction) {
        const nextForceHide = transaction.state.facet(markdownPreviewForceHideFacet);

        if (transaction.docChanged || transaction.selection || nextForceHide !== currentState.forceHide) {
            return {
                decorations: buildTaskListDecorations(transaction.state),
                forceHide: nextForceHide,
            };
        }

        return currentState;
    },
    provide: (field) => EditorView.decorations.from(field, (value) => value.decorations),
});

export function createTaskListPlugin(): Extension {
    return [taskListStateField];
}
