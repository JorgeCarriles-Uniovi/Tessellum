import React from 'react';
import { useGraphStore, useSelectionStore, useUiStore, useVaultStore } from "../../stores";
import { FileMetadata, TreeNode } from '../../types.ts';
import {
    ChevronRight,
    File as FileIcon,
    Folder as FolderIcon,
    FolderOpen,
    FileText,
    FileImage,
    FileDown,
} from 'lucide-react';
import { TbFileTypePdf } from "react-icons/tb";

export type DropPosition = 'before' | 'after' | 'inside' | null;

export interface FileNodeProps {
    node: TreeNode;
    level: number;
    onContextMenu: (e: React.MouseEvent, file: FileMetadata) => void;
    onDragStartIntent: (e: React.MouseEvent, node: TreeNode, isSelected: boolean) => void;
    dragOverPath: string | null;
    dragOverPosition: DropPosition | null;
}

function getVisibleTreeItemPaths(tree: HTMLElement): string[] {
    return getVisibleTreeItems(tree)
        .map((el) => el.dataset.path)
        .filter((path): path is string => typeof path === 'string' && path.length > 0);
}

function getVisibleTreeItems(tree: HTMLElement): HTMLElement[] {
    const isVisible = (el: HTMLElement): boolean => {
        let parent = el.parentElement;
        while (parent && parent !== tree) {
            const style = window.getComputedStyle(parent);
            if (style.gridTemplateRows === '0px') return false;
            parent = parent.parentElement;
        }
        return true;
    };

    return Array.from(tree.querySelectorAll<HTMLElement>('[role="treeitem"]'))
        .filter(isVisible);
}

function getDropStyle(
    dragOverPath: string | null,
    dragOverPosition: DropPosition | null,
    nodeId: string,
): React.CSSProperties {
    if (dragOverPath !== nodeId) {
        return {};
    }

    if (dragOverPosition === 'before') {
        return { borderTop: '2px solid var(--color-blue-500)' };
    }
    if (dragOverPosition === 'after') {
        return { borderBottom: '2px solid var(--color-blue-500)' };
    }
    if (dragOverPosition === 'inside') {
        return { backgroundColor: 'color-mix(in srgb, var(--color-blue-500) 15%, transparent)' };
    }
    return {};
}

function getSelectionClassName(isSelected: boolean, isActive: boolean): string {
    if (isSelected) {
        return 'bg-primary/10 text-primary ring-1 ring-primary/20';
    }
    if (isActive) {
        return 'bg-secondary/60 text-foreground';
    }
    return 'group-hover:bg-secondary/40 text-muted-foreground group-hover:text-foreground';
}

function renderFileIcon(isDir: boolean, isOpen: boolean, fileName?: string): JSX.Element {

    if (isDir) {
        return isOpen
            ? <FolderOpen size={16} strokeWidth={2} style={{ marginRight: `0.5rem` }} />
            : <FolderIcon size={16} strokeWidth={2} style={{ marginRight: `0.5rem` }} />;
    }

    if (fileName) {
        const ext = fileName.toLowerCase().split('.').pop() || "";
        if (ext === "md") {
            return <FileDown size={14} strokeWidth={2.5} style={{ marginRight: `0.5rem` }} />;
        }
        if (ext === "txt") {
            return <FileText size={14} strokeWidth={2} style={{ marginRight: `0.5rem` }} />;
        }
        if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) {
            return <FileImage size={14} strokeWidth={2} style={{ marginRight: `0.5rem` }} />;
        }
        if("pdf".includes(ext)){
            return <TbFileTypePdf size={14} strokeWidth={2} style={{marginRight: `0.5rem`}}></TbFileTypePdf>
        }
    }

    return <FileIcon size={14} strokeWidth={2} style={{ marginRight: `0.5rem` }} />;
}

function renderExpandIcon(isDir: boolean, isOpen: boolean): JSX.Element | null {
    if (!isDir) return null;

    return (
        <ChevronRight
            size={14}
            strokeWidth={2.5}
            className={`transform transition-transform duration-200 ease-in-out ${isOpen ? 'rotate-90' : 'rotate-0'}`}
        />
    );
}

function isModifierPressed(e: React.MouseEvent): boolean {
    const isMac = navigator.platform.toLowerCase().includes("mac");
    return isMac ? e.metaKey : e.ctrlKey;
}

function getTreeFromTarget(target: HTMLElement): HTMLElement | null {
    return target.closest('[role="tree"]') as HTMLElement | null;
}

function openNode(
    node: TreeNode,
    toggleFolder: (id: string, open?: boolean) => void,
    setActiveNote: (file: FileMetadata) => void,
    setViewMode: (mode: 'editor' | 'graph') => void,
) {
    if (node.is_dir) {
        toggleFolder(node.id);
        return;
    }
    setActiveNote(node.file);
    setViewMode('editor');
}

function selectAndOpen(
    node: TreeNode,
    selectOnly: (id: string) => void,
    toggleFolder: (id: string, open?: boolean) => void,
    setActiveNote: (file: FileMetadata) => void,
    setViewMode: (mode: 'editor' | 'graph') => void,
) {
    selectOnly(node.id);
    openNode(node, toggleFolder, setActiveNote, setViewMode);
}

function moveSelection(direction: 'up' | 'down', target: HTMLElement) {
    const tree = getTreeFromTarget(target);
    if (!tree) return;

    const items = getVisibleTreeItems(tree);
    const currentIndex = items.indexOf(target);
    if (currentIndex === -1) return;

    const nextIndex = direction === 'down'
        ? Math.min(currentIndex + 1, items.length - 1)
        : Math.max(currentIndex - 1, 0);
    const nextItem = items[nextIndex];
    nextItem.focus();
    nextItem.scrollIntoView({ block: 'nearest' });
}

function createClickHandler(params: {
    node: TreeNode;
    rangeSelect: (ordered: string[], id: string) => void;
    selectOnly: (id: string) => void;
    toggleSelection: (id: string) => void;
    toggleFolder: (id: string, open?: boolean) => void;
    setActiveNote: (file: FileMetadata) => void;
    setViewMode: (mode: 'editor' | 'graph') => void;
}) {
    return (e: React.MouseEvent) => {
        e.stopPropagation();

        if (e.shiftKey) {
            const tree = getTreeFromTarget(e.currentTarget as HTMLElement);
            if (tree) {
                const ordered = getVisibleTreeItemPaths(tree);
                params.rangeSelect(ordered, params.node.id);
            } else {
                params.selectOnly(params.node.id);
            }
            return;
        }

        if (isModifierPressed(e)) {
            params.toggleSelection(params.node.id);
            return;
        }

        selectAndOpen(
            params.node,
            params.selectOnly,
            params.toggleFolder,
            params.setActiveNote,
            params.setViewMode,
        );
    };
}

function createContextMenuHandler(params: {
    node: TreeNode;
    isSelected: boolean;
    selectOnly: (id: string) => void;
    onContextMenu: (e: React.MouseEvent, file: FileMetadata) => void;
}) {
    return (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!params.isSelected) {
            params.selectOnly(params.node.id);
        }
        params.onContextMenu(e, params.node.file);
    };
}

function createKeyDownHandler(params: {
    node: TreeNode;
    isOpen: boolean;
    selectOnly: (id: string) => void;
    toggleFolder: (id: string, open?: boolean) => void;
    setActiveNote: (file: FileMetadata) => void;
    setViewMode: (mode: 'editor' | 'graph') => void;
    clearSelection: () => void;
}) {
    return (e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'Escape':
                e.preventDefault();
                params.clearSelection();
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                selectAndOpen(
                    params.node,
                    params.selectOnly,
                    params.toggleFolder,
                    params.setActiveNote,
                    params.setViewMode,
                );
                break;
            case 'ArrowRight':
                if (params.node.is_dir && !params.isOpen) {
                    e.preventDefault();
                    params.toggleFolder(params.node.id, true);
                }
                break;
            case 'ArrowLeft':
                if (params.node.is_dir && params.isOpen) {
                    e.preventDefault();
                    params.toggleFolder(params.node.id, false);
                }
                break;
            case 'ArrowDown':
                e.preventDefault();
                moveSelection('down', e.currentTarget as HTMLElement);
                break;
            case 'ArrowUp':
                e.preventDefault();
                moveSelection('up', e.currentTarget as HTMLElement);
                break;
            default:
                break;
        }
    };
}

interface FileNodeRowProps {
    node: TreeNode;
    isOpen: boolean;
    isSelected: boolean;
    isActive: boolean;
    paddingLeft: string;
    dropStyle: React.CSSProperties;
    onDragStartIntent: (e: React.MouseEvent, node: TreeNode, isSelected: boolean) => void;
    onClick: (e: React.MouseEvent) => void;
    onContextMenu: (e: React.MouseEvent) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onExpandClick: (e: React.MouseEvent) => void;
}

function FileNodeRow({
                         node,
                         isOpen,
                         isSelected,
                         isActive,
                         paddingLeft,
                         dropStyle,
                         onDragStartIntent,
                         onClick,
                         onContextMenu,
                         onKeyDown,
                         onExpandClick,
                     }: FileNodeRowProps) {
    const selectionClassName = getSelectionClassName(isSelected, isActive);
    const fileIconClassName = `mr-4 ${node.is_dir ? "text-primary opacity-90" : "text-muted-foreground opacity-70"}`;
    const selectionWrapperStyle = { height: "32px", paddingLeft: "4px", paddingRight: "32px" };

    const nodeStyles: React.CSSProperties = {
        paddingLeft,
        marginBottom: "1px",
        fontFamily: "var(--font-sans)",
        ...dropStyle,
    };

    return (
        <div
            role="treeitem"
            tabIndex={0}
            data-path={node.id}
            aria-expanded={node.is_dir ? isOpen : undefined}
            aria-selected={isSelected}
            onMouseDown={(e) => onDragStartIntent(e, node, isSelected)}
            onClick={onClick}
            onContextMenu={onContextMenu}
            onKeyDown={onKeyDown}
            className="group flex items-center cursor-pointer select-none focus:outline-none"
            style={nodeStyles}
        >
            {/* 1. Selection Highlight Wrapper - Constrained to Content Width */}
            <div
                className={`
                    flex items-center pr-2 max-w-full overflow-hidden mr-2
                    text-[13px] font-medium transition-all duration-200
                    rounded-md w-full
                    ${selectionClassName}
                `}
                style={selectionWrapperStyle}
            >
                {/* Expand/Collapse Icon */}
                <span
                    className="w-4 flex justify-center text-muted-foreground group-hover:text-foreground"
                    onClick={onExpandClick}
                >
                    {renderExpandIcon(node.is_dir, isOpen)}
                </span>

                {/* File Type Icon */}
                <span className={fileIconClassName}>
                    {renderFileIcon(node.is_dir, isOpen, node.name)}
                </span>

                {/* Name */}
                <span className="truncate min-w-0 flex-1">{
                    node.is_dir ? node.name : (() => {
                        const dotIndex = node.name.lastIndexOf('.');
                        return dotIndex !== -1 ? node.name.slice(0, dotIndex) : node.name;
                    })()
                }</span>

                {/* Extension for non-markdown files */}
                {!node.is_dir && !node.name.toLowerCase().endsWith('.md') && (
                    <span className="ml-auto text-[10px] font-bold opacity-40 shrink-0 uppercase pr-1">
                        {node.name.split('.').pop()}
                    </span>
                )}

                {/* Spacer for extra breathing room */}
                <div className="w-1 shrink-0" />
            </div>
        </div>
    );
}

interface FileNodeChildrenProps {
    node: TreeNode;
    level: number;
    isOpen: boolean;
    hasChildren: boolean;
    onContextMenu: (e: React.MouseEvent, file: FileMetadata) => void;
    onDragStartIntent: (e: React.MouseEvent, node: TreeNode, isSelected: boolean) => void;
    dragOverPath: string | null;
    dragOverPosition: DropPosition | null;
}

function FileNodeChildren({
                              node,
                              level,
                              isOpen,
                              hasChildren,
                              onContextMenu,
                              onDragStartIntent,
                              dragOverPath,
                              dragOverPosition,
                          }: FileNodeChildrenProps) {
    if (!node.is_dir) return null;

    return (
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
                            onDragStartIntent={onDragStartIntent}
                            dragOverPath={dragOverPath}
                            dragOverPosition={dragOverPosition}
                        />
                    ))
                ) : (
                    <div
                        className="py-2 pr-2 text-xs italic text-muted-foreground opacity-60"
                        style={{ paddingLeft: `${(level + 1) * 16 + 28}px` }}
                    >
                        Empty
                    </div>
                )}
            </div>
        </div>
    );
}

export function FileNode({
                             node,
                             level,
                             onContextMenu,
                             onDragStartIntent,
                             dragOverPath,
                             dragOverPosition,
                         }: FileNodeProps) {
    const { activeNote, setActiveNote } = useVaultStore();
    const { setViewMode } = useGraphStore();
    const { expandedFolders, toggleFolder } = useUiStore();
    const { selectedFilePaths, selectOnly, toggleSelection, rangeSelect, clearSelection } = useSelectionStore();

    const isOpen = (expandedFolders[node.id]) || false;
    const hasChildren = node.children && node.children.length > 0;

    const paddingLeft = `${level * 16 + 12}px`;
    const isActive = activeNote?.path === node.id;
    const isSelected = selectedFilePaths.includes(node.id);
    const dropStyle = getDropStyle(dragOverPath, dragOverPosition, node.id);

    const handleClick = createClickHandler({
        node,
        rangeSelect,
        selectOnly,
        toggleSelection,
        toggleFolder,
        setActiveNote,
        setViewMode,
    });

    const handleContextMenu = createContextMenuHandler({
        node,
        isSelected,
        selectOnly,
        onContextMenu,
    });

    const handleKeyDown = createKeyDownHandler({
        node,
        isOpen,
        selectOnly,
        toggleFolder,
        setActiveNote,
        setViewMode,
        clearSelection,
    });

    const handleExpandClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (node.is_dir) toggleFolder(node.id);
    };

    return (
        <div className="pl-1 pr-4">
            <FileNodeRow
                node={node}
                isOpen={isOpen}
                isSelected={isSelected}
                isActive={isActive}
                paddingLeft={paddingLeft}
                dropStyle={dropStyle}
                onDragStartIntent={onDragStartIntent}
                onClick={handleClick}
                onContextMenu={handleContextMenu}
                onKeyDown={handleKeyDown}
                onExpandClick={handleExpandClick}
            />

            <FileNodeChildren
                node={node}
                level={level}
                isOpen={isOpen}
                hasChildren={hasChildren}
                onContextMenu={onContextMenu}
                onDragStartIntent={onDragStartIntent}
                dragOverPath={dragOverPath}
                dragOverPosition={dragOverPosition}
            />
        </div>
    );
}