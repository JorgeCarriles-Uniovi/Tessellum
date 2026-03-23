import { Search, X, File, Folder, Clock, Hash, ArrowRight, History } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { theme } from "../../styles/theme";
import { invoke } from "@tauri-apps/api/core";
import { useVaultStore } from "../../stores";

interface SearchPanelProps {
    onClose: () => void;
}

type SearchFilter = "all" | "notes" | "folders" | "tags";

type SearchResult =
    | {
    type: "note";
    title: string;
    path: string;
    preview: string;
    modified?: string;
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

interface TagSearchRequest {
    tags: string[];
    match_mode: "All" | "Any";
    limit?: number;
    offset?: number;
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

interface TagSearchResponse {
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
    boxShadow: theme.shadows.sm,
};

const headerStyle: CSSProperties = {
    height: 57,
    borderBottom: `1px solid ${theme.colors.border.light}`,
    padding: `0 ${theme.spacing[4]}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
};

const headerTitleStyle: CSSProperties = {
    fontSize: "0.875rem",
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    letterSpacing: "-0.02em",
};

const headerBadgeStyle: CSSProperties = {
    width: 24,
    height: 24,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.blue[600],
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
};

const iconButtonStyle: CSSProperties = {
    padding: theme.spacing[1],
    borderRadius: theme.borderRadius.md,
    border: "none",
    background: "transparent",
    color: theme.colors.text.muted,
    cursor: "pointer",
    transition: theme.transitions.fast,
};

const sectionDividerStyle: CSSProperties = {
    borderBottom: `1px solid ${theme.colors.border.light}`,
};

const inputWrapperStyle: CSSProperties = {
    padding: theme.spacing[4],
};

const inputContainerStyle: CSSProperties = {
    position: "relative",
};

const inputStyle: CSSProperties = {
    width: "100%",
    padding: "0.5rem 0.75rem 0.5rem 2.25rem",
    border: `1px solid ${theme.colors.border.light}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.primary,
    backgroundColor: theme.colors.background.primary,
    outline: "none",
    transition: theme.transitions.base,
};

const filterRowStyle: CSSProperties = {
    display: "flex",
    gap: theme.spacing[1],
    padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
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

const tipPanelStyle: CSSProperties = {
    borderTop: `1px solid ${theme.colors.border.light}`,
    padding: theme.spacing[4],
    backgroundColor: theme.colors.background.secondary,
};

const tipTextStyle: CSSProperties = {
    fontSize: "0.625rem",
    color: theme.colors.text.muted,
};

const recentSearches = [
    "DPPI architecture",
    "Sprint planning",
    "Backend refactor",
    "Quarterly goals",
];

function createFilterButtonStyle(isActive: boolean): CSSProperties {
    return {
        padding: "0.25rem 0.625rem",
        borderRadius: theme.borderRadius.md,
        fontSize: "0.625rem",
        fontWeight: theme.typography.fontWeight.bold,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        border: "none",
        cursor: "pointer",
        transition: theme.transitions.fast,
        backgroundColor: isActive ? theme.colors.blue[600] : "transparent",
        color: isActive ? "#fff" : theme.colors.text.muted,
    };
}

function createResultCardStyle(isHovered: boolean): CSSProperties {
    return {
        padding: "0.625rem 0.75rem",
        borderRadius: theme.borderRadius.lg,
        border: `1px solid ${isHovered ? theme.colors.border.light : "transparent"}`,
        backgroundColor: isHovered ? theme.colors.background.secondary : "transparent",
        transition: theme.transitions.fast,
        cursor: "pointer",
    };
}

function createTagPillStyle(): CSSProperties {
    return {
        padding: "0.125rem 0.375rem",
        borderRadius: theme.borderRadius.md,
        backgroundColor: "color-mix(in srgb, var(--color-blue-600) 12%, transparent)",
        color: theme.colors.blue[600],
        fontSize: "0.5625rem",
        fontWeight: theme.typography.fontWeight.bold,
        fontFamily: theme.typography.fontFamily.mono,
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

function splitQuery(query: string) {
    const parts = query.split(/\s+/).filter(Boolean);
    const tags: string[] = [];
    const terms: string[] = [];
    const pathTerms: string[] = [];
    parts.forEach((part) => {
        if (part.startsWith("#")) {
            const normalized = normalizeTag(part);
            if (normalized) tags.push(normalized);
            return;
        }
        if (part.startsWith("content:")) {
            const raw = part.slice("content:".length);
            if (raw) terms.push(raw);
            return;
        }
        if (part.startsWith("path:")) {
            const raw = part.slice("path:".length);
            if (raw) pathTerms.push(raw.toLowerCase());
            return;
        }
        terms.push(part);
    });
    return { terms, tags, pathTerms };
}

function mapHitToResult(hit: SearchHit): SearchResult {
    const tags = hit.tags?.map((tag) => `#${tag}`) ?? [];
    return {
        type: "note",
        title: hit.title,
        path: hit.relative_path,
        preview: hit.snippet ?? "",
        modified: "",
        tags,
    };
}

export function SearchPanel({ onClose }: SearchPanelProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [activeFilter, setActiveFilter] = useState<SearchFilter>("all");
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasPrimedIndex, setHasPrimedIndex] = useState(false);
    const { vaultPath } = useVaultStore();

    useEffect(() => {
        if (!vaultPath) {
            setResults([]);
            return;
        }

        const trimmed = searchQuery.trim();
        if (!trimmed) {
            setResults([]);
            setError(null);
            return;
        }

        const handle = setTimeout(async () => {
            setIsLoading(true);
            setError(null);
            try {
                if (!hasPrimedIndex) {
                    await invoke("sync_vault", { vaultPath });
                    await invoke("rebuild_search_index", { vaultPath });
                    setHasPrimedIndex(true);
                }
                const { terms, tags, pathTerms } = splitQuery(trimmed);
                const query = terms.join(" ");

                if (activeFilter === "tags") {
                    const tagRequest: TagSearchRequest = {
                        tags: tags.length ? tags : [normalizeTag(trimmed)],
                        match_mode: "Any",
                        limit: 50,
                        offset: 0,
                    };
                    const response = await invoke<TagSearchResponse>("search_tags", { vaultPath, request: tagRequest });
                    setResults(response.hits.map(mapHitToResult));
                    return;
                }

                if (activeFilter === "folders") {
                    setResults([]);
                    return;
                }

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
                let mapped = response.hits.map(mapHitToResult);
                if (pathTerms.length > 0) {
                    mapped = mapped.filter((item) => {
                        const haystack = item.path.toLowerCase();
                        return pathTerms.every((term) => haystack.includes(term));
                    });
                }
                setResults(mapped);
            } catch (e) {
                console.error(e);
                setError("Search failed");
            } finally {
                setIsLoading(false);
            }
        }, 200);

        return () => clearTimeout(handle);
    }, [activeFilter, searchQuery, vaultPath]);

    const filteredResults = useMemo(() => {
        return results.filter((result) => {
            if (activeFilter === "all") return true;
            if (activeFilter === "notes") return result.type === "note";
            if (activeFilter === "folders") return result.type === "folder";
            if (activeFilter === "tags") return result.type === "tag" || result.type === "note";
            return true;
        });
    }, [activeFilter, results]);

    return (
        <div style={panelStyle}>
            <div style={headerStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: theme.spacing[2] }}>
                    <div style={headerBadgeStyle}>
                        <Search style={{ width: "0.875rem", height: "0.875rem" }} />
                    </div>
                    <h1 style={headerTitleStyle}>Search</h1>
                </div>
                <button
                    onClick={onClose}
                    style={iconButtonStyle}
                    onMouseEnter={(e) => (e.currentTarget.style.background = theme.colors.background.secondary)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    aria-label="Close search"
                >
                    <X style={{ width: "0.875rem", height: "0.875rem" }} />
                </button>
            </div>

            <div style={{ ...sectionDividerStyle, ...inputWrapperStyle }}>
                <div style={inputContainerStyle}>
                    <Search
                        style={{
                            position: "absolute",
                            left: "0.75rem",
                            top: "50%",
                            transform: "translateY(-50%)",
                            width: "1rem",
                            height: "1rem",
                            color: theme.colors.text.muted,
                        }}
                    />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search notes, folders, tags..."
                        style={inputStyle}
                        autoFocus
                        onFocus={(event) => {
                            event.currentTarget.style.boxShadow = `0 0 0 2px ${theme.colors.blue[600]}`;
                            event.currentTarget.style.borderColor = "transparent";
                        }}
                        onBlur={(event) => {
                            event.currentTarget.style.boxShadow = "none";
                            event.currentTarget.style.borderColor = theme.colors.border.light;
                        }}
                    />
                </div>
            </div>

            <div style={{ ...sectionDividerStyle, ...filterRowStyle }}>
                {(["all", "notes", "folders", "tags"] as SearchFilter[]).map((filter) => (
                    <button
                        key={filter}
                        onClick={() => setActiveFilter(filter)}
                        style={createFilterButtonStyle(activeFilter === filter)}
                    >
                        {filter}
                    </button>
                ))}
            </div>

            <div style={resultsContainerStyle}>
                {searchQuery.trim().length === 0 ? (
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: theme.spacing[2], padding: "0.5rem 0.75rem" }}>
                            <History style={{ width: "0.875rem", height: "0.875rem", color: theme.colors.text.muted }} />
                            <span style={sectionLabelStyle}>Recent Searches</span>
                        </div>
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
                    </div>
                ) : (
                    <div>
                        <div style={{ padding: "0.5rem 0.75rem" }}>
                            <span style={sectionLabelStyle}>
                                {isLoading ? "Searching" : `${filteredResults.length} ${filteredResults.length === 1 ? "Result" : "Results"}`}
                            </span>
                            {error && (
                                <div style={{ marginTop: theme.spacing[1], fontSize: "0.625rem", color: theme.colors.text.muted }}>
                                    {error}
                                </div>
                            )}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing[2] }}>
                            {filteredResults.map((result, idx) => {
                                const isHovered = hoveredIndex === idx;
                                return (
                                    <div
                                        key={`${result.type}-${idx}`}
                                        style={createResultCardStyle(isHovered)}
                                        onMouseEnter={() => setHoveredIndex(idx)}
                                        onMouseLeave={() => setHoveredIndex(null)}
                                    >
                                        {result.type === "note" && (
                                            <>
                                                <div style={{ display: "flex", gap: theme.spacing[2], marginBottom: "0.375rem" }}>
                                                    <File style={{ width: "0.875rem", height: "0.875rem", color: theme.colors.blue[600], marginTop: "0.25rem" }} />
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <p
                                                            style={{
                                                                fontSize: theme.typography.fontSize.sm,
                                                                fontWeight: theme.typography.fontWeight.bold,
                                                                color: isHovered ? theme.colors.blue[600] : theme.colors.text.primary,
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
                                                                fontSize: "0.625rem",
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
                                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                                                        {result.tags.map((tag) => (
                                                            <span key={tag} style={createTagPillStyle()}>
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                    {result.modified ? (
                                                        <div
                                                            style={{
                                                                display: "flex",
                                                                alignItems: "center",
                                                                gap: "0.25rem",
                                                                fontSize: "0.5625rem",
                                                                color: theme.colors.text.muted,
                                                            }}
                                                        >
                                                            <Clock style={{ width: "0.625rem", height: "0.625rem" }} />
                                                            <span>{result.modified}</span>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </>
                                        )}

                                        {result.type === "folder" && (
                                            <div style={{ display: "flex", alignItems: "center", gap: theme.spacing[2] }}>
                                                <Folder style={{ width: "0.875rem", height: "0.875rem", color: theme.colors.text.secondary }} />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <p
                                                        style={{
                                                            fontSize: theme.typography.fontSize.sm,
                                                            fontWeight: theme.typography.fontWeight.bold,
                                                            color: isHovered ? theme.colors.blue[600] : theme.colors.text.primary,
                                                            transition: theme.transitions.fast,
                                                            whiteSpace: "nowrap",
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                        }}
                                                    >
                                                        {result.title}
                                                    </p>
                                                    <p style={{ fontSize: "0.625rem", color: theme.colors.text.muted }}>
                                                        {result.itemCount} items
                                                    </p>
                                                </div>
                                                <ArrowRight
                                                    style={{
                                                        width: "0.75rem",
                                                        height: "0.75rem",
                                                        color: theme.colors.text.muted,
                                                        opacity: isHovered ? 1 : 0,
                                                        transition: theme.transitions.fast,
                                                    }}
                                                />
                                            </div>
                                        )}

                                        {result.type === "tag" && (
                                            <div style={{ display: "flex", alignItems: "center", gap: theme.spacing[2] }}>
                                                <Hash style={{ width: "0.875rem", height: "0.875rem", color: theme.colors.blue[600] }} />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <p
                                                        style={{
                                                            fontSize: theme.typography.fontSize.sm,
                                                            fontWeight: theme.typography.fontWeight.bold,
                                                            color: theme.colors.blue[600],
                                                            whiteSpace: "nowrap",
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                        }}
                                                    >
                                                        {result.title}
                                                    </p>
                                                    <p style={{ fontSize: "0.625rem", color: theme.colors.text.muted }}>
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

            <div style={tipPanelStyle}>
                <div style={{ ...tipTextStyle, display: "flex", flexDirection: "column", gap: theme.spacing[1] }}>
                    <p style={{ ...sectionLabelStyle, marginBottom: theme.spacing[2] }}>Search Tips</p>
                    <p>
                        <span style={{ fontFamily: theme.typography.fontFamily.mono, fontWeight: theme.typography.fontWeight.bold, color: theme.colors.text.secondary }}>
                            #tag
                        </span>{" "}
                        - Search by tag
                    </p>
                    <p>
                        <span style={{ fontFamily: theme.typography.fontFamily.mono, fontWeight: theme.typography.fontWeight.bold, color: theme.colors.text.secondary }}>
                            path:
                        </span>{" "}
                        - Search in path
                    </p>
                    <p>
                        <span style={{ fontFamily: theme.typography.fontFamily.mono, fontWeight: theme.typography.fontWeight.bold, color: theme.colors.text.secondary }}>
                            content:
                        </span>{" "}
                        - Search content
                    </p>
                </div>
            </div>
        </div>
    );
}
