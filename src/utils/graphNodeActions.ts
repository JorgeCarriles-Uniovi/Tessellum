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
const MEDIA_EXTENSIONS: ReadonlySet<string> = new Set([
    "png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico",
    "pdf", "mp4", "mov", "avi", "mkv", "webm", "mp3", "ogg", "wav",
]);

export type GhostNodeTarget =
    | { kind: "media" }
    | { kind: "rejected" }
    | { kind: "note"; title: string; targetDir: string };

/**
 * A ghost node id is a raw wikilink target with no filtering — the backend's
 * link extraction only trims and splits on `|`. Without this check, a note
 * containing `[[../../Documents/pwned]]` would join `..` segments onto
 * `vaultPath` and `createNoteInDir` would write a file outside the vault
 * (the backend's `create_note` only validates `vault_path` against itself,
 * so it does not catch this). Reject anything that could resolve outside the
 * vault before it ever reaches a targetDir: a `.` or `..` path component, or
 * an id that looks absolute (leading `/`, leading `\`, or a Windows drive
 * prefix such as `C:`).
 */
function isUnsafeGhostNodeId(nodeId: string, parts: string[]): boolean {
    if (nodeId.startsWith("/") || nodeId.startsWith("\\")) return true;
    if (/^[a-zA-Z]:[\\/]/.test(nodeId)) return true;
    return parts.some((part) => part === "." || part === "..");
}

export function resolveGhostNodeTarget(nodeId: string, vaultPath: string): GhostNodeTarget {
    const parts = nodeId.replace(/\\/g, "/").split("/");

    if (isUnsafeGhostNodeId(nodeId, parts)) {
        return { kind: "rejected" };
    }

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
