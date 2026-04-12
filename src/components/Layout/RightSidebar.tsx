import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Text } from "@codemirror/state";
import { ChevronDown, ChevronRight, Link2, List, Tag } from "lucide-react";
import { theme } from "../../styles/theme";
import { BaseSidebar } from "./BaseSidebar";
import { cn } from "../../lib/utils";
import { useEditorStore } from "../../stores/editorStore";
import { useTessellumApp } from "../../plugins/TessellumApp";
import { useResizableSidebarWidth } from "./useResizableSidebarWidth";
import { parseFrontmatter } from "../Editor/extensions/frontmatter/frontmatter-parser";
import { stringToColor } from "../../utils/graphUtils";
import { parseOutline } from "../../utils/outline";
import { useAppTranslation } from "../../i18n/react.tsx";

const SNIPPET_LIMIT = 20;
const SNIPPET_MAX_LEN = 120;
const SNIPPET_WORDS = 20;
const RIGHT_SIDEBAR_WIDTH_KEY = "tessellum:right-sidebar-width";
const RIGHT_SIDEBAR_MIN = 240;
const RIGHT_SIDEBAR_MAX = 520;
const SIDEBAR_ICON_SIZE = 14;
const SIDEBAR_ICON_STYLE = { width: "0.875rem", height: "0.875rem" };

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
    return useResizableSidebarWidth({
        side: "right",
        storageKey: RIGHT_SIDEBAR_WIDTH_KEY,
        min: RIGHT_SIDEBAR_MIN,
        max: RIGHT_SIDEBAR_MAX,
        defaultWidth: 288,
    });
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
                className="text-[0.75rem] font-semibold uppercase tracking-[0.24em]"
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
        <div className="text-[0.6875rem]" style={{ color: theme.colors.text.muted, paddingLeft: "1rem" }}>
            {children}
        </div>
    );
}

function BacklinksSection({
                              activeNote,
                              backlinks,
                              isLoading,
                              onOpen,
                              t,
                          }: {
    activeNote: { path: string } | null;
    backlinks: BacklinkItem[];
    isLoading: boolean;
    onOpen: (path: string) => void;
    t: (key: string, values?: Record<string, unknown>) => string;
}) {
    return (
        <section className="space-y-4">
            <SidebarSectionHeader
                title={t("rightSidebar.backlinks")}
                icon={<Link2 size={SIDEBAR_ICON_SIZE} style={{ ...SIDEBAR_ICON_STYLE, color: theme.colors.text.muted, marginRight: "1rem" }} />}
            />
            {isLoading ? (
                <EmptyState>{t("rightSidebar.loadingBacklinks")}</EmptyState>
            ) : !activeNote ? (
                <EmptyState>{t("rightSidebar.selectNoteForBacklinks")}</EmptyState>
            ) : backlinks.length === 0 ? (
                <EmptyState>{t("rightSidebar.noBacklinks")}</EmptyState>
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
                            <p className="text-[0.8125rem] font-semibold" style={{ color: theme.colors.text.secondary }}>
                                {item.label}.md
                            </p>
                            {item.snippet && (
                                <p className="text-[0.6875rem] mt-2 leading-5" style={{ color: theme.colors.text.muted }}>
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

function TagsSection({ activeNote, tags, t }: { activeNote: { path: string } | null; tags: string[]; t: (key: string) => string }) {
    return (
        <section className="space-y-4">
            <SidebarSectionHeader
                title={t("rightSidebar.tags")}
                icon={<Tag size={SIDEBAR_ICON_SIZE} style={{ ...SIDEBAR_ICON_STYLE, color: theme.colors.text.muted, marginRight: "1rem" }} />}
            />
            {!activeNote ? (
                <EmptyState>{t("rightSidebar.selectNoteForTags")}</EmptyState>
            ) : tags.length === 0 ? (
                <EmptyState>{t("rightSidebar.noTags")}</EmptyState>
            ) : (
                <div className="flex flex-wrap gap-2" style={{ padding: "1rem" }}>
                    {tags.map((tag) => (
                        <span
                            key={tag}
                            className="inline-flex gap-1.5 items-center px-3 py-1 rounded-full text-[0.8125rem] font-medium text-foreground group/pill"
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

function getOutlineIndent(level: number): string {
    return `calc(0.5rem + ${Math.max(level - 1, 0) * 0.875}rem)`;
}

function getOutlineKey(title: string, lineNumber: number): string {
    return `${lineNumber}:${title}`;
}

function hasNestedChildren(items: ReturnType<typeof parseOutline>, index: number): boolean {
    const currentLevel = items[index]?.level ?? 0;
    const nextLevel = items[index + 1]?.level ?? 0;
    return nextLevel > currentLevel;
}

function getVisibleOutlineItems(
    items: ReturnType<typeof parseOutline>,
    collapsedKeys: Set<string>
) {
    const hiddenLevels: number[] = [];

    return items.filter((item) => {
        while (hiddenLevels.length > 0 && item.level <= hiddenLevels[hiddenLevels.length - 1]) {
            hiddenLevels.pop();
        }

        if (hiddenLevels.length > 0) {
            return false;
        }

        if (collapsedKeys.has(getOutlineKey(item.title, item.lineNumber))) {
            hiddenLevels.push(item.level);
        }

        return true;
    });
}

function OutlineSection({
                            activeNote,
                            activeNoteContent,
                            onNavigate,
                            t,
                        }: {
    activeNote: { path: string } | null;
    activeNoteContent?: string;
    onNavigate: (lineNumber: number) => void;
    t: (key: string, values?: Record<string, unknown>) => string;
}) {
    const outlineItems = useMemo(() => parseOutline(activeNoteContent ?? ""), [activeNoteContent]);
    const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());
    const visibleOutlineItems = useMemo(
        () => getVisibleOutlineItems(outlineItems, collapsedKeys),
        [outlineItems, collapsedKeys]
    );

    useEffect(() => {
        setCollapsedKeys(new Set());
    }, [activeNote?.path, activeNoteContent]);

    function toggleCollapsed(itemTitle: string, lineNumber: number) {
        const key = getOutlineKey(itemTitle, lineNumber);
        setCollapsedKeys((current) => {
            const next = new Set(current);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    }

    return (
        <section className="space-y-4">
            <SidebarSectionHeader
                title={t("rightSidebar.outline")}
                icon={<List size={SIDEBAR_ICON_SIZE} style={{ ...SIDEBAR_ICON_STYLE, color: theme.colors.text.muted, marginRight: "1rem" }} />}
            />
            {!activeNote ? (
                <EmptyState>{t("rightSidebar.selectNoteForOutline")}</EmptyState>
            ) : outlineItems.length === 0 ? (
                <EmptyState>{t("rightSidebar.noHeaders")}</EmptyState>
            ) : (
                <div className="space-y-1" style={{ padding: "1rem" }}>
                    {visibleOutlineItems.map((item) => {
                        const outlineIndex = outlineItems.findIndex(
                            (outlineItem) =>
                                outlineItem.lineNumber === item.lineNumber && outlineItem.title === item.title
                        );
                        const canCollapse = hasNestedChildren(outlineItems, outlineIndex);
                        const isCollapsed = collapsedKeys.has(getOutlineKey(item.title, item.lineNumber));

                        return (
                            <div
                                key={`${item.kind}-${item.lineNumber}-${item.title}`}
                                className="flex items-center gap-1"
                                style={{ paddingLeft: getOutlineIndent(item.level) }}
                            >
                                {canCollapse ? (
                                    <button
                                        type="button"
                                        aria-label={isCollapsed ? t("rightSidebar.expandSection", { title: item.title }) : t("rightSidebar.collapseSection", { title: item.title })}
                                        onClick={() => toggleCollapsed(item.title, item.lineNumber)}
                                        className="flex h-5 w-5 items-center justify-center rounded-md transition-colors hover:bg-[color:var(--color-background-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)]"
                                        style={{ color: theme.colors.text.muted }}
                                    >
                                        {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                                    </button>
                                ) : (
                                    <span className="h-5 w-5 shrink-0" aria-hidden="true" />
                                )}
                                <button
                                    type="button"
                                    onClick={() => onNavigate(item.lineNumber)}
                                    className="flex-1 rounded-lg text-left text-[0.75rem] transition-all duration-150 hover:bg-[color:var(--color-background-secondary)] hover:text-[color:var(--color-text-primary)] hover:shadow-sm hover:translate-x-1 focus-visible:bg-[color:var(--color-background-secondary)] focus-visible:text-[color:var(--color-text-primary)] focus-visible:shadow-sm focus-visible:translate-x-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)]"
                                    style={{
                                        color: theme.colors.text.muted,
                                        paddingTop: "0.375rem",
                                        paddingRight: "0.5rem",
                                        paddingBottom: "0.375rem",
                                        paddingLeft: "0.25rem",
                                    }}
                                >
                                    {item.title}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

export function RightSidebar() {
    const { activeNote, activeNoteContent, files, isRightSidebarOpen } = useEditorStore();
    const app = useTessellumApp();
    const { t } = useAppTranslation("core");
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
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                    overflowX: "hidden",
                    opacity: isRightSidebarOpen ? 1 : 0,
                    transform: isRightSidebarOpen ? "translateX(0)" : "translateX(8px)",
                }}
            >
                <BacklinksSection
                    activeNote={activeNote}
                    backlinks={backlinks}
                    isLoading={isLoadingBacklinks}
                    onOpen={(path) => app.workspace.openNote(path)}
                    t={t}
                />
                <TagsSection activeNote={activeNote} tags={allTags} t={t} />
                <OutlineSection
                    activeNote={activeNote}
                    activeNoteContent={activeNoteContent}
                    onNavigate={(lineNumber) => {
                        app.editor.navigateToLine(lineNumber);
                    }}
                    t={t}
                />
            </div>
        </BaseSidebar>
    );
}
