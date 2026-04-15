import type { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { RefObject, useCallback, useEffect, useMemo, useState } from "react";

type SelectionToolbarState = {
    isOpen: boolean;
    x: number;
    y: number;
    placement: 'top' | 'bottom';
};

type UseSelectionToolbarOptions = {
    editorRef: RefObject<ReactCodeMirrorRef>;
    toolbarRef: RefObject<HTMLDivElement>;
    enabled: boolean;
};

const HIDDEN_TOOLBAR_STATE: SelectionToolbarState = {
    isOpen: false,
    x: 0,
    y: 0,
    placement: 'top',
};

const TOOLBAR_MIN_VIEWPORT_PADDING_PX = 12;
const TOOLBAR_VERTICAL_OFFSET_PX = 10;
const TOOLBAR_FALLBACK_WIDTH_PX = 164;

function getSelectionToolbarState({
                                      editorRef,
                                      toolbarRef,
                                      enabled,
                                  }: UseSelectionToolbarOptions): SelectionToolbarState {
    if (!enabled) {
        return HIDDEN_TOOLBAR_STATE;
    }

    const view = editorRef.current?.view;
    if (!view) {
        return HIDDEN_TOOLBAR_STATE;
    }

    const selection = view.state.selection.main;
    if (selection.empty) {
        return HIDDEN_TOOLBAR_STATE;
    }

    const selectionStart = view.coordsAtPos(selection.from);
    const selectionEnd = view.coordsAtPos(Math.max(selection.from, selection.to - 1));

    if (!selectionStart || !selectionEnd) {
        return HIDDEN_TOOLBAR_STATE;
    }

    const editorRect = view.dom.getBoundingClientRect();

    const toolbarWidth = toolbarRef.current?.offsetWidth ?? TOOLBAR_FALLBACK_WIDTH_PX;
    const selectionLeft = Math.min(selectionStart.left, selectionEnd.left);
    const selectionRight = Math.max(selectionStart.right, selectionEnd.right);
    const selectionMidpoint = (selectionLeft + selectionRight) / 2;
    const minX = editorRect.left + TOOLBAR_MIN_VIEWPORT_PADDING_PX + toolbarWidth / 2;
    const maxX = editorRect.right - TOOLBAR_MIN_VIEWPORT_PADDING_PX - toolbarWidth / 2;
    const viewportX = minX > maxX
        ? (editorRect.left + editorRect.right) / 2
        : Math.min(Math.max(selectionMidpoint, minX), maxX);

    const x = viewportX - editorRect.left;

    const spaceAbove = selectionStart.top;
    const TOOLBAR_APPROX_HEIGHT = 44;
    const placement: 'top' | 'bottom' = spaceAbove < (TOOLBAR_APPROX_HEIGHT + TOOLBAR_MIN_VIEWPORT_PADDING_PX + TOOLBAR_VERTICAL_OFFSET_PX)
        ? 'bottom'
        : 'top';

    const viewportY = placement === 'top'
        ? Math.max(TOOLBAR_MIN_VIEWPORT_PADDING_PX, selectionStart.top - TOOLBAR_VERTICAL_OFFSET_PX)
        : Math.min(window.innerHeight - TOOLBAR_MIN_VIEWPORT_PADDING_PX, selectionEnd.bottom + TOOLBAR_VERTICAL_OFFSET_PX);

    const y = viewportY - editorRect.top;

    return {
        isOpen: true,
        x,
        y,
        placement,
    };
}

/**
 * Derives floating toolbar visibility from the active CodeMirror selection.
 * The hook stays defensive and hides the toolbar whenever selection geometry
 * is incomplete, which prevents stale overlays from lingering on screen.
 */
export function useSelectionToolbar({ editorRef, toolbarRef, enabled }: UseSelectionToolbarOptions) {
    const [state, setState] = useState<SelectionToolbarState>(HIDDEN_TOOLBAR_STATE);

    const updateToolbar = useCallback(() => {
        const nextState = getSelectionToolbarState({ editorRef, toolbarRef, enabled });
        setState((prevState) => {
            if (
                prevState.isOpen === nextState.isOpen &&
                prevState.x === nextState.x &&
                prevState.y === nextState.y &&
                prevState.placement === nextState.placement
            ) {
                return prevState;
            }
            return nextState;
        });
    }, [editorRef, toolbarRef, enabled]);

    const view = editorRef.current?.view;
    const updateEvents = useMemo(
        () => ["selectionchange", "resize", "scroll"] as const,
        []
    );

    useEffect(() => {
        updateToolbar();
    }, [updateToolbar, view, enabled]);

    useEffect(() => {
        if (!enabled) {
            setState((prevState) => {
                if (!prevState.isOpen) return prevState;
                return HIDDEN_TOOLBAR_STATE;
            });
            return;
        }

        const handleSelectionChange = () => updateToolbar();
        const handleViewportChange = () => updateToolbar();

        document.addEventListener(updateEvents[0], handleSelectionChange);
        window.addEventListener(updateEvents[1], handleViewportChange);
        window.addEventListener(updateEvents[2], handleViewportChange, true);

        return () => {
            document.removeEventListener(updateEvents[0], handleSelectionChange);
            window.removeEventListener(updateEvents[1], handleViewportChange);
            window.removeEventListener(updateEvents[2], handleViewportChange, true);
        };
    }, [enabled, updateEvents, updateToolbar]);

    return {
        ...state,
        refresh: updateToolbar,
    };
}
