import { useEffect, useRef } from 'react';
import { FileMetadata } from '../types';
import {
    Trash2, Edit2, FilePlus, FolderPlus
} from 'lucide-react';

interface SidebarContextMenuProps {
    x: number;
    y: number;
    target: FileMetadata;
    onClose: () => void;
    onRename: () => void;
    onDelete: () => void;
    onNewNote?: () => void;
    onNewFolder?: () => void;
}

export function SidebarContextMenu({
                                       x, y, target, onClose, onRename, onDelete, onNewNote, onNewFolder
                                   }: SidebarContextMenuProps) {

    const menuRef = useRef<HTMLDivElement>(null);

    // Close if clicking outside the menu
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        // Use mousedown to catch clicks before they trigger other things
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    return (
        <div
            ref={menuRef}
            className="fixed bg-white border border-gray-200 shadow-xl rounded-lg py-1 w-48 z-50 text-sm animate-in fade-in zoom-in-95 duration-100"
            style={{ top: y, left: x }}
            onClick={(e) => e.stopPropagation()} // Prevent bubbling
        >
            {/* Header: File Name */}
            <div className="px-3 py-2 text-xs font-semibold text-gray-400 border-b border-gray-100 mb-1 truncate">
                {target.filename}
            </div>

            {/* Rename */}
            <button
                onClick={() => { onRename(); onClose(); }}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 text-gray-700"
            >
                <Edit2 size={14} /> Rename
            </button>

            {/* Divider */}
            <div className="h-px bg-gray-100 my-1" />

            {/* Create Actions (Optional) */}
            {onNewNote && (
                <button
                    onClick={() => { onNewNote(); onClose(); }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 text-gray-700"
                >
                    <FilePlus size={14} /> New Note
                </button>
            )}

            {onNewFolder && (
                <button
                    onClick={() => { onNewFolder(); onClose(); }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 text-gray-700"
                >
                    <FolderPlus size={14} /> New Folder
                </button>
            )}

            {/* Divider */}
            <div className="h-px bg-gray-100 my-1" />

            {/* Delete */}
            <button
                onClick={() => { onDelete(); onClose(); }}
                className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2"
            >
                <Trash2 size={14} /> Delete
            </button>
        </div>
    );
}