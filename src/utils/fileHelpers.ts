// src/utils/fileHelpers.ts
import {FileMetadata} from "../types";

export interface TreeNode {
    id: string; // The full path
    name: string;
    isDir: boolean;
    children: TreeNode[];
    file: FileMetadata;
}

export function buildFileTree(files: FileMetadata[]): TreeNode[] {
    const root: TreeNode[] = [];
    const map: Record<string, TreeNode> = {};

    // 1. Create a Node for every file/folder
    // We assume files are sorted by path length or hierarchy if needed,
    // but this logic builds strictly based on paths.
    files.forEach(file => {
        // Create the node object
        map[file.path] = {
            id: file.path,
            name: file.filename,
            isDir: file.is_dir,
            children: [],
            file: file
        };
    });

    // 2. Link children to parents
    files.forEach(file => {
        const node = map[file.path];

        // Calculate parent path (this logic assumes standard separators)
        // For Windows/Mac compat, use the separator logic we discussed
        const separator = file.path.includes("\\") ? "\\" : "/";
        const parts = file.path.split(separator);

        if (parts.length === 1) {
            // It's at the root
            root.push(node);
        } else {
            // Find parent
            const parentPath = parts.slice(0, -1).join(separator);
            const parent = map[parentPath];

            if (parent) {
                parent.children.push(node);
            } else {
                // If parent isn't in the list (orphan), push to root
                root.push(node);
            }
        }
    });

    // 3. Sort: Folders on top, then alphabetical
    const sortNodes = (nodes: TreeNode[]) => {
        nodes.sort((a, b) => {
            if (a.isDir === b.isDir) return a.name.localeCompare(b.name);
            return a.isDir ? -1 : 1;
        });
        nodes.forEach(node => sortNodes(node.children));
    };

    sortNodes(root);
    return root;
}