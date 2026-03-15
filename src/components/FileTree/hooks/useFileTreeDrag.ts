import { useCallback, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { TreeNode } from '../../../types.ts';
import { DropPosition } from '../FileNode.tsx';
import { getParentPath } from '../../../utils/pathUtils.ts';
import { useSelectionStore, useVaultStore } from "../../../stores";

export type DragOverState = {
    path: string | null;
    position: DropPosition | null;
};

type DragHandlers = {
    move: (e: MouseEvent) => void;
    up: () => void;
};

type DragState = {
    dragPaths: string[];
    startX: number;
    startY: number;
    active: boolean;
    shouldSelect: boolean;
    handlers?: DragHandlers;
};

function normalizePath(path: string): string {
    return path.replace(/\\/g, '/');
}

function buildNodeMap(data: TreeNode[]): Map<string, TreeNode> {
    const map = new Map<string, TreeNode>();
    const walk = (nodes: TreeNode[]) => {
        nodes.forEach((node) => {
            map.set(node.id, node);
            if (node.children?.length) {
                walk(node.children);
            }
        });
    };
    walk(data);
    return map;
}

function shouldActivateDrag(state: DragState, event: MouseEvent): boolean {
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    return Math.hypot(dx, dy) >= 4;
}

function setDraggingUi(active: boolean) {
    document.body.style.userSelect = active ? 'none' : '';
    document.body.style.cursor = active ? 'grabbing' : '';
}

function getTreeItemFromPoint(event: MouseEvent): HTMLElement | null {
    const target = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
    return target?.closest('[role="treeitem"]') as HTMLElement | null;
}

function getDropTarget(
    item: HTMLElement,
    nodeMap: Map<string, TreeNode>,
    clientY: number,
): { path: string; position: DropPosition } | null {
    const path = item.dataset.path || null;
    if (!path) return null;

    const rect = item.getBoundingClientRect();
    const offsetY = clientY - rect.top;
    const height = rect.height || 1;
    const hoverNode = nodeMap.get(path);
    const isDir = hoverNode?.is_dir ?? false;

    let position: DropPosition = null;
    if (isDir) {
        if (offsetY < height * 0.25) {
            position = 'before';
        } else if (offsetY > height * 0.75) {
            position = 'after';
        } else {
            position = 'inside';
        }
    } else {
        position = offsetY < height / 2 ? 'before' : 'after';
    }

    return { path, position };
}

function resolveDestDir(
    path: string,
    position: DropPosition,
    nodeMap: Map<string, TreeNode>,
): string | null {
    const targetNode = nodeMap.get(path);
    const destDir = (position === 'inside' && targetNode?.is_dir)
        ? targetNode.id
        : getParentPath(path);

    return destDir || null;
}

function isInvalidMove(dragPaths: string[], destDir: string): boolean {
    const normalizedDest = normalizePath(destDir);
    return dragPaths.some((dragPath) => {
        const normalized = normalizePath(dragPath);
        return normalizedDest === normalized || normalizedDest.startsWith(`${normalized}/`);
    });
}

function getMoveCandidates(dragPaths: string[], destDir: string): string[] {
    const normalizedDest = normalizePath(destDir);
    return dragPaths.filter((dragPath) => {
        const currentParent = normalizePath(getParentPath(dragPath));
        return currentParent !== normalizedDest;
    });
}

export function useFileTreeDrag(data: TreeNode[]) {
    const { vaultPath } = useVaultStore();
    const { selectedFilePaths, selectOnly } = useSelectionStore();
    const [dragOver, setDragOver] = useState<DragOverState>({ path: null, position: null });
    const dragOverRef = useRef<DragOverState>({ path: null, position: null });
    const dragStateRef = useRef<DragState | null>(null);

    const nodeMap = useMemo(() => buildNodeMap(data), [data]);

    const updateDragOver = useCallback((path: string | null, position: DropPosition | null) => {
        dragOverRef.current = { path, position };
        setDragOver({ path, position });
    }, []);

    const cleanupDrag = useCallback(() => {
        const handlers = dragStateRef.current?.handlers;
        if (handlers) {
            window.removeEventListener('mousemove', handlers.move);
            window.removeEventListener('mouseup', handlers.up);
            window.removeEventListener('blur', handlers.up);
        }
        dragStateRef.current = null;
        updateDragOver(null, null);
        setDraggingUi(false);
    }, [updateDragOver]);

    const onDragStartIntent = useCallback((e: React.MouseEvent, node: TreeNode, isSelected: boolean) => {
        if (e.button !== 0) return;
        if (e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;

        const dragPaths = isSelected ? selectedFilePaths : [node.id];
        const shouldSelect = !isSelected;

        dragStateRef.current = {
            dragPaths,
            startX: e.clientX,
            startY: e.clientY,
            active: false,
            shouldSelect,
        };

        const handleMove = (event: MouseEvent) => {
            const dragState = dragStateRef.current;
            if (!dragState) return;

            if (!dragState.active && !shouldActivateDrag(dragState, event)) {
                return;
            }

            if (!dragState.active) {
                dragState.active = true;
                if (dragState.shouldSelect) {
                    selectOnly(node.id);
                }
                setDraggingUi(true);
            }

            const item = getTreeItemFromPoint(event);
            if (!item) {
                updateDragOver(null, null);
                return;
            }

            const dropTarget = getDropTarget(item, nodeMap, event.clientY);
            if (!dropTarget) {
                updateDragOver(null, null);
                return;
            }

            updateDragOver(dropTarget.path, dropTarget.position);
        };

        const handleUp = async () => {
            const dragState = dragStateRef.current;
            const { path, position } = dragOverRef.current;
            cleanupDrag();

            if (!dragState || !dragState.active || !vaultPath || !path || !position) {
                return;
            }

            const destDir = resolveDestDir(path, position, nodeMap);
            if (!destDir) return;

            if (isInvalidMove(dragState.dragPaths, destDir)) {
                toast.error("Cannot move a folder into itself.");
                return;
            }

            const moveCandidates = getMoveCandidates(dragState.dragPaths, destDir);
            if (moveCandidates.length === 0) {
                toast.info("Items already in target folder");
                return;
            }

            try {
                await invoke('move_items', { vaultPath, itemPaths: moveCandidates, destDir });
                toast.success("Moved successfully");
            } catch (err: unknown) {
                console.error(err);
                toast.error(typeof err === 'string' ? err : "Failed to move items");
            }
        };

        if (dragStateRef.current) {
            dragStateRef.current.handlers = { move: handleMove, up: handleUp };
        }
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        window.addEventListener('blur', handleUp);
    }, [cleanupDrag, nodeMap, selectOnly, selectedFilePaths, updateDragOver, vaultPath]);

    return { dragOver, onDragStartIntent };
}
