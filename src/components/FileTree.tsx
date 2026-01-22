import { FileMetadata, TreeNode } from '../types';
import { FileNode } from './FileNode';

interface FileTreeProps {
    data: TreeNode[];
    onContextMenu: (e: React.MouseEvent, file: FileMetadata) => void;
}

export function FileTree({ data, onContextMenu }: FileTreeProps) {
    return (
        <div className="w-full h-full overflow-y-auto pb-4" role="tree">
            {data.map(node => (
                <FileNode
                    key={node.id}
                    node={node}
                    level={0}
                    onContextMenu={onContextMenu}
                />
            ))}
        </div>
    );
}