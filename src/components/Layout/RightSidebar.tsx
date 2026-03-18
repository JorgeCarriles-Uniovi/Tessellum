import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { Text } from "@codemirror/state";
import { Link2, List, Tag } from "lucide-react";
import { theme } from "../../styles/theme";
import { BaseSidebar } from "./BaseSidebar";
import { cn } from "../../lib/utils";
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

function truncateSnippet(line: string): string {
    if (line.length <= SNIPPET_MAX_LEN) return line;
    return `${line.slice(0, SNIPPET_MAX_LEN - 1)}\" …`;
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
    const suffix = words.length > SNIPPET_WORDS ? "\" ..." : "\"";
    return truncateSnippet(`${snippet}${suffix}`);
}

function clampWidth(value: number): number {
    return Math.min(RIGHT_SIDEBAR_MAX, Math.max(RIGHT_SIDEBAR_MIN, value));
}

function getTagStyles(tag: string) {
    const { h } = stringToColor(tag);
    const saturation = "70%";
    const lightnessBg = "60%";
    const lightnessText = "50%";
    return {
        backgroundColor: `hsla(${h}, ${saturation}, ${lightnessBg}, 0.15)`,
        color: `hsl(${h}, ${saturation}, ${lightnessText})`,
        border: `1px solid hsla(${h}, ${saturation}, ${lightnessBg}, 0.3)`,
        paddingLeft: "0.5rem",
        paddingRight: "0.5rem",
    };
}

function getFrontmatterTags(content: string): Set<string> {
    const doc = Text.of(content.split("\n"));
    const block = parseFrontmatter(doc);
    const tags = new Set<string>();

    if (!block) return tags;

    const raw = block.properties.tags ?? block.properties.tag;
    if (Array.isArray(raw)) {
        raw.forEach((t) => {
            const normalized = normalizeTag(String(t));
            if (normalized) tags.add(normalized);
        });
        return tags;
    }

    if (typeof raw === "string") {
        raw.split(",").forEach((t) => {
            const normalized = normalizeTag(t);
            if (normalized) tags.add(normalized);
        });
    }

    return tags;
}

function getInlineTags(content: string): Set<string> {
    const body = stripFrontmatter(content);
    const tags = new Set<string>();
    const regex = /(?:^|\s)(#[a-zA-Z0-9_\-]+)/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(body)) !== null) {
        const normalized = normalizeTag(match[1]);
        if (normalized) tags.add(normalized);
    }

    return tags;
}

function getFrontendTags(content?: string): string[] {
    if (!content) return [];

    const merged = new Set<string>();
    getFrontmatterTags(content).forEach((tag) => merged.add(tag));
    getInlineTags(content).forEach((tag) => merged.add(tag));
    return Array.from(merged);
}

function getAllTags(frontendTags: string[], backendTags: string[]) {
    const merged = new Set<string>();
    frontendTags.forEach((t) => merged.add(normalizeTag(t)));
    backendTags.forEach((t) => merged.add(normalizeTag(t)));
    return Array.from(merged).filter(Boolean).sort((a, b) => a.localeCompare(b));
}

function createBacklinkItems(paths: string[], files?: { path: string; filename?: string }[]): BacklinkItem[] {
    return paths.map((path) => {
        const file = files?.find((f) => f.path === path);
        const label = file?.filename ? file.filename.replace(/\.md$/i, "") : getFilenameLabel(path);
        return { path, label };
    });
}

async function readSnippetSafely(app: ReturnType<typeof useTessellumApp>, path: string) {
    try {
        const content = await app.vault.readFile(path);
        return extractSnippet(content);
    } catch (e) {
        console.error(e);
        return undefined;
    }
}

async function fetchSnippets(app: ReturnType<typeof useTessellumApp>, items: BacklinkItem[]) {
    const targets = items.slice(0, SNIPPET_LIMIT);
    return Promise.all(targets.map((item) => readSnippetSafely(app, item.path)));
}

function mergeSnippets(items: BacklinkItem[], snippets: Array<string | undefined>) {
    return items.map((item, idx) => {
        if (idx >= SNIPPET_LIMIT) return item;
        return { ...item, snippet: snippets[idx] };
    });
}

function useSidebarWidth() {
    const [sidebarWidth, setSidebarWidth] = useState(() => {
        const stored = localStorage.getItem(RIGHT_SIDEBAR_WIDTH_KEY);
        const parsed = stored ? Number.parseInt(stored, 10) : NaN;
        return Number.isFinite(parsed) ? clampWidth(parsed) : 288;
    });
    const [isResizing, setIsResizing] = useState(false);
    const isResizingRef = useRef(false);

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
                setIsResizing(false);
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
        setIsResizing(true);
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
    };

    return { sidebarWidth, isResizing, onResizeStart };
}

function useBacklinks(
    app: ReturnType<typeof useTessellumApp>,
    activePath?: string,
    files?: { path: string; filename?: string }[]
) {
    const [backlinks, setBacklinks] = useState<BacklinkItem[]>([]);
    const [isLoadingBacklinks, setIsLoadingBacklinks] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const setIfActive = (updater: () => void) => {
            if (!cancelled) updater();
        };

        const loadBacklinks = async () => {
            if (!activePath) {
                setBacklinks([]);
                setIsLoadingBacklinks(false);
                return;
            }

            setIsLoadingBacklinks(true);
            try {
                const paths = await app.workspace.getBacklinks(activePath);
                const items = createBacklinkItems(paths, files);

                if (cancelled) return;
                setBacklinks(items);

                const snippets = await fetchSnippets(app, items);
                setIfActive(() => setBacklinks(mergeSnippets(items, snippets)));
            } catch (e) {
                console.error(e);
                setIfActive(() => setBacklinks([]));
            } finally {
                setIfActive(() => setIsLoadingBacklinks(false));
            }
        };

        loadBacklinks();
        return () => {
            cancelled = true;
        };
    }, [activePath, app.workspace, app.vault]);

    return { backlinks, isLoadingBacklinks };
}

function useBackendTags(app: ReturnType<typeof useTessellumApp>, activePath?: string) {
    const [backendTags, setBackendTags] = useState<string[]>([]);

    useEffect(() => {
        let cancelled = false;
        const loadBackendTags = async () => {
            if (!activePath) {
                setBackendTags([]);
                return;
            }
            try {
                const tags = await app.vault.getFileTags(activePath);
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
    }, [activePath, app.vault]);

    return backendTags;
}

function SidebarSectionHeader({ title, icon }: { title: string; icon: ReactNode }) {
    return (
        <div className="flex items-center justify-between">
            <h3
                className="text-[12px] font-semibold uppercase tracking-[0.24em]"
                style={{
                    color: theme.colors.text.muted,
                    padding: "1rem",
                }}
            >
                {title}
            </h3>
            {icon}
        </div>
    );
}

function EmptyState({ children }: { children: ReactNode }) {
    return (
        <div className="text-[11px]" style={{ color: theme.colors.text.muted, paddingLeft: "1rem" }}>
            {children}
        </div>
    );
}

function BacklinksSection({
                              activeNote,
                              backlinks,
                              isLoading,
                              onOpen,
                          }: {
    activeNote: { path: string } | null;
    backlinks: BacklinkItem[];
    isLoading: boolean;
    onOpen: (path: string) => void;
}) {
    return (
        <section className="space-y-4">
            <SidebarSectionHeader
                title="Backlinks"
                icon={<Link2 size={14} style={{ color: theme.colors.text.muted, marginRight: "1rem" }} />}
            />
            {isLoading ? (
                <EmptyState>Loading backlinks</EmptyState>
            ) : !activeNote ? (
                <EmptyState>Select a note to see backlinks.</EmptyState>
            ) : backlinks.length === 0 ? (
                <EmptyState>No backlinks yet.</EmptyState>
            ) : (
                <div className="space-y-3" style={{ padding: "1rem" }}>
                    {backlinks.map((item) => (
                        <button
                            key={item.path}
                            className="w-full text-left p-4 rounded-2xl border transition-colors"
                            onClick={() => onOpen(item.path)}
                            style={{
                                backgroundColor: theme.colors.background.secondary,
                                borderColor: theme.colors.border.light,
                                padding: "1rem",
                                marginBottom: "1rem",
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
    );
}

function TagsSection({ activeNote, tags }: { activeNote: { path: string } | null; tags: string[] }) {
    return (
        <section className="space-y-4">
            <SidebarSectionHeader
                title="Tags"
                icon={<Tag size={14} style={{ color: theme.colors.text.muted, marginRight: "1rem" }} />}
            />
            {!activeNote ? (
                <EmptyState>Select a note to see tags.</EmptyState>
            ) : tags.length === 0 ? (
                <EmptyState>No tags found.</EmptyState>
            ) : (
                <div className="flex flex-wrap gap-2" style={{ padding: "1rem" }}>
                    {tags.map((tag) => (
                        <span
                            key={tag}
                            className="inline-flex gap-1.5 items-center px-3 py-1 rounded-full text-[13px] font-medium text-foreground group/pill"
                            style={getTagStyles(tag)}
                        >
                            {tag}
                        </span>
                    ))}
                </div>
            )}
        </section>
    );
}

function OutlineSection() {
    return (
        <section className="space-y-4">
            <SidebarSectionHeader
                title="Outline"
                icon={<List size={14} style={{ color: theme.colors.text.muted, marginRight: "1rem" }} />}
            />
            <div className="space-y-2 text-[12px]" style={{ color: theme.colors.text.muted, padding: "1rem" }}>
                <div className="flex items-center gap-2"> Meeting Goals</div>
                <div className="flex items-center gap-2"> Technical Specs</div>
                <div className="flex items-center gap-2" style={{ paddingLeft: theme.spacing[2] }}> Backend Refactor</div>
                <div className="flex items-center gap-2"> Action Items</div>
            </div>
        </section>
    );
}

export function RightSidebar() {
    const { activeNote, activeNoteContent, files, isRightSidebarOpen } = useEditorStore();
    const app = useTessellumApp();
    const { sidebarWidth, isResizing, onResizeStart } = useSidebarWidth();
    const { backlinks, isLoadingBacklinks } = useBacklinks(app, activeNote?.path, files);
    const backendTags = useBackendTags(app, activeNote?.path);

    const frontendTags = useMemo(() => getFrontendTags(activeNoteContent), [activeNoteContent]);
    const allTags = useMemo(() => getAllTags(frontendTags, backendTags), [frontendTags, backendTags]);

    return (
        <BaseSidebar
            side="right"
            isOpen={isRightSidebarOpen}
            width={sidebarWidth}
            isResizing={isResizing}
            className="hidden xl:flex flex-col relative"
            style={{
                backgroundColor: theme.colors.background.primary,
                borderColor: theme.colors.border.light,
                padding: isRightSidebarOpen ? "1.75rem" : "0",
                overflow: "visible", // To allow the handle to stay on the edge
            }}
        >
            <div
                className="absolute left-0 top-0 h-full cursor-col-resize group z-50"
                onMouseDown={onResizeStart}
                style={{
                    width: "6px",
                    marginLeft: "-3px",
                }}
            >
                <div className={cn(
                    "w-[2px] h-full transition-colors",
                    isResizing ? "bg-blue-500" : "bg-transparent group-hover:bg-gray-200"
                )} />
            </div>
            <div
                className="flex flex-col space-y-10 transition-all duration-300 ease-in-out"
                style={{
                    opacity: isRightSidebarOpen ? 1 : 0,
                    transform: isRightSidebarOpen ? "translateX(0)" : "translateX(8px)",
                }}
            >
                <BacklinksSection
                    activeNote={activeNote}
                    backlinks={backlinks}
                    isLoading={isLoadingBacklinks}
                    onOpen={(path) => app.workspace.openNote(path)}
                />
                <TagsSection activeNote={activeNote} tags={allTags} />
                <OutlineSection />
            </div>
        </BaseSidebar>
    );
}