import { useEffect, useState, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useGraphStore, useVaultStore } from "../../stores";
import { GraphCanvas } from './GraphCanvas';
import { NodeInfoPanel } from './NodeInfoPanel';
import { GraphQueryPanel } from './GraphQueryPanel';
import { ArrowLeft } from 'lucide-react';
import cytoscape from 'cytoscape';
import { mapGraphDataToElements, GraphData } from "../../utils/graphUtils.ts";
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
    const { setViewMode, selectedGraphNode, setSelectedGraphNode } = useGraphStore();

    const [graphData, setGraphData] = useState<GraphData | null>(null);
    const [elements, setElements] = useState<cytoscape.ElementDefinition[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [queryError, setQueryError] = useState<string | null>(null);
    const [isCypherRunning, setIsCypherRunning] = useState(false);
    const debouncedQuery = useDebouncedValue(query, 250);
    const latestQueryRequestIdRef = useRef(0);

    const fetchGraphData = useCallback(async () => {
        if (!vaultPath) {
            setElements([]);
            setLoading(false);
            return;
        }
        try {
            const data = await invoke<GraphData>('get_graph_data', { vaultPath });
            setGraphData(data);
        } catch (e) {
            console.error('Failed to fetch graph data:', e);
        } finally {
            setLoading(false);
        }
    }, [vaultPath]);

    useEffect(() => {
        fetchGraphData();
    }, [fetchGraphData]);

    useEffect(() => {
        const unlistenPromise = listen('file-changed', () => {
            fetchGraphData();
        });
        return () => {
            unlistenPromise.then((unlisten) => unlisten());
        };
    }, [fetchGraphData]);

    const handleNodeClick = useCallback(
        (nodeId: string) => {
            setSelectedGraphNode(nodeId || null);
        },
        [setSelectedGraphNode]
    );

    const handleNodeDoubleClick = useCallback(
        async (nodeId: string) => {
            const existingFile = files.find((f) => f.path === nodeId);

            if (existingFile) {
                setActiveNote(existingFile);
                setViewMode('editor');
            } else {
                try {
                    const parts = nodeId.replace(/\\/g, '/').split('/');
                    const filename = parts[parts.length - 1];
                    const title = filename.replace(/\.md$/, '');

                    if (!vaultPath) return;

                    const newNote = await createNoteInDir(vaultPath, title);
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
            <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--color-border-light)] bg-[var(--color-bg-primary)] shrink-0">
                <button
                    onClick={() => setViewMode('editor')}
                    className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer text-[var(--color-text-muted)] text-[13px] px-2 py-1 rounded-[var(--radius-md)] transition-colors duration-200 hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
                    style={{
                        padding: "0.5rem 1rem"
                    }}
                >
                    <ArrowLeft size={14} />
                    {t("graph.backToEditor")}
                </button>
                <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                    {t("graph.graphView")}
                </span>
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
                    />
                )}

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
