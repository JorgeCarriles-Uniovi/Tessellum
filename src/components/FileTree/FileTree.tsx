import React from "react";
import { FileMetadata, TreeNode } from '../../types.ts';
import { FileNode } from './FileNode.tsx';
import { useFileTreeDrag } from "./hooks/useFileTreeDrag";

interface FileTreeProps {
    data: TreeNode[];
    onContextMenu: (e: React.MouseEvent, file: FileMetadata) => void;
}

export function FileTree({ data, onContextMenu }: FileTreeProps) {
    const { dragOver, onDragStartIntent } = useFileTreeDrag(data);

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
