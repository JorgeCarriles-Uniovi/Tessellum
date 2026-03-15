import { useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useGraphStore, useVaultStore } from "../../stores";
import { GraphCanvas } from './GraphCanvas';
import { NodeInfoPanel } from './NodeInfoPanel';
import { ArrowLeft } from 'lucide-react';
import cytoscape from 'cytoscape';
import { mapGraphDataToElements, GraphData } from "../../utils/graphUtils.ts";
import { createNoteInDir } from "../../utils/noteUtils";

export function GraphView() {
    const { vaultPath, files, setActiveNote, addFileIfMissing } = useVaultStore();
    const { setViewMode, selectedGraphNode, setSelectedGraphNode } = useGraphStore();

    const [elements, setElements] = useState<cytoscape.ElementDefinition[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchGraphData = useCallback(async () => {
        if (!vaultPath) {
            setElements([]);
            setLoading(false);
            return;
        }
        try {
            const data = await invoke<GraphData>('get_graph_data', { vaultPath });
            setElements(mapGraphDataToElements(data));
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

    return (
        <div className="w-full h-full relative flex flex-col">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--color-border-light)] bg-[var(--color-bg-primary)] shrink-0">
                <button
                    onClick={() => setViewMode('editor')}
                    className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer text-[var(--color-text-muted)] text-[13px] px-2 py-1 rounded-[var(--radius-md)] transition-colors duration-200 hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
                >
                    <ArrowLeft size={14} />
                    Back to Editor
                </button>
                <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                    Graph View
                </span>
            </div>

            <div className="flex-1 relative">
                {loading ? (
                    <div className="flex items-center justify-center h-full text-[var(--color-text-muted)] text-sm">
                        Loading graph...
                    </div>
                ) : elements.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-[var(--color-text-muted)] text-sm">
                        No graph data yet. Create notes and links to see connections.
                    </div>
                ) : (
                    <GraphCanvas
                        elements={elements}
                        mode="global"
                        onNodeClick={handleNodeClick}
                        onNodeDoubleClick={handleNodeDoubleClick}
                    />
                )}

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
