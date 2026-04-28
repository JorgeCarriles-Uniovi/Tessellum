import type { FileMetadata, TreeNode } from "../../../types.ts";

type FailedTargetLike = Pick<FileMetadata, "filename">;

export function isDescendantPath(path: string, parentPath: string): boolean {
    const separator = parentPath.includes("\\") ? "\\" : "/";
    return path.startsWith(parentPath + separator);
}

export function normalizeDeleteTargets(candidates: FileMetadata[]): FileMetadata[] {
    const uniqueTargets = Array.from(
        new Map(candidates.map((candidate) => [candidate.path, candidate])).values(),
    );

    return uniqueTargets.filter((target) => !uniqueTargets.some((other) =>
        other.path !== target.path &&
        other.is_dir &&
        isDescendantPath(target.path, other.path)
    ));
}

export function shouldRemovePath(path: string, targets: FileMetadata[]): boolean {
    return targets.some((target) =>
        path === target.path || (target.is_dir && isDescendantPath(path, target.path))
    );
}

export function findPreviousOpenNote(
    activeNotePath: string,
    openTabPaths: string[],
    files: FileMetadata[],
    targets: FileMetadata[],
): FileMetadata | null {
    const activeIndex = openTabPaths.indexOf(activeNotePath);
    if (activeIndex <= 0) {
        return null;
    }

    for (let index = activeIndex - 1; index >= 0; index -= 1) {
        const candidatePath = openTabPaths[index];
        if (shouldRemovePath(candidatePath, targets)) {
            continue;
        }

        const candidate = files.find((file) => file.path === candidatePath);
        if (candidate) {
            return candidate;
        }
    }

    return null;
}

export function pruneTreeByTargets(nodes: TreeNode[], targets: FileMetadata[]): TreeNode[] {
    return nodes
        .filter((node) => !shouldRemovePath(node.id, targets))
        .map((node) => ({
            ...node,
            children: pruneTreeByTargets(node.children ?? [], targets),
        }));
}

export function getDeleteErrorMessage(error: unknown): string {
    if (typeof error === "string" && error.trim()) {
        return error;
    }

    if (error && typeof error === "object") {
        const message = Reflect.get(error, "message");
        if (typeof message === "string" && message.trim()) {
            return message;
        }
    }

    return "Failed to trash item";
}

export function summarizeFailedTargets(failedTargets: FailedTargetLike[]): string {
    const previewNames = failedTargets.slice(0, 3).map((target) => target.filename);
    const remainingCount = failedTargets.length - previewNames.length;
    const preview = previewNames.join(", ");

    return remainingCount > 0 ? `${preview} and ${remainingCount} more` : preview;
}
