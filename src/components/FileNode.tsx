import React from 'react';
import { useEditorStore } from '../stores/editorStore';
import { FileMetadata, TreeNode } from '../types';
import {
    ChevronRight,
    ChevronDown,
    File as FileIcon,
    Folder as FolderIcon,
    FolderOpenIcon,
} from 'lucide-react';

export interface FileNodeProps {
    node: TreeNode;
    level: number;
    onContextMenu: (e: React.MouseEvent, file: FileMetadata) => void;
}

export function FileNode({ node, level, onContextMenu }: FileNodeProps) {
    const { activeNote, setActiveNote, expandedFolders, toggleFolder } = useEditorStore();

    const isOpen = (Boolean(expandedFolders[node.id])) || false;
    const hasChildren = node.children && node.children.length > 0;

    // Styling
    const paddingLeft = ""+level * 24 + 12+"px";
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

    // Keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (node.isDir) {
                toggleFolder(node.id);
            } else {
                setActiveNote(node.file);
            }
        } else if (e.key === 'ArrowRight' && node.isDir && !(Boolean(isOpen))) {
            e.preventDefault();
            toggleFolder(node.id, true);
        } else if (e.key === 'ArrowLeft' && node.isDir && (Boolean(isOpen))) {
            e.preventDefault();
            toggleFolder(node.id, false);
        }
    };

    return (
        <div>
            {/* The Row Item */}
            <div
                role="treeitem"
                tabIndex={0}
                aria-expanded={node.isDir ? isOpen : undefined}
                aria-selected={isActive}
                onClick={handleClick}
                onContextMenu={handleContextMenu}
                onKeyDown={handleKeyDown}
                className={`
                    group flex items-center py-1 pr-2 cursor-pointer select-none
                    text-sm transition-colors duration-100 ease-in-out
                    focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-inset
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
                        if (node.isDir) toggleFolder(node.id);
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
            {isOpen && node.isDir && (
                <div role="group">
                    {hasChildren ? (
                        node.children.map(child => (
                            <FileNode
                                key={child.id}
                                node={child}
                                level={level + 1}
                                onContextMenu={onContextMenu}
                            />
                        ))
                    ) : (
                        <div
                            className="py-1 pr-2 text-xs italic text-gray-400"
                            style={{ paddingLeft: `${(level + 1) * 24 + 12}px` }}
                        >
                            Empty folder
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
