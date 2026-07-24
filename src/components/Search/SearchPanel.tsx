import { Search, SearchX, X, File, Folder, Clock, Hash, ArrowRight, History } from "lucide-react";
import { useEffect, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";
import { theme } from "../../styles/theme";
import { invoke } from "@tauri-apps/api/core";
import { useSearchStore, useVaultStore } from "../../stores";
import { useTessellumApp } from "../../plugins/TessellumApp";
import { IconButton, Kbd } from "../ui";
import { stringToColor } from "../../utils/graphUtils";

interface SearchPanelProps {
    onClose: () => void;
}

type SearchResult =
    | {
    type: "note";
    title: string;
    path: string;
    fullPath: string;
    preview: string;
    tags: string[];
}
    | {
    type: "folder";
    title: string;
    path: string;
    itemCount: number;
}
    | {
    type: "tag";
    title: string;
    noteCount: number;
};

interface TagFilter {
    tags: string[];
    match_mode: "All" | "Any";
}

interface FullTextSearchRequest {
    query: string;
    limit?: number;
    offset?: number;
    include_snippets?: boolean;
    tag_filter?: TagFilter;
}

interface SearchHit {
    path: string;
    relative_path: string;
    title: string;
    score: number;
    snippet?: string | null;
    tags: string[];
}

interface FullTextSearchResponse {
    total: number;
    hits: SearchHit[];
}

const panelStyle: CSSProperties = {
    width: "100%",
    minWidth: 256,
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    borderRight: `1px solid ${theme.colors.border.light}`,
    backgroundColor: theme.colors.background.primary,
};

const inputRowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing[2],
    padding: "10px 14px",
    borderBottom: `1px solid ${theme.colors.border.light}`,
};

const inputStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.primary,
};

const resultsContainerStyle: CSSProperties = {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    padding: theme.spacing[2],
    scrollbarGutter: "stable",
};

const sectionLabelStyle: CSSProperties = {
    fontSize: "0.625rem",
    fontWeight: theme.typography.fontWeight.bold,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: theme.colors.text.muted,
};

const footerStyle: CSSProperties = {
    borderTop: `1px solid ${theme.colors.border.light}`,
    padding: "9px 14px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
};

const footerHintRowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing[3],
};

const footerSyntaxRowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing[3],
    fontSize: "0.625rem",
    color: theme.colors.text.muted,
};

const emptyStateWrapStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing[2],
    padding: `${theme.spacing[8]} ${theme.spacing[4]}`,
    color: theme.colors.text.muted,
    textAlign: "center",
};

const emptyStateIconWrapStyle: CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    backgroundColor: "color-mix(in srgb, var(--color-text-primary) 6%, transparent)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: theme.colors.text.muted,
};

const emptyStateTitleStyle: CSSProperties = {
    fontSize: "0.8125rem",
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.secondary,
};

function createResultCardStyle(isActive: boolean): CSSProperties {
    return {
        padding: "0.625rem 0.75rem",
        borderRadius: theme.borderRadius.lg,
        border: `1px solid ${isActive ? theme.colors.border.light : "transparent"}`,
        backgroundColor: isActive ? theme.colors.background.secondary : "transparent",
        transition: theme.transitions.fast,
        cursor: "pointer",
    };
}

/** Hash-based tag pill styling — mirrors `getTagStyles` in RightSidebar.tsx /
 * NotePropertiesPanel's status dot so the same tag renders in the same color
 * everywhere in the app. */
function getTagPillStyle(tag: string): CSSProperties {
    const { h } = stringToColor(tag.replace(/^#/, ""));
    const saturation = "70%";
    const lightnessBg = "60%";
    const lightnessText = "50%";
    return {
        backgroundColor: `hsla(${h}, ${saturation}, ${lightnessBg}, 0.15)`,
        color: `hsl(${h}, ${saturation}, ${lightnessText})`,
        border: `1px solid hsla(${h}, ${saturation}, ${lightnessBg}, 0.3)`,
        borderRadius: theme.borderRadius.full,
        padding: "0.125rem 0.5rem",
        fontSize: "0.625rem",
        fontWeight: theme.typography.fontWeight.semibold,
    };
}

function clampTwoLinesStyle(): CSSProperties {
    return {
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
    };
}

function normalizeTag(tag: string): string {
    return tag.trim().replace(/^#/, "").toLowerCase();
}

function escapeTantivyTerm(term: string): string {
    // Escape characters that have special meaning in Tantivy's query parser so
    // queries like "c++" or "(algorithm)" don't silently return zero results.
    return term.replace(/[+\-:!"()\[\]{}^~*?\\]/g, "\\$&");
}

function splitQuery(query: string) {
    const parts = query.split(/\s+/).filter(Boolean);
    const tags: string[] = [];
    const terms: string[] = [];
    parts.forEach((part) => {
        if (part.startsWith("#")) {
            const normalized = normalizeTag(part);
            if (normalized) tags.push(normalized);
            return;
        }
        if (part.startsWith("content:")) {
            const raw = part.slice("content:".length);
            if (raw) terms.push(escapeTantivyTerm(raw));
            return;
        }
        terms.push(escapeTantivyTerm(part));
    });
    return { terms, tags };
}

function mapHitToResult(hit: SearchHit): SearchResult {
    const tags = hit.tags?.map((tag) => `#${tag}`) ?? [];
    return {
        type: "note",
        title: hit.title,
        path: hit.relative_path,
        fullPath: hit.path,
        preview: hit.snippet ?? "",
        tags,
    };
}

export function SearchPanel({ onClose }: SearchPanelProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { vaultPath } = useVaultStore();
    const {
        recentSearches,
        addRecentSearch,
        loadRecentSearches,
        readinessStatus,
        readinessAttemptCount,
        readinessRetryDelayMs,
        readinessReopenRequired,
        syncReadiness,
        ensureReadiness,
    } = useSearchStore();
    const app = useTessellumApp();

    useEffect(() => {
        loadRecentSearches(vaultPath ?? undefined);
    }, [loadRecentSearches, vaultPath]);

    useEffect(() => {
        if (!vaultPath) {
            setResults([]);
            return;
        }

        let cancelled = false;
        const fetchReadiness = async () => {
            try {
                if (!cancelled) {
                    await syncReadiness(vaultPath);
                }
            } catch (e) {
                console.error(e);
            }
        };

        void fetchReadiness();
        return () => {
            cancelled = true;
        };
    }, [syncReadiness, vaultPath]);

    useEffect(() => {
        if (!vaultPath || readinessStatus === "ready" || readinessReopenRequired) {
            return;
        }

        const handle = window.setTimeout(async () => {
            try {
                await ensureReadiness(vaultPath);
            } catch (e) {
                console.error(e);
            }
        }, readinessRetryDelayMs);

        return () => {
            window.clearTimeout(handle);
        };
    }, [ensureReadiness, readinessAttemptCount, readinessReopenRequired, readinessRetryDelayMs, readinessStatus, vaultPath]);

    useEffect(() => {
        if (!vaultPath) {
            setResults([]);
            setError(null);
            return;
        }

        const trimmed = searchQuery.trim();
        if (!trimmed) {
            setResults([]);
            setError(null);
            return;
        }

        if (readinessStatus !== "ready") {
            setResults([]);
            setError(readinessReopenRequired ? "Reopen search to retry." : "Preparing search index...");
            return;
        }

        const handle = setTimeout(async () => {
            setIsLoading(true);
            setError(null);
            try {
                const { terms, tags } = splitQuery(trimmed);
                const query = terms.join(" ");

                const payload: FullTextSearchRequest = {
                    query,
                    limit: 50,
                    offset: 0,
                    include_snippets: true,
                    tag_filter: tags.length
                        ? { tags, match_mode: "All" }
                        : undefined,
                };

                const response = await invoke<FullTextSearchResponse>("search_full_text", { vaultPath, request: payload });
                setResults(response.hits.map(mapHitToResult));
                addRecentSearch(trimmed, vaultPath);
            } catch (e) {
                console.error(e);
                setError("Search failed");
            } finally {
                setIsLoading(false);
            }
        }, 200);

        return () => clearTimeout(handle);
    }, [addRecentSearch, readinessReopenRequired, readinessStatus, searchQuery, vaultPath]);

    // Keep the keyboard-navigable selection in bounds whenever the result set changes.
    useEffect(() => {
        setActiveIndex(results.length > 0 ? 0 : null);
    }, [results]);

    function openResult(result: SearchResult | undefined) {
        if (result?.type === "note") {
            app.workspace.openNote(result.fullPath);
        }
    }

    function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
        if (event.key === "Escape") {
            event.preventDefault();
            onClose();
            return;
        }
        if (results.length === 0) return;
        if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((prev) => (prev === null ? 0 : Math.min(prev + 1, results.length - 1)));
            return;
        }
        if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((prev) => (prev === null ? 0 : Math.max(prev - 1, 0)));
            return;
        }
        if (event.key === "Enter") {
            event.preventDefault();
            openResult(activeIndex !== null ? results[activeIndex] : undefined);
        }
    }

    const trimmedQuery = searchQuery.trim();
    const isIdle = trimmedQuery.length === 0;
    const showNoResults =
        !isIdle && !isLoading && !error && readinessStatus === "ready" && results.length === 0;

    return (
        <div style={panelStyle}>
            <div style={inputRowStyle}>
                <Search style={{ width: "1rem", height: "1rem", color: theme.colors.text.tertiary, flexShrink: 0 }} />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    onKeyDown={handleInputKeyDown}
                    placeholder="Search notes, tags, and folders…"
                    style={inputStyle}
                    autoFocus
                />
                <Kbd>Esc</Kbd>
                <IconButton label="Close search" onClick={onClose}>
                    <X style={{ width: "0.875rem", height: "0.875rem" }} />
                </IconButton>
            </div>

            <div style={resultsContainerStyle}>
                {readinessReopenRequired && (
                    <div
                        style={{
                            margin: "0.5rem 0.75rem",
                            padding: "0.5rem 0.625rem",
                            borderRadius: theme.borderRadius.md,
                            border: `1px solid ${theme.colors.border.light}`,
                            backgroundColor: theme.colors.background.secondary,
                            color: theme.colors.text.muted,
                            fontSize: "0.6875rem",
                        }}
                    >
                        Reopen search to retry.
                    </div>
                )}
                {isIdle ? (
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: theme.spacing[2], padding: "0.5rem 0.75rem" }}>
                            <History style={{ width: "0.875rem", height: "0.875rem", color: theme.colors.text.muted }} />
                            <span style={sectionLabelStyle}>Recent Searches</span>
                        </div>
                        {recentSearches.length === 0 ? (
                            <div style={emptyStateWrapStyle}>
                                <div style={emptyStateIconWrapStyle}>
                                    <Search style={{ width: "1.125rem", height: "1.125rem" }} />
                                </div>
                                <p style={{ fontSize: "0.75rem" }}>Start typing to search your vault.</p>
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
                                {recentSearches.map((search) => (
                                    <button
                                        key={search}
                                        onClick={() => setSearchQuery(search)}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: theme.spacing[2],
                                            padding: "0.5rem 0.75rem",
                                            borderRadius: theme.borderRadius.md,
                                            border: "none",
                                            backgroundColor: "transparent",
                                            color: theme.colors.text.secondary,
                                            cursor: "pointer",
                                            textAlign: "left",
                                            transition: theme.transitions.fast,
                                        }}
                                        onMouseEnter={(event) => {
                                            event.currentTarget.style.backgroundColor = theme.colors.background.secondary;
                                        }}
                                        onMouseLeave={(event) => {
                                            event.currentTarget.style.backgroundColor = "transparent";
                                        }}
                                    >
                                        <Clock style={{ width: "0.875rem", height: "0.875rem", color: theme.colors.text.muted }} />
                                        <span style={{ fontSize: theme.typography.fontSize.sm, flex: 1 }}>{search}</span>
                                        <ArrowRight style={{ width: "0.75rem", height: "0.75rem", color: theme.colors.text.muted }} />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ) : showNoResults ? (
                    <div style={emptyStateWrapStyle}>
                        <div style={emptyStateIconWrapStyle}>
                            <SearchX style={{ width: "1.125rem", height: "1.125rem" }} />
                        </div>
                        <p style={emptyStateTitleStyle}>No notes match your search</p>
                    </div>
                ) : (
                    <div>
                        <div style={{ padding: "0.5rem 0.75rem" }}>
                            <span style={sectionLabelStyle}>
                                {isLoading
                                    ? "Searching"
                                    : readinessStatus !== "ready"
                                        ? "Preparing index"
                                        : `${results.length} ${results.length === 1 ? "Result" : "Results"}`}
                            </span>
                            {error && (
                                <div style={{ marginTop: theme.spacing[1], fontSize: "0.625rem", color: theme.colors.text.muted }}>
                                    {error}
                                </div>
                            )}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing[2] }}>
                            {results.map((result, idx) => {
                                const isActive = activeIndex === idx;
                                return (
                                    <div
                                        key={`${result.type}-${result.title}-${"path" in result ? result.path : ""}`}
                                        style={createResultCardStyle(isActive)}
                                        onMouseEnter={() => setActiveIndex(idx)}
                                        onClick={() => openResult(result)}
                                    >
                                        {result.type === "note" && (
                                            <>
                                                <div style={{ display: "flex", gap: theme.spacing[2], marginBottom: "0.375rem" }}>
                                                    <File style={{ width: "0.875rem", height: "0.875rem", color: theme.colors.accent.default, marginTop: "0.25rem", flexShrink: 0 }} />
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <p
                                                            style={{
                                                                fontSize: "13.5px",
                                                                fontWeight: theme.typography.fontWeight.semibold,
                                                                color: isActive ? theme.colors.accent.default : theme.colors.text.primary,
                                                                transition: theme.transitions.fast,
                                                                whiteSpace: "nowrap",
                                                                overflow: "hidden",
                                                                textOverflow: "ellipsis",
                                                            }}
                                                        >
                                                            {result.title}
                                                        </p>
                                                        <p
                                                            style={{
                                                                fontSize: "11px",
                                                                color: theme.colors.text.muted,
                                                                whiteSpace: "nowrap",
                                                                overflow: "hidden",
                                                                textOverflow: "ellipsis",
                                                            }}
                                                        >
                                                            {result.path}
                                                        </p>
                                                    </div>
                                                </div>
                                                {result.preview && (
                                                    <p
                                                        style={{
                                                            fontSize: "0.75rem",
                                                            color: theme.colors.text.secondary,
                                                            lineHeight: theme.typography.lineHeight.relaxed,
                                                            marginBottom: "0.5rem",
                                                            ...clampTwoLinesStyle(),
                                                        }}
                                                    >
                                                        {result.preview}
                                                    </p>
                                                )}
                                                {result.tags.length > 0 && (
                                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                                                        {result.tags.map((tag) => (
                                                            <span key={tag} style={getTagPillStyle(tag)}>
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {result.type === "folder" && (
                                            <div style={{ display: "flex", alignItems: "center", gap: theme.spacing[2] }}>
                                                <Folder style={{ width: "0.875rem", height: "0.875rem", color: theme.colors.text.secondary }} />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <p
                                                        style={{
                                                            fontSize: "13.5px",
                                                            fontWeight: theme.typography.fontWeight.semibold,
                                                            color: isActive ? theme.colors.accent.default : theme.colors.text.primary,
                                                            transition: theme.transitions.fast,
                                                            whiteSpace: "nowrap",
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                        }}
                                                    >
                                                        {result.title}
                                                    </p>
                                                    <p style={{ fontSize: "11px", color: theme.colors.text.muted }}>
                                                        {result.itemCount} items
                                                    </p>
                                                </div>
                                                <ArrowRight
                                                    style={{
                                                        width: "0.75rem",
                                                        height: "0.75rem",
                                                        color: theme.colors.text.muted,
                                                        opacity: isActive ? 1 : 0,
                                                        transition: theme.transitions.fast,
                                                    }}
                                                />
                                            </div>
                                        )}

                                        {result.type === "tag" && (
                                            <div style={{ display: "flex", alignItems: "center", gap: theme.spacing[2] }}>
                                                <Hash style={{ width: "0.875rem", height: "0.875rem", color: theme.colors.accent.default }} />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <p
                                                        style={{
                                                            fontSize: "13.5px",
                                                            fontWeight: theme.typography.fontWeight.semibold,
                                                            color: theme.colors.accent.default,
                                                            whiteSpace: "nowrap",
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                        }}
                                                    >
                                                        {result.title}
                                                    </p>
                                                    <p style={{ fontSize: "11px", color: theme.colors.text.muted }}>
                                                        {result.noteCount} notes
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            <div style={footerStyle}>
                <div style={footerHintRowStyle}>
                    <Kbd>↑↓</Kbd>
                    <span style={{ fontSize: "0.625rem", color: theme.colors.text.muted }}>Navigate</span>
                    <Kbd>↵</Kbd>
                    <span style={{ fontSize: "0.625rem", color: theme.colors.text.muted }}>Open</span>
                </div>
                <div style={footerSyntaxRowStyle}>
                    <span>
                        <span style={{ fontFamily: theme.typography.fontFamily.mono, fontWeight: theme.typography.fontWeight.semibold, color: theme.colors.text.secondary }}>
                            #tag
                        </span>{" "}
                        search by tag
                    </span>
                    <span>
                        <span style={{ fontFamily: theme.typography.fontFamily.mono, fontWeight: theme.typography.fontWeight.semibold, color: theme.colors.text.secondary }}>
                            content:
                        </span>{" "}
                        search content
                    </span>
                </div>
            </div>
        </div>
    );
}
