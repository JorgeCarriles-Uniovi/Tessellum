/**
 * Shared resolution for a double-click on a graph "ghost" node — a node that
 * appears in the graph because something links to it, but has no file on disk.
 *
 * Both the global Graph View and the Local Graph panel used to carry their own
 * copy of this logic; the Local Graph copy never received either of BUG-U3's
 * fixes, so it recreated the original symptoms (a stray `Diagram.png.md` for a
 * missing image, and a lost folder prefix for `[[Projects/Idea]]`). Keep this
 * as the single implementation so the two panels cannot drift again.
 */
export const MEDIA_EXTENSIONS: ReadonlySet<string> = new Set([
    "png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico",
    "pdf", "mp4", "mov", "avi", "mkv", "webm", "mp3", "ogg", "wav",
]);

export type GhostNodeTarget =
    | { kind: "media" }
    | { kind: "note"; title: string; targetDir: string };

export function resolveGhostNodeTarget(nodeId: string, vaultPath: string): GhostNodeTarget {
    const parts = nodeId.replace(/\\/g, "/").split("/");
    const filename = parts[parts.length - 1];
    const ext = filename.includes(".") ? (filename.split(".").pop()?.toLowerCase() ?? "") : "";

    // A ghost node for a missing media asset must not become a Markdown file.
    if (ext && MEDIA_EXTENSIONS.has(ext)) {
        return { kind: "media" };
    }

    return {
        kind: "note",
        title: filename.replace(/\.md$/i, ""),
        // Preserve the folder prefix so [[Projects/Idea]] creates
        // vault/Projects/Idea.md rather than vault/Idea.md.
        targetDir: parts.length > 1 ? `${vaultPath}/${parts.slice(0, -1).join("/")}` : vaultPath,
    };
}
