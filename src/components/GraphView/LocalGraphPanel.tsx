import { useEffect, useState, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useGraphStore, useVaultStore } from "../../stores";
import { GraphCanvas } from './GraphCanvas';
import { NodeInfoPanel } from './NodeInfoPanel';
import { mapGraphDataToElements, GraphData } from '../../utils/graphUtils';
import { X } from 'lucide-react';
import cytoscape from 'cytoscape';
import { createNoteInDir } from "../../utils/noteUtils";

export function LocalGraphPanel() {
    const { vaultPath, activeNote, setActiveNote, files, addFileIfMissing } = useVaultStore();
    const { selectedGraphNode, setSelectedGraphNode, toggleLocalGraph } = useGraphStore();

    const [elements, setElements] = useState<cytoscape.ElementDefinition[]>([]);
    const [loading, setLoading] = useState(true);
    const [panelWidth, setPanelWidth] = useState(320);
    const isDragging = useRef(false);
    const dragStartX = useRef(0);
    const dragStartWidth = useRef(320);

    const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isDragging.current = true;
        dragStartX.current = e.clientX;
        dragStartWidth.current = panelWidth;

        const onMouseMove = (ev: MouseEvent) => {
            if (!isDragging.current) return;
            const delta = dragStartX.current - ev.clientX;
            const newWidth = Math.min(600, Math.max(200, dragStartWidth.current + delta));
            setPanelWidth(newWidth);
        };

        const onMouseUp = () => {
            isDragging.current = false;
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }, [panelWidth]);

    const fetchLocalGraph = useCallback(async () => {
        if (!vaultPath || !activeNote) {
            setElements([]);
            setLoading(false);
            return;
        }

        try {
            const data = await invoke<GraphData>('get_graph_data', { vaultPath });

            // To emulate a local graph, we can only show nodes linked to the active note
            // Ideally we'd have a backend command `get_local_graph_data`, but we can filter here for now.
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

            setElements(mapGraphDataToElements({ nodes: localNodes, edges: localEdges }));
        } catch (e) {
            console.error('Failed to fetch local graph data:', e);
        } finally {
            setLoading(false);
        }
    }, [vaultPath, activeNote, files]);

    // Fetch when active note changes
    useEffect(() => {
        setLoading(true);
        fetchLocalGraph();
    }, [fetchLocalGraph]);

    // Real-time updates
    useEffect(() => {
        const unlistenPromise = listen('file-changed', () => {
            fetchLocalGraph();
        });
        return () => {
            unlistenPromise.then((unlisten) => unlisten());
        };
    }, [fetchLocalGraph]);

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
        [files, vaultPath, setActiveNote, addFileIfMissing]
    );

    const noteLabel = activeNote
        ? activeNote.filename.replace(/\.md$/, '')
        : 'No note selected';

    return (
        <div
            style={{
                width: panelWidth,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderLeft: '1px solid var(--color-border-light)',
                backgroundColor: 'var(--color-bg-primary)',
                flexShrink: 0,
                position: 'relative',
            }}
        >
            {/* Resize handle */}
            <div
                onMouseDown={handleResizeMouseDown}
                style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: 4,
                    height: '100%',
                    cursor: 'col-resize',
                    zIndex: 10,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-accent)'; e.currentTarget.style.opacity = '0.5'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.opacity = '1'; }}
            />
            {/* Header */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderBottom: '1px solid var(--color-border-light)',
                    backgroundColor: 'var(--color-bg-secondary)',
                    flexShrink: 0,
                }}
            >
                <span
                    style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--color-text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                >
                    Local Graph — {noteLabel}
                </span>
                <button
                    onClick={toggleLocalGraph}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 22,
                        height: 22,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--color-text-muted)',
                        borderRadius: 'var(--radius-sm)',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                >
                    <X size={14} />
                </button>
            </div>

            {/* Graph */}
            <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
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
                        onNodeClick={handleNodeClick}
                        onNodeDoubleClick={handleNodeDoubleClick}
                    />
                )}

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
        </div>
    );
}
