import {
    Clipboard,
    Edit3,
    FileOutput,
    FileText,
    FolderPlus,
    Sparkles,
    Trash2,
    Copy,
    type LucideIcon,
} from "lucide-react";

export interface SidebarContextMenuItem {
    /**
     * Stable, untranslated identifier. Used as the React key: `label` is a
     * translated string that can collide across locales or change between
     * renders, and an index-derived key reuses DOM nodes across items.
     */
    id: string;
    icon: LucideIcon;
    label: string;
    onClick: () => void;
    variant?: "default" | "danger";
    separator?: boolean;
}

interface SidebarContextMenuLabels {
    rename: string;
    newNote: string;
    newNoteFromTemplate: string;
    newFolder: string;
    pasteFiles: string;
    exportToPdf: string;
    copy: string;
    delete: string;
}

interface CreateSidebarContextMenuItemsOptions {
    isDirectory: boolean;
    onRename: () => void;
    onDelete: () => void;
    onNewNote?: () => void;
    onNewNoteFromTemplate?: () => void;
    onNewFolder?: () => void;
    onPasteFiles?: () => void;
    onExportToPdf?: () => void;
    onCopy?: () => void;
    canExportToPdf?: boolean;
    labels: SidebarContextMenuLabels;
}

export function createSidebarContextMenuItems({
                                                  isDirectory,
                                                  onRename,
                                                  onDelete,
                                                  onNewNote,
                                                  onNewNoteFromTemplate,
                                                  onNewFolder,
                                                  onPasteFiles,
                                                  onExportToPdf,
                                                  onCopy,
                                                  canExportToPdf = false,
                                                  labels,
                                              }: CreateSidebarContextMenuItemsOptions): SidebarContextMenuItem[] {
    const items: SidebarContextMenuItem[] = [
        { id: "rename", icon: Edit3, label: labels.rename, onClick: onRename },
    ];

    if (isDirectory && onNewNote) {
        items.push({
            id: "new-note",
            icon: FileText,
            label: labels.newNote,
            onClick: onNewNote,
            separator: true,
        });
    }

    if (isDirectory && onNewNoteFromTemplate) {
        items.push({
            id: "new-note-from-template",
            icon: Sparkles,
            label: labels.newNoteFromTemplate,
            onClick: onNewNoteFromTemplate,
        });
    }

    if (isDirectory && onNewFolder) {
        items.push({
            id: "new-folder",
            icon: FolderPlus,
            label: labels.newFolder,
            onClick: onNewFolder,
        });
    }

    if (isDirectory && onPasteFiles) {
        items.push({
            id: "paste-files",
            icon: Clipboard,
            label: labels.pasteFiles,
            onClick: onPasteFiles,
        });
    }

    if (!isDirectory && canExportToPdf && onExportToPdf) {
        items.push({
            id: "export-to-pdf",
            icon: FileOutput,
            label: labels.exportToPdf,
            onClick: onExportToPdf,
        });
    }

    if (onCopy) {
        items.push({
            id: "copy",
            icon: Copy,
            label: labels.copy,
            onClick: onCopy,
        });
    }

    items.push({
        id: "delete",
        icon: Trash2,
        label: labels.delete,
        onClick: onDelete,
        variant: "danger",
        separator: true,
    });

    return items;
}
