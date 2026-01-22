import React from 'react';
import { useEditorStore } from '../stores/editorStore';
import { TreeNode } from '../utils/fileHelpers';
import { FileMetadata } from '../types';
import {
    ChevronRight,
    ChevronDown,
    File as FileIcon,
    Folder as FolderIcon,
    FolderOpenIcon,
} from 'lucide-react';

// --- Props Interfaces ---

interface FileTreeProps {
    data: TreeNode[];
    onContextMenu: (e: React.MouseEvent, file: FileMetadata) => void;
}

interface FileNodeProps {
    node: TreeNode;
    level: number;
    onContextMenu: (e: React.MouseEvent, file: FileMetadata) => void;
}

// --- Recursive Node Component ---
const FileNode = ({ node, level, onContextMenu }: FileNodeProps) => {
    const { activeNote, setActiveNote, expandedFolders, toggleFolder } = useEditorStore();

    const isOpen = expandedFolders[node.id] || false;

    // Styling
    const paddingLeft = `${level * 24 + 12}px`;
    const isActive = activeNote?.path === node.id;

    // Left Click: Selection / Toggling
    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (node.isDir) {
            toggleFolder(node.id);
        } else {
            setActiveNote(node.file);
        }
    };

    // Right Click: Context Menu
    const handleContextMenu = (e: React.MouseEvent) => {
        onContextMenu(e, node.file);
    };

    return (
        <div>
            {/* The Row Item */}
            <div
                onClick={handleClick}
                onContextMenu={handleContextMenu}
                className={`
                    group flex items-center py-1 pr-2 cursor-pointer select-none
                    text-sm transition-colors duration-100 ease-in-out
                    ${isActive ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-700'}
                `}
                style={{ paddingLeft }}
            >
                {/* 1. Expand/Collapse Icon */}
                <span
                    className="mr-1 w-4 flex justify-center text-gray-400 hover:text-gray-600"
                    onClick={(e) => {
                        // Allow clicking chevron separately to toggle folders
                        e.stopPropagation();
                        if(node.isDir) toggleFolder(node.id);
                    }}
                >
                    {node.isDir && (
                        isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                    )}
                </span>

                {/* 2. File Type Icon */}
                <span className={`mr-2 ${node.isDir ? "text-yellow-500" : "text-gray-400"}`}>
                    {node.isDir ? (
                        isOpen ? <FolderOpenIcon size={16} /> : <FolderIcon size={16} />
                    ) : (
                        <FileIcon size={16} />
                    )}
                </span>

                {/* 3. Name */}
                <span className="truncate">{node.name}</span>
            </div>

            {/* Recursion: Render Children if Open */}
            {isOpen && node.children && (
                <div>
                    {node.children.map(child => (
                        <FileNode
                            key={child.id}
                            node={child}
                            level={level + 1}
                            onContextMenu={onContextMenu}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// --- Main Tree Component ---
export function FileTree({ data, onContextMenu }: FileTreeProps) {
    return (
        <div className="w-full h-full overflow-y-auto pb-4">
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