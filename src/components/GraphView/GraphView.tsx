import { useEffect, useState, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useGraphDataStore, useGraphStore, useVaultStore } from "../../stores";
import { GraphCanvas } from './GraphCanvas';
import { NodeInfoPanel } from './NodeInfoPanel';
import { GraphQueryPanel } from './GraphQueryPanel';
import { GraphLegend } from './GraphLegend';
import { GraphZoomControls } from './GraphZoomControls';
import { ArrowLeft, GitFork, Grid2x2 } from 'lucide-react';
import cytoscape from 'cytoscape';
import { mapGraphDataToElements, GraphData } from "../../utils/graphUtils.ts";
import { computeTagClusters } from "../../utils/graphStats";
import { createNoteInDir } from "../../utils/noteUtils";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { normalizeCypherQuery } from "../../lib/cypherQueryNormalizer";
import { useAppTranslation } from "../../i18n/react.tsx";

type QueryRow = Record<string, unknown>;

function extractMatchingNodeIds(rows: QueryRow[], graphData: GraphData): Set<string> {
    const idsFromColumns = new Set<string>();
    const graphNodeIds = new Set(graphData.nodes.map((node) => node.id));

    for (const row of rows) {
        for (const cell of Object.values(row)) {
            // Handle string values (e.g., when query returns n.id)
            if (typeof cell === "string" && graphNodeIds.has(cell)) {
                idsFromColumns.add(cell);
            }
            // Handle object/node values (e.g., when query returns full node n)
            else if (cell && typeof cell === "object" && "id" in cell) {
                const id = (cell as { id: unknown }).id;
                if (typeof id === "string" && graphNodeIds.has(id)) {
                    idsFromColumns.add(id);
                }
            }
        }
    }

    return idsFromColumns;
}

export function GraphView() {
    const { t } = useAppTranslation("core");
    const { vaultPath, files, setActiveNote, addFileIfMissing } = useVaultStore();
    const { setViewMode, selectedGraphNode, setSelectedGraphNode, graphMode, setGraphMode, graphFilter, setGraphFilter } = useGraphStore();
    const {
        graphData,
        isFetching: loading,
        setGraphData,
        markStale,
        setFetching,
        setError,
        clearForVaultChange,
    } = useGraphDataStore();

    const [elements, setElements] = useState<cytoscape.ElementDefinition[]>([]);
    const [query, setQuery] = useState('');
    const [queryError, setQueryError] = useState<string | null>(null);
    const [isCypherRunning, setIsCypherRunning] = useState(false);
    const debouncedQuery = useDebouncedValue(query, 250);
    const [fileChangeTick, setFileChangeTick] = useState(0);
    const debouncedFileChangeTick = useDebouncedValue(fileChangeTick, 250);
    const latestQueryRequestIdRef = useRef(0);
    const cyRef = useRef<cytoscape.Core | null>(null);

    useEffect(() => {
        clearForVaultChange(vaultPath);
    }, [vaultPath, clearForVaultChange]);

    const fetchGraphData = useCallback(async () => {
        if (!vaultPath) {
            setElements([]);
            setFetching(false);
            return;
        }
        // Cache hit: use it, skip the invoke
        const state = useGraphDataStore.getState();
        if (state.graphData && state.cachedForVault === vaultPath && !state.isStale) {
            setFetching(false);
            return;
        }
        setFetching(true);
        try {
            const data = await invoke<GraphData>('get_graph_data', { vaultPath });
            setGraphData(data, vaultPath);
        } catch (e) {
            console.error('Failed to fetch graph data:', e);
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setFetching(false);
        }
    }, [vaultPath, setGraphData, setError, setFetching]);

    useEffect(() => {
        fetchGraphData();
    }, [fetchGraphData]);

    useEffect(() => {
        const unlistenPromise = listen('file-changed', () => {
            setFileChangeTick((t) => t + 1);
        });
        return () => {
            unlistenPromise.then((unlisten) => unlisten());
        };
    }, []);

    useEffect(() => {
        if (debouncedFileChangeTick === 0) return;
        markStale();
        fetchGraphData();
    }, [debouncedFileChangeTick, markStale, fetchGraphData]);

    const handleNodeClick = useCallback(
        (nodeId: string) => {
            setSelectedGraphNode(nodeId || null);
        },
        [setSelectedGraphNode]
    );

    const MEDIA_EXTENSIONS = new Set([
        'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico',
        'pdf', 'mp4', 'mov', 'avi', 'mkv', 'webm', 'mp3', 'ogg', 'wav',
    ]);

    const handleNodeDoubleClick = useCallback(
        async (nodeId: string) => {
            const existingFile = files.find((f) => f.path === nodeId);

            if (existingFile) {
                setActiveNote(existingFile);
                setViewMode('editor');
            } else {
                if (!vaultPath) return;

                const normalizedId = nodeId.replace(/\\/g, '/');
                const parts = normalizedId.split('/');
                const filename = parts[parts.length - 1];
                const ext = filename.includes('.')
                    ? filename.split('.').pop()?.toLowerCase() ?? ''
                    : '';

                // Ghost node for a missing media asset — do not create a Markdown file.
                if (ext && MEDIA_EXTENSIONS.has(ext)) {
                    console.warn(`Graph: ghost node "${filename}" is a media asset — skipping note creation`);
                    return;
                }

                try {
                    const title = filename.replace(/\.md$/i, '');
                    // Preserve folder prefix: create note inside the same directory as
                    // the ghost link (e.g. [[Projects/Idea]] → vault/Projects/Idea.md)
                    const targetDir = parts.length > 1
                        ? `${vaultPath}/${parts.slice(0, -1).join('/')}`
                        : vaultPath;

                    const newNote = await createNoteInDir(targetDir, title);
                    addFileIfMissing(newNote);
                    setActiveNote(newNote);
                    setViewMode('editor');
                } catch (e) {
                    console.error('Failed to create note:', e);
                }
            }
        },
        [files, vaultPath, setActiveNote, setViewMode, addFileIfMissing]
    );

    // Handle graphData changes (display full graph when no query is active)
    useEffect(() => {
        if (!graphData) {
            setElements([]);
            return;
        }

        // Only update display if there's no active query
        if (!debouncedQuery.trim()) {
            setElements(mapGraphDataToElements(graphData));
        }
    }, [graphData, debouncedQuery]);

    // Handle query execution (only when query text changes)
    useEffect(() => {
        const trimmed = debouncedQuery.trim();

        // If no query, clear error and return (graphData effect handles display)
        if (!trimmed) {
            setQueryError(null);
            setIsCypherRunning(false);
            return;
        }

        // Guard against no graphData
        if (!graphData) {
            return;
        }

        const requestId = latestQueryRequestIdRef.current + 1;
        latestQueryRequestIdRef.current = requestId;

        const executeQuery = async (): Promise<void> => {
            setIsCypherRunning(true);
            try {
                const normalizedQuery = normalizeCypherQuery(trimmed);
                const rows = await invoke<QueryRow[]>("execute_graph_query", { cypher: normalizedQuery });
                if (latestQueryRequestIdRef.current !== requestId) {
                    return;
                }

                const normalizedRows = Array.isArray(rows) ? rows : [];
                const matchingNodeIds = extractMatchingNodeIds(normalizedRows, graphData);

                if (matchingNodeIds.size === 0) {
                    setElements([]);
                    setQueryError("Query returned no matching graph nodes.");
                    return;
                }

                const filteredNodes = graphData.nodes.filter((node) => matchingNodeIds.has(node.id));
                const filteredEdges = graphData.edges.filter(
                    (edge) => matchingNodeIds.has(edge.source) && matchingNodeIds.has(edge.target)
                );
                setElements(mapGraphDataToElements({ nodes: filteredNodes, edges: filteredEdges }));
                setQueryError(null);
            } catch (error) {
                if (latestQueryRequestIdRef.current !== requestId) {
                    return;
                }
                setElements([]);
                setQueryError(error instanceof Error ? error.message : String(error));
            } finally {
                if (latestQueryRequestIdRef.current === requestId) {
                    setIsCypherRunning(false);
                }
            }
        };

        executeQuery();
    }, [debouncedQuery]);

    return (
        <div className="w-full h-full relative flex flex-col">
            <div
                className="flex items-center gap-4 shrink-0"
                style={{
                    height: 52,
                    padding: "0 18px",
                    background: "var(--color-bg-app)",
                    borderBottom: "1px solid var(--color-border-light)",
                }}
            >
                {/* Back button */}
                <button
                    onClick={() => setViewMode('editor')}
                    style={{
                        display: "flex", alignItems: "center", gap: 7,
                        padding: "6px 11px",
                        border: "1px solid var(--color-border-light)",
                        background: "var(--color-bg-elevated)",
                        color: "var(--color-text-tertiary)",
                        borderRadius: 8,
                        fontSize: 12.5, fontWeight: 500,
                        fontFamily: "var(--font-sans)", cursor: "pointer",
                    }}
                >
                    <ArrowLeft size={14} />
                    {t("graph.backToEditor")}
                </button>

                {/* Title + stats subtitle */}
                <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)" }}>
                        {t("graph.graphView")}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>
                        {graphData
                            ? `${t("graph.notesCount", { count: graphData.nodes.length })} · ${t("graph.tagClusters", { count: computeTagClusters(graphData.nodes).length })}`
                            : ""}
                    </span>
                </div>

                {/* Mosaic / Network segmented control */}
                <div
                    style={{
                        display: "flex", alignItems: "center", gap: 2,
                        background: "var(--color-bg-panel, var(--color-bg-secondary))",
                        border: "1px solid var(--color-border-light)",
                        borderRadius: 9, padding: 2, marginLeft: 6,
                    }}
                >
                    {(["mosaic", "network"] as const).map((m) => {
                        const active = graphMode === m;
                        return (
                            <button
                                key={m}
                                type="button"
                                onClick={() => setGraphMode(m)}
                                aria-pressed={active}
                                style={{
                                    display: "flex", alignItems: "center", gap: 6,
                                    padding: "5px 11px",
                                    border: "none", borderRadius: 7,
                                    fontSize: 11.5, fontWeight: 600,
                                    fontFamily: "var(--font-sans)", cursor: "pointer",
                                    background: active ? "var(--color-bg-elevated)" : "transparent",
                                    color: active ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                                    boxShadow: active ? "var(--shadow-sm)" : "none",
                                }}
                            >
                                {m === "mosaic" ? <Grid2x2 size={13} /> : <GitFork size={13} />}
                                {t(`graph.${m}Mode`)}
                            </button>
                        );
                    })}
                </div>

                <div style={{ flex: 1 }} />

                {/* Filter chips */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {(["all", "orphans", "unresolved"] as const).map((f) => {
                        const active = graphFilter === f;
                        return (
                            <button
                                key={f}
                                type="button"
                                onClick={() => setGraphFilter(f)}
                                aria-pressed={active}
                                style={{
                                    fontSize: 11, fontWeight: active ? 600 : 500,
                                    color: active ? "var(--color-accent-default)" : "var(--color-text-tertiary)",
                                    background: active ? "var(--color-accent-soft)" : "var(--color-bg-panel, var(--color-bg-secondary))",
                                    border: active
                                        ? "1px solid color-mix(in srgb, var(--color-accent-default) 22%, transparent)"
                                        : "1px solid var(--color-border-light)",
                                    borderRadius: 20, padding: "3px 11px",
                                    cursor: "pointer",
                                }}
                            >
                                {t(`graph.filter${f.charAt(0).toUpperCase() + f.slice(1)}`)}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="flex-1 relative">
                {loading ? (
                    <div className="flex items-center justify-center h-full text-[var(--color-text-muted)] text-sm">
                        {t("graph.loadingGraph")}
                    </div>
                ) : elements.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-[var(--color-text-muted)] text-sm">
                        {t("graph.noGraphData")}
                    </div>
                ) : (
                    <GraphCanvas
                        elements={elements}
                        mode="global"
                        selectedNodeId={selectedGraphNode ?? undefined}
                        onNodeClick={handleNodeClick}
                        onNodeDoubleClick={handleNodeDoubleClick}
                        initialPositions={useGraphDataStore.getState().nodePositions}
                        onPositionsStable={useGraphDataStore.getState().setNodePositions}
                        onCyReady={(cy) => (cyRef.current = cy)}
                    />
                )}

                <GraphLegend graphData={graphData} />
                <GraphZoomControls cy={cyRef.current} />

                <GraphQueryPanel
                    query={query}
                    onChange={setQuery}
                    error={queryError}
                    isRunning={isCypherRunning}
                />

                {selectedGraphNode && (() => {
                    const nodeElement = elements.find(e => e.data?.id === selectedGraphNode);
                    const tags = nodeElement?.data?.tags as string[] | undefined;
                    return (
                        <NodeInfoPanel
                            nodePath={selectedGraphNode}
                            tags={tags}
                            onClose={() => setSelectedGraphNode(null)}
                        />
                    );
                })()}
            </div>
        </div>
    );
}
