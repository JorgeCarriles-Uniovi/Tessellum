import { FileMetadata } from "../types";

/**
 * Get the parent directory path from a file path
 */
export function getParentPath(path: string): string {
    const separator = path.includes('\\') ? '\\' : '/';
    return path.substring(0, path.lastIndexOf(separator));
}

/**
 * Get the parent path from a file metadata object
 */
export function getParentFromTarget(target: FileMetadata): string {
    return target.is_dir ? target.path : getParentPath(target.path);
}

/**
 * Get filename without .md extension
 */
export function getNameWithoutExtension(filename: string, isDir: boolean): string {
    if (isDir) return filename;
    return filename.replace(/\.md$/i, '');
}

/**
 * Ensure .md extension for files
 */
export function ensureMarkdownExtension(name: string, isDir: boolean): string {
    if (isDir) return name;
    return name.endsWith('.md') ? name : `${name}.md`;
}