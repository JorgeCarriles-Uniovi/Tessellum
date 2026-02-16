import { useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useEditorStore } from '../../stores/editorStore';
import { GraphCanvas } from './GraphCanvas';
import { NodeInfoPanel } from './NodeInfoPanel';
import { buildGraphElements, pathToLabel } from '../../utils/graphUtils';
import { X } from 'lucide-react';
import cytoscape from 'cytoscape';

export function LocalGraphPanel() {
    const {
        vaultPath,
        activeNote,
        selectedGraphNode,
        setSelectedGraphNode,
        setActiveNote,
        toggleLocalGraph,
        files,
    } = useEditorStore();

    const [elements, setElements] = useState<cytoscape.ElementDefinition[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLocalGraph = useCallback(async () => {
        if (!vaultPath || !activeNote) {
            setElements([]);
            setLoading(false);
            return;
        }

        try {
            const [outgoing, incoming] = await Promise.all([
                invoke<string[]>('get_outgoing_links', { path: activeNote.path }),
                invoke<string[]>('get_backlinks', { path: activeNote.path }),
            ]);

            // Build a mini-graph: active note + its direct neighbors
            const neighborPaths = new Set([...outgoing, ...incoming]);
            const allPaths = new Set([activeNote.path, ...neighborPaths]);

            // Build nodes
            const notes: [string, number][] = [];

            for (const path of allPaths) {
                notes.push([path, 0]);
            }

            // Build edges: only links involving the active note
            const links: [string, string][] = [];
            for (const target of outgoing) {
                links.push([activeNote.path, target]);
            }
            for (const source of incoming) {
                links.push([source, activeNote.path]);
            }

            setElements(buildGraphElements(notes, links, vaultPath));
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
            const existingFile = files.find((f) => f.path === nodeId);
            if (existingFile) {
                setActiveNote(existingFile);
            } else {
                try {
                    const parts = nodeId.replace(/\\/g, '/').split('/');
                    const filename = parts[parts.length - 1];
                    const title = filename.replace(/\.md$/, '');

                    const createdPath = await invoke<string>('create_note', {
                        vaultPath,
                        title,
                    });

                    setActiveNote({
                        path: createdPath,
                        filename: createdPath.replace(/\\/g, '/').split('/').pop() || title + '.md',
                        is_dir: false,
                        size: 0,
                        last_modified: Date.now(),
                    });
                } catch (e) {
                    console.error('Failed to create note:', e);
                }
            }
        },
        [files, vaultPath, setActiveNote]
    );

    const noteLabel = activeNote
        ? pathToLabel(activeNote.path, vaultPath || '')
        : 'No note selected';

    return (
        <div
            style={{
                width: 320,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderLeft: '1px solid var(--color-border-light)',
                backgroundColor: 'var(--color-bg-primary)',
                flexShrink: 0,
            }}
        >
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
                        focusNodeId={activeNote.path}
                        onNodeClick={handleNodeClick}
                        onNodeDoubleClick={handleNodeDoubleClick}
                    />
                )}

                {/* Info panel */}
                {selectedGraphNode && (
                    <NodeInfoPanel
                        nodePath={selectedGraphNode}
                        onClose={() => setSelectedGraphNode(null)}
                    />
                )}
            </div>
        </div>
    );
}
