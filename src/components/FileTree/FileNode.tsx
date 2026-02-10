import React from 'react';
import { useEditorStore } from '../../stores/editorStore.ts';
import { FileMetadata, TreeNode } from '../../types.ts';
import {
    ChevronRight,
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

    const isOpen = (expandedFolders[node.id]) || false;
    const hasChildren = node.children && node.children.length > 0;

    // Styling
    const paddingLeft = `${level * 24 + 12}px`;
    const isActive = activeNote?.path === node.id;

    // Left Click
    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (node.isDir) {
            toggleFolder(node.id);
        } else {
            setActiveNote(node.file);
        }
    };

    // Right Click
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
        } else if (e.key === 'ArrowRight' && node.isDir && !isOpen) {
            e.preventDefault();
            toggleFolder(node.id, true);
        } else if (e.key === 'ArrowLeft' && node.isDir && isOpen) {
            e.preventDefault();
            toggleFolder(node.id, false);
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const tree = (e.currentTarget as HTMLElement).closest('[role="tree"]');
            if (!tree) return;

            // Check if an element is inside a collapsed folder
            const isVisible = (el: HTMLElement): boolean => {
                let parent = el.parentElement;
                while (parent && parent !== tree) {
                    const style = window.getComputedStyle(parent);
                    if (style.gridTemplateRows === '0px') return false;
                    parent = parent.parentElement;
                }
                return true;
            };

            const items = Array.from(tree.querySelectorAll<HTMLElement>('[role="treeitem"]'))
                .filter(isVisible);
            const currentIndex = items.indexOf(e.currentTarget as HTMLElement);
            if (currentIndex === -1) return;
            const nextIndex = e.key === 'ArrowDown'
                ? Math.min(currentIndex + 1, items.length - 1)
                : Math.max(currentIndex - 1, 0);
            items[nextIndex].focus();
            items[nextIndex].scrollIntoView({ block: 'nearest' });
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
                    group flex items-center py-2 pr-2 cursor-pointer select-none
                    text-sm transition-colors duration-100 ease-in-out
                    focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-inset
                    ${isActive ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-700'}
                `}
                style={{
                    paddingLeft,
                    paddingTop: "4px",
                    paddingBottom: "4px",
                    marginBottom: "2px",
                }}
            >
                {/* 1. Expand/Collapse Icon (Animated Rotation) */}
                <span
                    className="mr-1 w-4 flex justify-center text-gray-400 hover:text-gray-600"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (node.isDir) toggleFolder(node.id);
                    }}
                >
                    {node.isDir && (
                        <ChevronRight
                            size={14}
                            className={`transform transition-transform duration-200 ease-in-out ${isOpen ? 'rotate-90' : 'rotate-0'}`}
                        />
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

            {/* Recursion: Render Children with Animation */}
            {node.isDir && (
                <div
                    className="grid transition-[grid-template-rows] duration-200 ease-in-out"
                    style={{
                        gridTemplateRows: isOpen ? "1fr" : "0fr"
                    }}
                >
                    <div className="overflow-hidden" role="group">
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
                                className="py-2 pr-2 text-xs italic text-gray-400"
                                style={{ paddingLeft: `${(level + 1) * 24 + 12}px` }}
                            >
                                Empty folder
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}