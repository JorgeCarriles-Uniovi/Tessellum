import React, { useCallback, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { FileMetadata, TreeNode } from '../../types.ts';
import { FileNode, DropPosition } from './FileNode.tsx';
import { getParentPath } from '../../utils/pathUtils.ts';
import { useEditorStore } from '../../stores/editorStore.ts';

interface FileTreeProps {
    data: TreeNode[];
    onContextMenu: (e: React.MouseEvent, file: FileMetadata) => void;
}

type DragOverState = {
    path: string | null;
    position: DropPosition | null;
};

type DragHandlers = {
    move: (e: MouseEvent) => void;
    up: () => void;
};

function normalizePath(path: string): string {
    return path.replace(/\\/g, '/');
}

export function FileTree({ data, onContextMenu }: FileTreeProps) {
    const { vaultPath, selectedFilePaths, selectOnly } = useEditorStore();
    const [dragOver, setDragOver] = useState<DragOverState>({ path: null, position: null });
    const dragOverRef = useRef<DragOverState>({ path: null, position: null });
    const dragStateRef = useRef<{
        dragPaths: string[];
        startX: number;
        startY: number;
        active: boolean;
        handlers?: DragHandlers;
    } | null>(null);

    const nodeMap = useMemo(() => {
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
    }, [data]);

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
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
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

            const dx = event.clientX - dragState.startX;
            const dy = event.clientY - dragState.startY;
            if (!dragState.active && Math.hypot(dx, dy) < 4) {
                return;
            }

            if (!dragState.active) {
                dragState.active = true;
                if (dragState.shouldSelect) {
                    selectOnly(node.id);
                }
                document.body.style.userSelect = 'none';
                document.body.style.cursor = 'grabbing';
            }

            const target = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
            const item = target?.closest('[role="treeitem"]') as HTMLElement | null;
            if (!item) {
                updateDragOver(null, null);
                return;
            }

            const path = item.dataset.path || null;
            if (!path) {
                updateDragOver(null, null);
                return;
            }

            const rect = item.getBoundingClientRect();
            const offsetY = event.clientY - rect.top;
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

            updateDragOver(path, position);
        };

        const handleUp = async () => {
            const dragState = dragStateRef.current;
            const { path, position } = dragOverRef.current;
            cleanupDrag();

            if (!dragState || !dragState.active || !vaultPath || !path || !position) {
                return;
            }

            const targetNode = nodeMap.get(path);
            const destDir = (position === 'inside' && targetNode?.is_dir)
                ? targetNode.id
                : getParentPath(path);

            if (!destDir) return;

            const normalizedDest = normalizePath(destDir);
            const hasInvalid = dragState.dragPaths.some((dragPath) => {
                const normalized = normalizePath(dragPath);
                return normalizedDest === normalized || normalizedDest.startsWith(`${normalized}/`);
            });

            if (hasInvalid) {
                toast.error("Cannot move a folder into itself.");
                return;
            }

            const moveCandidates = dragState.dragPaths.filter((dragPath) => {
                const currentParent = normalizePath(getParentPath(dragPath));
                return currentParent !== normalizedDest;
            });

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

        dragStateRef.current.handlers = { move: handleMove, up: handleUp };
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        window.addEventListener('blur', handleUp);
    }, [cleanupDrag, nodeMap, selectOnly, selectedFilePaths, updateDragOver, vaultPath]);

    return (
        <div className="w-full pb-4" role="tree" aria-multiselectable="true">
            {data.map(node => (
                <FileNode
                    key={node.id}
                    node={node}
                    level={0}
                    onContextMenu={onContextMenu}
                    onDragStartIntent={onDragStartIntent}
                    dragOverPath={dragOver.path}
                    dragOverPosition={dragOver.position}
                />
            ))}
        </div>
    );
}

