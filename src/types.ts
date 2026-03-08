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