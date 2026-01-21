import React, { useState } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { TreeNode } from '../utils/fileHelpers';
import {
    ChevronRight,
    ChevronDown,
    File as FileIcon,
    Folder as FolderIcon, FolderOpenIcon
} from 'lucide-react'; // Assuming you use Lucide for native-looking icons

// --- Recursive Node Component ---
const FileNode = ({ node, level }: { node: TreeNode; level: number }) => {
    const { activeNote, setActiveNote, files } = useEditorStore();
    const [isOpen, setIsOpen] = useState(false);

    // Styling: Indent based on depth level
    const paddingLeft = `${level * 24 + 12}px`;

    const isActive = activeNote?.path === node.id;

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (node.isDir) {
            setIsOpen(!isOpen);
        } else {
            // Find the original metadata object to set active
            // (In a real app, maybe store the full metadata in the tree node too)
            const originalFile = files.find(f => f.path === node.id);
            if (originalFile) setActiveNote(originalFile);
        }
    };

    return (
        <div>
            {/* The Row Item */}
            <div
                onClick={handleClick}
                className={`
                    group flex items-center py-1 pr-2 cursor-pointer select-none
                    text-sm transition-colors duration-100 ease-in-out
                    ${isActive ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-700'}
                `}
                style={{ paddingLeft }}
            >
                {/* Icon Area: Chevron for folders, Spacer for files */}
                <span className="mr-1 w-4 flex justify-center text-gray-400">
                    {node.isDir && (
                        isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                    )}
                </span>

                {/* 2. File/Folder Icon */}
                <span className={`mr-2 ${node.isDir ? "text-yellow-500" : "text-gray-400"}`}>
                    {node.isDir ? (
                        // Show Open/Closed Folder Icon based on state
                        isOpen ? <FolderOpenIcon size={16} /> : <FolderIcon size={16} />
                    ) : (
                        <FileIcon size={16} />
                    )}
                </span>

                {/* Name */}
                <span className="truncate">{node.name}</span>
            </div>

            {/* Recursion: Render Children if Open */}
            {isOpen && node.children && (
                <div>
                    {node.children.map(child => (
                        <FileNode key={child.id} node={child} level={level + 1} />
                    ))}
                </div>
            )}
        </div>
    );
};

// --- Main Tree Component ---
export function FileTree({ data }: { data: TreeNode[] }) {
    return (
        <div className="w-full h-full overflow-y-auto pb-4">
            {/* Loop through root items */}
            {data.map(node => (
                <FileNode key={node.id} node={node} level={0} />
            ))}
        </div>
    );
}