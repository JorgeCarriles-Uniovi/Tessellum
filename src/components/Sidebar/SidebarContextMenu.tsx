import { useEffect, useRef } from 'react';
import { FileMetadata } from '../../types.ts';
import {
    Trash2, Edit2, FilePlus, FolderPlus
} from 'lucide-react';
import { useAppTranslation } from '../../i18n/react.tsx';

interface SidebarContextMenuProps {
    x: number;
    y: number;
    target: FileMetadata;
    onClose: () => void;
    onRename: () => void;
    onDelete: () => void;
    onNewNote?: () => void;
    onNewNoteFromTemplate?: () => void;
    onNewFolder?: () => void;
}

export function SidebarContextMenu({
                                       x, y, target, onClose, onRename, onDelete, onNewNote, onNewNoteFromTemplate, onNewFolder
                                   }: SidebarContextMenuProps) {
    const { t } = useAppTranslation("core");

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
        return function() { return document.removeEventListener('mousedown', handleClickOutside) };
    }, [onClose]);

    return (
        <div
            ref={menuRef}
            className="fixed border py-1 w-48 z-50 text-sm animate-in fade-in zoom-in-95 duration-100"
            style={{
                top: y,
                left: x,
                paddingTop: "8px",
                paddingBottom: "8px",
                paddingLeft: "1rem",
                paddingRight: "1rem",
                borderRadius: "var(--radius-lg)",
                boxShadow: "var(--shadow-xl)",
                backgroundColor: "var(--color-panel-bg)",
                borderColor: "var(--color-panel-border)",
            }}
            onClick={function(e) { return e.stopPropagation() }} // Prevent bubbling
        >
            {/* Header: File Name */}
            <div
                className="px-3 py-2 text-xs font-semibold border-b mb-1 truncate"
                style={{
                    color: "var(--color-text-muted)",
                    borderColor: "var(--color-border-light)",
                }}
            >
                {target.filename}
            </div>

            {/* Rename */}
            <button
                onClick={function() { onRename(); onClose(); }}
                className="w-full text-left px-4 py-2 flex items-center gap-2 hover:bg-[color:var(--color-panel-hover)]"
                style={{ color: "var(--color-text-secondary)", marginBottom: "2px", marginTop: "2px" }}
            >
                <Edit2 size={14} /> {t("contextMenu.rename")}
            </button>

            {/* Divider */}
            <div className="h-px my-1" style={{ backgroundColor: "var(--color-border-light)" }} />

            {/* Create Actions (Optional) */}
            {onNewNote && (
                <button
                    onClick={function() { onNewNote(); onClose(); }}
                    className="w-full text-left px-4 py-2 flex items-center gap-2 hover:bg-[color:var(--color-panel-hover)]"
                    style={{ color: "var(--color-text-secondary)", marginBottom: "2px", marginTop: "2px" }}
                >
                    <FilePlus size={14} /> {t("contextMenu.newNote")}
                </button>
            )}

            {onNewNoteFromTemplate && (
                <button
                    onClick={function() { onNewNoteFromTemplate(); onClose(); }}
                    className="w-full text-left px-4 py-2 flex items-center gap-2 hover:bg-[color:var(--color-panel-hover)]"
                    style={{ color: "var(--color-text-secondary)", marginBottom: "2px", marginTop: "2px" }}
                >
                    <FilePlus size={14} /> {t("contextMenu.newNoteFromTemplate")}
                </button>
            )}

            {onNewFolder && (
                <button
                    onClick={function() { onNewFolder(); }}
                    className="w-full text-left px-4 py-2 flex items-center gap-2 hover:bg-[color:var(--color-panel-hover)]"
                    style={{ color: "var(--color-text-secondary)", marginBottom: "2px", marginTop: "2px" }}
                >
                    <FolderPlus size={14} /> {t("contextMenu.newFolder")}
                </button>
            )}

            {/* Divider */}
            <div className="h-px my-1" style={{ backgroundColor: "var(--color-border-light)" }} />

            {/* Delete */}
            <button
                onClick={() => { onDelete(); onClose(); }}
                className="w-full text-left px-4 py-2 flex items-center gap-2 hover:bg-[color:var(--color-alert-bg)]"
                style={{ color: "var(--color-alert-text)", marginBottom: "2px", marginTop: "2px" }}
            >
                <Trash2 size={14} /> {t("contextMenu.delete")}
            </button>
        </div>
    );
}
