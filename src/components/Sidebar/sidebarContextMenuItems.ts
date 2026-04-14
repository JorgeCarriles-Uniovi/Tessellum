import {
    Clipboard,
    Edit3,
    FileText,
    FolderPlus,
    Sparkles,
    Trash2,
    Copy,
    type LucideIcon,
} from "lucide-react";

export interface SidebarContextMenuItem {
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
    onCopy?: () => void;
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
                                                  onCopy,
                                                  labels,
                                              }: CreateSidebarContextMenuItemsOptions): SidebarContextMenuItem[] {
    const items: SidebarContextMenuItem[] = [
        { icon: Edit3, label: labels.rename, onClick: onRename },
    ];

    if (isDirectory && onNewNote) {
        items.push({
            icon: FileText,
            label: labels.newNote,
            onClick: onNewNote,
            separator: true,
        });
    }

    if (isDirectory && onNewNoteFromTemplate) {
        items.push({
            icon: Sparkles,
            label: labels.newNoteFromTemplate,
            onClick: onNewNoteFromTemplate,
        });
    }

    if (isDirectory && onNewFolder) {
        items.push({
            icon: FolderPlus,
            label: labels.newFolder,
            onClick: onNewFolder,
        });
    }

    if (isDirectory && onPasteFiles) {
        items.push({
            icon: Clipboard,
            label: labels.pasteFiles,
            onClick: onPasteFiles,
        });
    }

    if (onCopy) {
        items.push({
            icon: Copy,
            label: labels.copy,
            onClick: onCopy,
        });
    }

    items.push({
        icon: Trash2,
        label: labels.delete,
        onClick: onDelete,
        variant: "danger",
        separator: true,
    });

    return items;
}
