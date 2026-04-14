import { useEffect, useRef } from 'react';
import { FileMetadata } from '../../types.ts';
import { useAppTranslation } from '../../i18n/react.tsx';
import { createSidebarContextMenuItems } from "./sidebarContextMenuItems.ts";

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
    onPasteFiles?: () => void;
    onCopy?: () => void;
}

export function SidebarContextMenu({
                                       x, y, target, onClose, onRename, onDelete, onNewNote, onNewNoteFromTemplate, onNewFolder, onPasteFiles, onCopy
                                   }: SidebarContextMenuProps) {
    const { t } = useAppTranslation("core");
    const menuRef = useRef<HTMLDivElement>(null);
    const items = createSidebarContextMenuItems({
        isDirectory: target.is_dir,
        onRename,
        onDelete,
        onNewNote,
        onNewNoteFromTemplate,
        onNewFolder,
        onPasteFiles,
        onCopy,
        labels: {
            rename: t("contextMenu.rename"),
            newNote: t("contextMenu.newNote"),
            newNoteFromTemplate: t("contextMenu.newNoteFromTemplate"),
            newFolder: t("contextMenu.newFolder"),
            pasteFiles: t("contextMenu.pasteFiles"),
            delete: t("contextMenu.delete"),
            copy: t("contextMenu.copy"),
        },
    });

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener("keydown", handleEscape);

        return function () {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [onClose]);

    useEffect(() => {
        if (!menuRef.current) {
            return;
        }

        const rect = menuRef.current.getBoundingClientRect();
        const adjustedX = rect.right > window.innerWidth ? window.innerWidth - rect.width - 8 : x;
        const adjustedY = rect.bottom > window.innerHeight ? window.innerHeight - rect.height - 8 : y;

        menuRef.current.style.left = `${Math.max(8, adjustedX)}px`;
        menuRef.current.style.top = `${Math.max(8, adjustedY)}px`;
    }, [x, y, items.length]);

    return (
        <div
            ref={menuRef}
            className="fixed z-[100] min-w-[200px] rounded-lg border border-[color:var(--color-panel-border)] bg-[color:var(--color-panel-bg)] text-[color:var(--color-text-primary)] py-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-100"
            style={{ left: x, top: y, paddingTop: "0.7rem", paddingBottom: "0.7rem", paddingLeft: "1rem", paddingRight: "1rem", gap: "1rem" }}
            onClick={function (e) { return e.stopPropagation() }}
        >
            {items.map((item, index) => (
                <div key={`${item.label}-${index}`}>
                    {item.separator && <div className="mx-3 my-1.5 h-px bg-[color:var(--color-panel-border)]" />}
                    <button
                        onClick={() => {
                            item.onClick();
                            onClose();
                        }}
                        className={`flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors ${item.variant === "danger"
                            ? "text-[color:var(--color-alert-text)] hover:bg-[color:var(--color-alert-bg)]"
                            : "text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-panel-hover)]"
                        }`}
                        style={{ paddingTop: item.separator ? "0.5rem" : "0.375rem", paddingBottom: item.separator ? "0.5rem" : "0.375rem", paddingLeft: "0.3rem", paddingRight: "0.3rem" }}
                    >
                        <item.icon
                            className={`size-4 ${item.variant === "danger" ? "text-[color:var(--color-alert-text)]" : "text-[color:var(--color-text-muted)]"
                            }`}
                        />
                        <span className="font-medium">{item.label}</span>
                    </button>
                </div>
            ))}
        </div>
    );
}
