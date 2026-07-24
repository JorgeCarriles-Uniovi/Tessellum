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
    LayoutTemplate,
} from 'lucide-react';
import { TbFileTypePdf } from "react-icons/tb";
import { useAppTranslation } from "../../i18n/react.tsx";

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

/** v2: rows are emphasized (accent background/text) when selected or when they're the active/open note. */
function isRowEmphasized(isSelected: boolean, isActive: boolean): boolean {
    return isSelected || isActive;
}

/** v2: the row's background — accent tint when emphasized, otherwise transparent (hover is handled via className). */
function getRowBackgroundStyle(isEmphasized: boolean): React.CSSProperties {
    return {
        backgroundColor: isEmphasized ? 'var(--color-bg-active)' : 'transparent',
    };
}

/** v2: only apply the hover tint when the row isn't already emphasized, so hover doesn't wash out the active/selected state. */
function getRowHoverClassName(isEmphasized: boolean): string {
    return isEmphasized ? '' : 'group-hover:bg-[color:var(--color-bg-hover)]';
}

/** v2: label color/weight — folders are always the primary/500 treatment; files pick up accent/600 when emphasized. */
function getLabelStyle(isDir: boolean, isEmphasized: boolean): React.CSSProperties {
    if (isDir) {
        return { color: 'var(--color-text-primary)', fontWeight: 500 };
    }
    return {
        color: isEmphasized ? 'var(--color-accent-default)' : 'var(--color-text-secondary)',
        fontWeight: isEmphasized ? 600 : 400,
    };
}

function renderFileIcon(isDir: boolean, isOpen: boolean, isEmphasized: boolean, fileName?: string): JSX.Element {
    const iconColor = isDir
        ? (isOpen ? 'var(--color-accent-default)' : 'var(--color-text-tertiary)')
        : (isEmphasized ? 'var(--color-accent-default)' : 'var(--color-text-tertiary)');
    const folderIconStyle = { marginRight: "0.5rem", width: "1rem", height: "1rem", color: iconColor };
    const fileIconStyle = { marginRight: "0.5rem", width: "0.875rem", height: "0.875rem", color: iconColor };

    if (isDir) {
        return isOpen
            ? <FolderOpen size={16} strokeWidth={2} style={folderIconStyle} />
            : <FolderIcon size={16} strokeWidth={2} style={folderIconStyle} />;
    }

    if (fileName) {
        const ext = fileName.toLowerCase().split('.').pop() || "";
        if (ext === "md") {
            return <FileDown size={14} strokeWidth={2.5} style={fileIconStyle} />;
        }
        if (ext === "txt") {
            return <FileText size={14} strokeWidth={2} style={fileIconStyle} />;
        }
        if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) {
            return <FileImage size={14} strokeWidth={2} style={fileIconStyle} />;
        }
        if (ext === "pdf") {
            return <TbFileTypePdf size={14} style={fileIconStyle} />;
        }
        if (ext === "canvas") {
            return <LayoutTemplate size={14} strokeWidth={2} style={fileIconStyle} />;
        }
    }

    return <FileIcon size={14} strokeWidth={2} style={fileIconStyle} />;
}

function renderExpandIcon(isDir: boolean, isOpen: boolean): JSX.Element | null {
    if (!isDir) return null;

    return (
        <ChevronRight
            size={14}
            strokeWidth={3}
            style={{ width: "0.875rem", height: "0.875rem", color: 'var(--color-text-tertiary)' }}
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
    setViewMode: (mode: 'editor' | 'graph' | 'canvas') => void,
    setCanvasPath: (path: string | null) => void,
) {
    if (node.is_dir) {
        toggleFolder(node.id);
        return;
    }
    const ext = node.name.toLowerCase().split('.').pop();
    if (ext === 'canvas') {
        setCanvasPath(node.id);
        setViewMode('canvas');
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
    setViewMode: (mode: 'editor' | 'graph' | 'canvas') => void,
    setCanvasPath: (path: string | null) => void,
) {
    selectOnly(node.id);
    openNode(node, toggleFolder, setActiveNote, setViewMode, setCanvasPath);
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
    setViewMode: (mode: 'editor' | 'graph' | 'canvas') => void;
    setCanvasPath: (path: string | null) => void;
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
            params.setCanvasPath,
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
    setViewMode: (mode: 'editor' | 'graph' | 'canvas') => void;
    setCanvasPath: (path: string | null) => void;
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
                    params.setCanvasPath,
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
    const isEmphasized = isRowEmphasized(isSelected, isActive);
    const labelStyle = getLabelStyle(node.is_dir, isEmphasized);
    const rowHoverClassName = getRowHoverClassName(isEmphasized);

    const nodeStyles: React.CSSProperties = {
        paddingLeft,
        marginBottom: "0.0625rem",
        fontFamily: "var(--font-sans)",
        ...dropStyle,
    };

    const rowStyle: React.CSSProperties = {
        padding: "6px 9px",
        borderRadius: "8px",
        fontSize: "13px",
        transition: "background-color 150ms ease",
        ...getRowBackgroundStyle(isEmphasized),
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
            {/* 1. Row - Constrained to Content Width */}
            <div
                className={`flex items-center max-w-full overflow-hidden w-full ${rowHoverClassName}`}
                style={rowStyle}
            >
                {/* Expand/Collapse Icon */}
                <span
                    className="w-4 flex justify-center shrink-0"
                    onClick={onExpandClick}
                >
                    {renderExpandIcon(node.is_dir, isOpen)}
                </span>

                {/* File Type Icon */}
                <span className="mr-1 flex shrink-0">
                    {renderFileIcon(node.is_dir, isOpen, isEmphasized, node.name)}
                </span>

                {/* Name */}
                <span className="truncate min-w-0 flex-1" style={labelStyle}>{
                    node.is_dir ? node.name : (() => {
                        const dotIndex = node.name.lastIndexOf('.');
                        return dotIndex !== -1 ? node.name.slice(0, dotIndex) : node.name;
                    })()
                }</span>

                {/* Extension for non-markdown files */}
                {!node.is_dir && !node.name.toLowerCase().endsWith('.md') && (
                    <span
                        className="ml-auto shrink-0 uppercase pr-1"
                        style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--color-text-tertiary)" }}
                    >
                        {node.name.split('.').pop()}
                    </span>
                )}
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
    emptyLabel: string;
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
                              emptyLabel,
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
                        style={{ paddingLeft: `calc(${level + 1} * 1.375rem + 1.75rem)` }}
                    >
                        {emptyLabel}
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
    const { t } = useAppTranslation("core");
    const { activeNote, setActiveNote } = useVaultStore();
    const { setViewMode, setCanvasPath } = useGraphStore();
    const { expandedFolders, toggleFolder } = useUiStore();
    const { selectedFilePaths, selectOnly, toggleSelection, rangeSelect, clearSelection } = useSelectionStore();

    const isOpen = (expandedFolders[node.id]) || false;
    const hasChildren = node.children && node.children.length > 0;

    // v2: ~22px per nesting level (1.375rem @ 16px root), plus a small base indent.
    const paddingLeft = `calc(${level} * 1.375rem + 0.75rem)`;
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
        setCanvasPath,
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
        setCanvasPath,
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
                emptyLabel={t("fileTree.empty")}
            />
        </div>
    );
}
