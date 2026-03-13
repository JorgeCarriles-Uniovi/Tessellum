import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { Text } from "@codemirror/state";
import { Link2, List, Tag } from "lucide-react";
import { theme } from "../../styles/theme";
import { useEditorStore } from "../../stores/editorStore";
import { useTessellumApp } from "../../plugins/TessellumApp";
import { parseFrontmatter } from "../Editor/extensions/frontmatter/frontmatter-parser";
import { stringToColor } from "../../utils/graphUtils";

const SNIPPET_LIMIT = 20;
const SNIPPET_MAX_LEN = 120;
const SNIPPET_WORDS = 20;
const RIGHT_SIDEBAR_WIDTH_KEY = "tessellum:right-sidebar-width";
const RIGHT_SIDEBAR_MIN = 240;
const RIGHT_SIDEBAR_MAX = 520;

interface BacklinkItem {
    path: string;
    label: string;
    snippet?: string;
}

function normalizeTag(tag: string): string {
    return tag.trim().replace(/^#/, "");
}

function getFilenameLabel(path: string): string {
    const name = path.replace(/\\/g, "/").split("/").pop() || path;
    return name.endsWith(".md") ? name.slice(0, -3) : name;
}

function normalizeLinkTarget(target: string): string {
    return target
        .trim()
        .replace(/\\/g, "/")
        .replace(/\.md$/i, "");
}

function truncateSnippet(line: string): string {
    if (line.length <= SNIPPET_MAX_LEN) return line;
    return `"${line.slice(0, SNIPPET_MAX_LEN - 1)}"...`;
}

function stripFrontmatter(content: string): string {
    const doc = Text.of(content.split("\n"));
    const block = parseFrontmatter(doc);
    if (!block) return content;
    return doc.sliceString(block.to).trimStart();
}

function extractSnippet(content: string): string | undefined {
    const body = stripFrontmatter(content);
    const words = body
        .replace(/\s+/g, " ")
        .trim()
        .split(" ")
        .filter(Boolean);

    if (words.length === 0) return undefined;

    const snippet = "\"" + words.slice(0, SNIPPET_WORDS).join(" ");
    const suffix = words.length > SNIPPET_WORDS ? "\"..." : "\"";
    return truncateSnippet(`${snippet}${suffix}`);
}

function clampWidth(value: number): number {
    return Math.min(RIGHT_SIDEBAR_MAX, Math.max(RIGHT_SIDEBAR_MIN, value));
}

export function RightSidebar() {
    const { activeNote, activeNoteContent, files, vaultPath, isRightSidebarOpen } = useEditorStore();
    const app = useTessellumApp();
    const [backlinks, setBacklinks] = useState<BacklinkItem[]>([]);
    const [isLoadingBacklinks, setIsLoadingBacklinks] = useState(false);
    const [backendTags, setBackendTags] = useState<string[]>([]);
    const [sidebarWidth, setSidebarWidth] = useState(() => {
        const stored = localStorage.getItem(RIGHT_SIDEBAR_WIDTH_KEY);
        const parsed = stored ? Number.parseInt(stored, 10) : NaN;
        return Number.isFinite(parsed) ? clampWidth(parsed) : 288;
    });
    const isResizingRef = useRef(false);

    const targetCandidates = useMemo(() => {
        if (!activeNote) return new Set<string>();
        const normalizedPath = normalizeLinkTarget(activeNote.path);
        const relative = vaultPath
            ? normalizeLinkTarget(activeNote.path.replace(/\\/g, "/").replace(vaultPath.replace(/\\/g, "/"), "").replace(/^\//, ""))
            : normalizedPath;
        const nameOnly = normalizeLinkTarget(getFilenameLabel(activeNote.path));

        return new Set([normalizedPath, relative, nameOnly]);
    }, [activeNote?.path, vaultPath]);

    useEffect(() => {
        let cancelled = false;

        const loadBacklinks = async () => {
            if (!activeNote) {
                setBacklinks([]);
                setIsLoadingBacklinks(false);
                return;
            }

            setIsLoadingBacklinks(true);
            try {
                const paths = await app.workspace.getBacklinks(activeNote.path);
                const items: BacklinkItem[] = paths.map((path) => {
                    const file = files.find((f) => f.path === path);
                    const label = file?.filename ? file.filename.replace(/\.md$/i, "") : getFilenameLabel(path);
                    return { path, label };
                });

                if (cancelled) return;
                setBacklinks(items);

                const snippetTargets = items.slice(0, SNIPPET_LIMIT);
                const snippets = await Promise.all(
                    snippetTargets.map(async (item) => {
                        try {
                            const content = await app.vault.readFile(item.path);
                            return extractSnippet(content);
                        } catch (e) {
                            console.error(e);
                            return undefined;
                        }
                    })
                );

                if (cancelled) return;
                setBacklinks((prev) =>
                    prev.map((item, idx) => {
                        if (idx >= SNIPPET_LIMIT) return item;
                        return { ...item, snippet: snippets[idx] };
                    })
                );
            } catch (e) {
                console.error(e);
                if (!cancelled) {
                    setBacklinks([]);
                }
            } finally {
                if (!cancelled) setIsLoadingBacklinks(false);
            }
        };

        loadBacklinks();
        return () => {
            cancelled = true;
        };
    }, [activeNote?.path, files, app.workspace, app.vault, targetCandidates]);

    useEffect(() => {
        let cancelled = false;
        const loadBackendTags = async () => {
            if (!activeNote) {
                setBackendTags([]);
                return;
            }
            try {
                const tags = await app.vault.getFileTags(activeNote.path);
                if (!cancelled) setBackendTags(tags);
            } catch (e) {
                console.error(e);
                if (!cancelled) setBackendTags([]);
            }
        };
        loadBackendTags();
        return () => {
            cancelled = true;
        };
    }, [activeNote?.path, app.vault]);

    useEffect(() => {
        const handleMove = (event: MouseEvent) => {
            if (!isResizingRef.current) return;
            const nextWidth = clampWidth(window.innerWidth - event.clientX);
            setSidebarWidth(nextWidth);
            localStorage.setItem(RIGHT_SIDEBAR_WIDTH_KEY, String(nextWidth));
        };

        const handleUp = () => {
            if (isResizingRef.current) {
                isResizingRef.current = false;
                document.body.style.cursor = "";
                document.body.style.userSelect = "";
            }
        };

        window.addEventListener("mousemove", handleMove);
        window.addEventListener("mouseup", handleUp);
        return () => {
            window.removeEventListener("mousemove", handleMove);
            window.removeEventListener("mouseup", handleUp);
        };
    }, []);

    const onResizeStart = (event: ReactMouseEvent<HTMLDivElement>) => {
        event.preventDefault();
        isResizingRef.current = true;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
    };

    const frontendTags = useMemo(() => {
        if (!activeNoteContent) return [] as string[];
        const doc = Text.of(activeNoteContent.split("\n"));
        const block = parseFrontmatter(doc);
        const tags = new Set<string>();

        if (block) {
            const raw = block.properties.tags ?? block.properties.tag;
            if (Array.isArray(raw)) {
                raw.forEach((t) => {
                    const normalized = normalizeTag(String(t));
                    if (normalized) tags.add(normalized);
                });
            } else if (typeof raw === "string") {
                raw.split(",").forEach((t) => {
                    const normalized = normalizeTag(t);
                    if (normalized) tags.add(normalized);
                });
            }
        }

        const body = stripFrontmatter(activeNoteContent);
        const regex = /(?:^|\s)(#[a-zA-Z0-9_\-]+)/g;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(body)) !== null) {
            const normalized = normalizeTag(match[1]);
            if (normalized) tags.add(normalized);
        }

        return Array.from(tags);
    }, [activeNoteContent]);

    const allTags = useMemo(() => {
        const merged = new Set<string>();
        frontendTags.forEach((t) => merged.add(normalizeTag(t)));
        backendTags.forEach((t) => merged.add(normalizeTag(t)));
        return Array.from(merged).filter(Boolean).sort((a, b) => a.localeCompare(b));
    }, [frontendTags, backendTags]);

    return (
        <aside
            className="hidden xl:flex flex-col border-l overflow-y-auto relative transition-all duration-300 ease-in-out"
            style={{
                width: isRightSidebarOpen ? sidebarWidth : 0,
                backgroundColor: theme.colors.background.primary,
                borderColor: isRightSidebarOpen ? theme.colors.border.light : "transparent",
                padding: isRightSidebarOpen ? "1.75rem" : "0",
                opacity: isRightSidebarOpen ? 1 : 0,
                pointerEvents: isRightSidebarOpen ? "auto" : "none",
            }}
        >
            <div
                className="absolute left-0 top-0 h-full w-1 cursor-col-resize"
                onMouseDown={onResizeStart}
                style={{
                    backgroundColor: "transparent",
                }}
            />
            <div
                className="flex flex-col space-y-10 transition-all duration-300 ease-in-out"
                style={{
                    opacity: isRightSidebarOpen ? 1 : 0,
                    transform: isRightSidebarOpen ? "translateX(0)" : "translateX(8px)",
                }}
            >
                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3
                            className="text-[12px] font-semibold uppercase tracking-[0.24em]"
                            style={{
                                color: theme.colors.text.muted,
                                padding: "1rem"
                            }}
                        >
                            Backlinks
                        </h3>
                        <Link2 size={14} style={{ color: theme.colors.text.muted, marginRight: "1rem" }} />
                    </div>
                    {isLoadingBacklinks ? (
                        <div className="text-[11px]" style={{ color: theme.colors.text.muted, paddingLeft: "1rem" }}>
                            Loading backlinks
                        </div>
                    ) : !activeNote ? (
                        <div className="text-[11px]" style={{ color: theme.colors.text.muted, paddingLeft: "1rem" }}>
                            Select a note to see backlinks.
                        </div>
                    ) : backlinks.length === 0 ? (
                        <div className="text-[11px]" style={{ color: theme.colors.text.muted, paddingLeft: "1rem" }}>
                            No backlinks yet.
                        </div>
                    ) : (
                        <div className="space-y-3" style={{ padding: "1rem" }}>
                            {backlinks.map((item) => (
                                <button
                                    key={item.path}
                                    className="w-full text-left p-4 rounded-2xl border transition-colors"
                                    onClick={() => app.workspace.openNote(item.path)}
                                    style={{
                                        backgroundColor: theme.colors.background.secondary,
                                        borderColor: theme.colors.border.light,
                                        padding: "1rem",
                                        marginBottom: "1rem"
                                    }}
                                >
                                    <p className="text-[13px] font-semibold" style={{ color: theme.colors.text.secondary }}>
                                        {item.label}.md
                                    </p>
                                    {item.snippet && (
                                        <p className="text-[11px] mt-2 leading-5" style={{ color: theme.colors.text.muted }}>
                                            {item.snippet}
                                        </p>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </section>

                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3
                            className="text-[12px] font-semibold uppercase tracking-[0.24em]"
                            style={{ color: theme.colors.text.muted, padding: "1rem" }}
                        >
                            Tags
                        </h3>
                        <Tag size={14} style={{ color: theme.colors.text.muted, marginRight: "1rem" }} />
                    </div>
                    {!activeNote ? (
                        <div className="text-[11px]" style={{ color: theme.colors.text.muted, paddingLeft: "1rem" }}>
                            Select a note to see tags.
                        </div>
                    ) : allTags.length === 0 ? (
                        <div className="text-[11px]" style={{ color: theme.colors.text.muted, paddingLeft: "1rem" }}>
                            No tags found.
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-2" style={{ padding: "1rem" }}>
                            {allTags.map((tag) => {
                                const { h } = stringToColor(tag);
                                const saturation = "70%";
                                const lightnessBg = "60%";
                                const lightnessText = "50%";
                                return (
                                    <span
                                        key={tag}
                                        className="inline-flex gap-1.5 items-center px-3 py-1 rounded-full text-[13px] font-medium text-foreground group/pill"
                                        style={{
                                            backgroundColor: `hsla(${h}, ${saturation}, ${lightnessBg}, 0.15)`,
                                            color: `hsl(${h}, ${saturation}, ${lightnessText})`,
                                            border: `1px solid hsla(${h}, ${saturation}, ${lightnessBg}, 0.3)`,
                                            paddingLeft: "0.5rem",
                                            paddingRight: "0.5rem",
                                        }}
                                    >
                                        {tag}
                                    </span>
                                );
                            })}
                        </div>
                    )}
                </section>

                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3
                            className="text-[12px] font-semibold uppercase tracking-[0.24em]"
                            style={{ color: theme.colors.text.muted, padding: "1rem" }}
                        >
                            Outline
                        </h3>
                        <List size={14} style={{ color: theme.colors.text.muted, marginRight: "1rem" }} />
                    </div>
                    <div className="space-y-2 text-[12px]" style={{ color: theme.colors.text.muted, padding: "1rem" }}>
                        <div className="flex items-center gap-2"> Meeting Goals</div>
                        <div className="flex items-center gap-2"> Technical Specs</div>
                        <div className="flex items-center gap-2" style={{ paddingLeft: theme.spacing[2] }}> Backend Refactor</div>
                        <div className="flex items-center gap-2"> Action Items</div>
                    </div>
                </section>
            </div>
        </aside>
    );
}
