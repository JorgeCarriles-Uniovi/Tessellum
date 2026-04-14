import type { FileMetadata } from "../../types.ts";

function isDescendantPath(path: string, parentPath: string): boolean {
    const separator = parentPath.includes("\\") ? "\\" : "/";
    return path.startsWith(`${parentPath}${separator}`);
}

export function resolveClipboardSelection(
    files: FileMetadata[],
    selectedPaths: string[],
): string[] {
    const uniqueTargets = selectedPaths
        .map((selectedPath) => files.find((file) => file.path === selectedPath))
        .filter((file): file is FileMetadata => Boolean(file))
        .filter((file, index, allFiles) => allFiles.findIndex((candidate) => candidate.path === file.path) === index);

    return uniqueTargets
        .filter((target) => !uniqueTargets.some((other) =>
            other.path !== target.path &&
            other.is_dir &&
            isDescendantPath(target.path, other.path)
        ))
        .map((target) => target.path);
}
