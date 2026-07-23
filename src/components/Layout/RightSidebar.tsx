import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Text } from "@codemirror/state";
import { ChevronDown, ChevronRight, Link2, List, Tag, Sparkles } from "lucide-react";
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
import { getIgnoredTagLineNumbers, stripInlineCodeSpansForTagScan } from "../../utils/tagExtraction";
import { NotePropertiesPanel } from "../Sidebar/NotePropertiesPanel";
import { BacklinkSuggestions } from "../Sidebar/BacklinkSuggestions";
import { VaultQAPanel } from "../ai/VaultQAPanel";

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

function getTagStyles(tag: string) {
    const { h } = stringToColor(tag);
    const saturation = "70%";
    const lightnessBg = "60%";
    const lightnessText = "50%";
    return {
        backgroundColor: `hsla(${h}, ${saturation}, ${lightnessBg}, 0.15)`,
        color: `hsl(${h}, ${saturation}, ${lightnessText})`,
        border: `1px solid hsla(${h}, ${saturation}, ${lightnessBg}, 0.3)`,
        borderRadius: "20px",
        paddingLeft: "0.625rem",
        paddingRight: "0.625rem",
        paddingTop: "0.1875rem",
        paddingBottom: "0.1875rem",
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
    const ignoredLines = getIgnoredTagLineNumbers(body);
    const lines = body.split(/\r?\n/);
    const regex = /(?:^|\s)(#[a-zA-Z0-9_\-/]+)/g;

    for (let i = 0; i < lines.length; i += 1) {
        const lineNumber = i + 1;
        if (ignoredLines.has(lineNumber)) continue;

        const scanLine = stripInlineCodeSpansForTagScan(lines[i]);
        regex.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(scanLine)) !== null) {
            const normalized = normalizeTag(match[1]);
            if (normalized) tags.add(normalized);
        }
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

function SidebarSectionHeader({ title, icon, count }: { title: string; icon: ReactNode; count?: number }) {
    return (
        <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
                {icon}
                <h3
                    className="truncate"
                    style={{
                        fontSize: "10.5px",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.11em",
                        color: theme.colors.text.muted,
                    }}
                >
                    {title}
                </h3>
            </div>
            {typeof count === "number" && (
                <span
                    className="shrink-0 text-center"
                    style={{
                        fontSize: "10.5px",
                        fontWeight: 600,
                        color: theme.colors.text.muted,
                        background: theme.colors.background.app,
                        border: `1px solid ${theme.colors.border.light}`,
                        borderRadius: "20px",
                        padding: "1px 7px",
                        minWidth: "1.25rem",
                    }}
                >
                    {count}
                </span>
            )}
        </div>
    );
}

function EmptyState({ children }: { children: ReactNode }) {
    return (
        <div className="text-[0.6875rem]" style={{ color: theme.colors.text.muted }}>
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
        <section className="space-y-3">
            <SidebarSectionHeader
                title={t("rightSidebar.backlinks")}
                icon={<Link2 size={13} style={{ color: theme.colors.text.muted }} />}
                count={activeNote && !isLoading ? backlinks.length : undefined}
            />
            {isLoading ? (
                <EmptyState>{t("rightSidebar.loadingBacklinks")}</EmptyState>
            ) : !activeNote ? (
                <EmptyState>{t("rightSidebar.selectNoteForBacklinks")}</EmptyState>
            ) : backlinks.length === 0 ? (
                <EmptyState>{t("rightSidebar.noBacklinks")}</EmptyState>
            ) : (
                <div className="flex flex-col gap-2">
                    {backlinks.map((item) => (
                        <button
                            key={item.path}
                            type="button"
                            className="w-full text-left transition-colors bg-[color:var(--color-bg-elevated)] hover:bg-[color:var(--color-bg-hover)]"
                            onClick={() => onOpen(item.path)}
                            style={{
                                borderRadius: "10px",
                                border: `1px solid ${theme.colors.border.light}`,
                                padding: "10px 11px",
                            }}
                        >
                            <p style={{ fontSize: "12.5px", fontWeight: 600, color: theme.colors.text.primary }}>
                                {item.label}.md
                            </p>
                            {item.snippet && (
                                <p
                                    className="leading-5"
                                    style={{ fontSize: "11.5px", color: theme.colors.text.tertiary, marginTop: "4px" }}
                                >
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
        <section className="space-y-3">
            <SidebarSectionHeader
                title={t("rightSidebar.tags")}
                icon={<Tag size={13} style={{ color: theme.colors.text.muted }} />}
                count={activeNote ? tags.length : undefined}
            />
            {!activeNote ? (
                <EmptyState>{t("rightSidebar.selectNoteForTags")}</EmptyState>
            ) : tags.length === 0 ? (
                <EmptyState>{t("rightSidebar.noTags")}</EmptyState>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                        <span
                            key={tag}
                            className="inline-flex gap-1.5 items-center text-[0.8125rem] font-medium"
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
        <section className="space-y-3">
            <SidebarSectionHeader
                title={t("rightSidebar.outline")}
                icon={<List size={13} style={{ color: theme.colors.text.muted }} />}
                count={activeNote ? outlineItems.length : undefined}
            />
            {!activeNote ? (
                <EmptyState>{t("rightSidebar.selectNoteForOutline")}</EmptyState>
            ) : outlineItems.length === 0 ? (
                <EmptyState>{t("rightSidebar.noHeaders")}</EmptyState>
            ) : (
                <div className="flex flex-col">
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
                                {/* guide-line rail + collapse toggle / dot marker, aligned per heading level */}
                                <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                                    <span
                                        aria-hidden="true"
                                        style={{
                                            position: "absolute",
                                            left: "50%",
                                            top: "-4px",
                                            bottom: "-4px",
                                            width: "1px",
                                            background: theme.colors.border.light,
                                            transform: "translateX(-50%)",
                                        }}
                                    />
                                    {canCollapse ? (
                                        <button
                                            type="button"
                                            aria-label={isCollapsed ? t("rightSidebar.expandSection", { title: item.title }) : t("rightSidebar.collapseSection", { title: item.title })}
                                            onClick={() => toggleCollapsed(item.title, item.lineNumber)}
                                            className="relative z-10 flex h-5 w-5 items-center justify-center rounded-md transition-colors bg-[color:var(--color-bg-secondary)] hover:bg-[color:var(--color-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)]"
                                            style={{ color: theme.colors.text.muted }}
                                        >
                                            {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                                        </button>
                                    ) : (
                                        <span
                                            className="relative z-10 shrink-0 rounded-full"
                                            style={{ width: 6, height: 6, background: theme.colors.text.secondary }}
                                            aria-hidden="true"
                                        />
                                    )}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => onNavigate(item.lineNumber)}
                                    className="flex-1 rounded-lg text-left text-[0.75rem] transition-colors text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-bg-hover)] hover:text-[color:var(--color-text-primary)] focus-visible:bg-[color:var(--color-bg-hover)] focus-visible:text-[color:var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)]"
                                    style={{
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
    const { activeNote, activeNoteContent, files, isRightSidebarOpen, setActiveNoteContent } = useEditorStore();
    const app = useTessellumApp();
    const { t } = useAppTranslation("core");
    const { sidebarWidth, isResizing, onResizeStart } = useSidebarWidth();
    const { backlinks, isLoadingBacklinks } = useBacklinks(app, activeNote?.path, files);
    const backendTags = useBackendTags(app, activeNote?.path);
    const [isQAOpen, setIsQAOpen] = useState(false);

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
                backgroundColor: theme.colors.background.secondary,
                borderColor: theme.colors.border.light,
                padding: 0,
                overflow: "visible",
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
                className="flex flex-col h-full transition-all duration-300 ease-in-out"
                style={{
                    opacity: isRightSidebarOpen ? 1 : 0,
                    transform: isRightSidebarOpen ? "translateX(0)" : "translateX(8px)",
                }}
            >
                {/* "Ask this vault" — full-width entry point into Vault Q&A. Hidden while
                    the Q&A panel itself is open since it renders its own header/close. */}
                {!isQAOpen && isRightSidebarOpen && (
                    <div style={{ padding: "16px 16px 12px" }}>
                        <button
                            type="button"
                            onClick={() => setIsQAOpen(true)}
                            title="Ask this vault"
                            className="flex w-full items-center justify-center gap-2 transition-colors bg-[color:var(--color-bg-elevated)] hover:bg-[color:var(--color-bg-hover)]"
                            style={{
                                borderRadius: "10px",
                                border: `1px solid ${theme.colors.border.light}`,
                                padding: "9px 12px",
                                fontSize: "12.5px",
                                fontWeight: 600,
                                color: theme.colors.text.secondary,
                            }}
                        >
                            <Sparkles size={14} style={{ color: theme.colors.accent.default }} />
                            Ask this vault
                        </button>
                    </div>
                )}

                {isQAOpen ? (
                    <div className="flex flex-1 flex-col" style={{ minHeight: 0 }}>
                        <VaultQAPanel onClose={() => setIsQAOpen(false)} />
                    </div>
                ) : (
                    <div
                        className="flex flex-col space-y-10"
                        style={{
                            flex: 1,
                            minHeight: 0,
                            overflowY: "auto",
                            overflowX: "hidden",
                            padding: "0 16px 16px",
                        }}
                    >
                        <NotePropertiesPanel
                            activeNotePath={activeNote?.path}
                            activeNoteContent={activeNoteContent}
                            onContentChange={setActiveNoteContent}
                        />
                        <BacklinksSection
                            activeNote={activeNote}
                            backlinks={backlinks}
                            isLoading={isLoadingBacklinks}
                            onOpen={(path) => app.workspace.openNote(path)}
                            t={t}
                        />
                        <BacklinkSuggestions
                            activeNotePath={activeNote?.path}
                            onOpen={(path) => app.workspace.openNote(path)}
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
                )}
            </div>
        </BaseSidebar>
    );
}
