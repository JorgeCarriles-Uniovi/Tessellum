import { useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useGraphStore, useVaultStore } from "../../stores";
import { GraphCanvas } from './GraphCanvas';
import { NodeInfoPanel } from './NodeInfoPanel';
import { GraphQueryPanel } from './GraphQueryPanel';
import { mapGraphDataToElements, GraphData } from '../../utils/graphUtils';
import { X, GitFork } from 'lucide-react';
import cytoscape from 'cytoscape';
import { createNoteInDir } from "../../utils/noteUtils";
import { applyFilterToGraphData, runCypherGraphFilter } from '../../lib/cypherGraphFilter';
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { normalizeCypherQuery } from "../../lib/cypherQueryNormalizer";
import { IconButton } from "../ui";

const PANEL_WIDTH = 290;
const GRAPH_HEIGHT = 200;

export function LocalGraphPanel({ isOpen }: { isOpen: boolean }) {
    const { vaultPath, activeNote, setActiveNote, files, addFileIfMissing } = useVaultStore();
    const { selectedGraphNode, setSelectedGraphNode, toggleLocalGraph } = useGraphStore();

    const [graphData, setGraphData] = useState<GraphData | null>(null);
    const [elements, setElements] = useState<cytoscape.ElementDefinition[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [queryError, setQueryError] = useState<string | null>(null);
    const [isCypherRunning, setIsCypherRunning] = useState(false);
    const debouncedQuery = useDebouncedValue(query, 250);

    const fetchLocalGraph = useCallback(async () => {
        if (!vaultPath || !activeNote || !isOpen) {
            if (!isOpen) setElements([]);
            setLoading(false);
            return;
        }

        try {
            const data = await invoke<GraphData>('get_graph_data', { vaultPath });

            const targetId = activeNote.path.replace(/\\/g, '/');

            const connectedNodeIds = new Set<string>([targetId]);
            const localEdges = data.edges.filter(edge => {
                if (edge.source === targetId || edge.target === targetId) {
                    connectedNodeIds.add(edge.source);
                    connectedNodeIds.add(edge.target);
                    return true;
                }
                return false;
            });

            const localNodes = data.nodes.filter(node => connectedNodeIds.has(node.id));

            setGraphData({ nodes: localNodes, edges: localEdges });
        } catch (e) {
            console.error('Failed to fetch local graph data:', e);
        } finally {
            setLoading(false);
        }
    }, [vaultPath, activeNote, isOpen]);

    // Fetch when active note changes or panel opens
    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            fetchLocalGraph();
        }
    }, [fetchLocalGraph, isOpen]);

    useEffect(() => {
        if (!graphData) {
            setElements([]);
            setIsCypherRunning(false);
            return;
        }

        const trimmed = debouncedQuery.trim();
        if (!trimmed) {
            setElements(mapGraphDataToElements(graphData));
            setQueryError(null);
            setIsCypherRunning(false);
            return;
        }

        setIsCypherRunning(true);
        try {
            const normalizedQuery = normalizeCypherQuery(trimmed);
            const filter = runCypherGraphFilter(normalizedQuery, graphData);
            const filteredData = applyFilterToGraphData(graphData, filter);
            setElements(mapGraphDataToElements(filteredData));
            setQueryError(null);
        } catch (error) {
            setElements([]);
            setQueryError(error instanceof Error ? error.message : String(error));
        } finally {
            setIsCypherRunning(false);
        }
    }, [debouncedQuery, graphData]);

    // Real-time updates
    useEffect(() => {
        if (!isOpen) return;
        const unlistenPromise = listen('file-changed', () => {
            fetchLocalGraph();
        });
        return () => {
            unlistenPromise.then((unlisten) => unlisten());
        };
    }, [fetchLocalGraph, isOpen]);

    const handleNodeClick = useCallback(
        (nodeId: string) => {
            setSelectedGraphNode(nodeId || null);
        },
        [setSelectedGraphNode]
    );

    const handleNodeDoubleClick = useCallback(
        async (nodeId: string) => {
            const normalizedNodeId = nodeId.replace(/\\/g, '/');
            const existingFile = files.find((f) => f.path.replace(/\\/g, '/') === normalizedNodeId);
            if (existingFile) {
                setActiveNote(existingFile);
            } else {
                try {
                    const parts = nodeId.replace(/\\/g, '/').split('/');
                    const filename = parts[parts.length - 1];
                    const title = filename.replace(/\.md$/, '');

                    if (!vaultPath) return;

                    const newNote = await createNoteInDir(vaultPath, title);
                    addFileIfMissing(newNote);
                    setActiveNote(newNote);
                } catch (e) {
                    console.error('Failed to create note:', e);
                }
            }
        },
        [files, vaultPath, addFileIfMissing]
    );

    const noteLabel = activeNote
        ? activeNote.filename.replace(/\.md$/, '')
        : 'No note selected';

    const focusId = activeNote ? activeNote.path.replace(/\\/g, '/') : null;
    const linkedCount = graphData
        ? graphData.nodes.filter((node) => node.exists && node.id !== focusId).length
        : 0;
    const unresolvedCount = graphData
        ? graphData.nodes.filter((node) => !node.exists).length
        : 0;

    if (!isOpen) return null;

    return (
        <div
            style={{
                position: 'absolute',
                right: 22,
                bottom: 22,
                width: PANEL_WIDTH,
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border-light)',
                borderRadius: 14,
                boxShadow: 'var(--shadow-lg)',
                overflow: 'hidden',
                zIndex: 20,
                opacity: 1,
                transform: 'translateY(0)',
                transition: 'opacity 200ms ease, transform 200ms ease',
            }}
        >
            {/* Header */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 12px',
                    borderBottom: '1px solid var(--color-border-light)',
                }}
            >
                <span
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '7px',
                        fontSize: '11px',
                        fontWeight: 600,
                        letterSpacing: '0.02em',
                        color: 'var(--color-text-secondary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                >
                    <GitFork size={13} color="var(--color-accent-default)" style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Local graph — {noteLabel}
                    </span>
                </span>
                <IconButton label="Close local graph" size={22} onClick={toggleLocalGraph}>
                    <X size={14} />
                </IconButton>
            </div>

            {/* Graph */}
            <div style={{ height: GRAPH_HEIGHT, position: 'relative', backgroundColor: 'var(--color-bg-primary)' }}>
                {!activeNote ? (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            color: 'var(--color-text-muted)',
                            fontSize: '13px',
                            fontStyle: 'italic',
                            textAlign: 'center',
                            padding: '0 16px',
                        }}
                    >
                        Open a note to see its connections
                    </div>
                ) : loading ? (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            color: 'var(--color-text-muted)',
                            fontSize: '13px',
                        }}
                    >
                        Loading...
                    </div>
                ) : (
                    <GraphCanvas
                        elements={elements}
                        mode="local"
                        focusNodeId={activeNote.path.replace(/\\/g, '/')}
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
                    width={230}
                />

                {/* Info panel */}
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

            {/* Footer legend */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 13px',
                    borderTop: '1px solid var(--color-border-light)',
                    fontSize: '10px',
                    color: 'var(--color-text-muted)',
                }}
            >
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span
                        aria-hidden
                        style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--color-accent-2)',
                            flexShrink: 0,
                        }}
                    />
                    {linkedCount} linked
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span
                        aria-hidden
                        style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            border: '1px dashed var(--color-text-muted)',
                            flexShrink: 0,
                        }}
                    />
                    {unresolvedCount} unresolved
                </span>
            </div>
        </div>
    );
}
