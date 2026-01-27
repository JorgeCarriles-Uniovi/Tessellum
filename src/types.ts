import React from "react";

export interface FileMetadata {
    path: string,
    filename: string,
    is_dir: boolean,
    size: number,
    last_modified: number
}

export interface TreeNode {
    id: string; // The full path
    name: string;
    isDir: boolean;
    children: TreeNode[];
    file: FileMetadata;
}

export type CommandItem = {
    label: string;
    value: string;
    icon: React.ReactNode;
    insertText: string; // Markdown text to be inserted
    cursorOffset: number; // Where to put cursor after insertion
}