import { useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useEditorStore } from '../../stores/editorStore';
import { GraphCanvas } from './GraphCanvas';
import { NodeInfoPanel } from './NodeInfoPanel';
import { ArrowLeft } from 'lucide-react';
import cytoscape from 'cytoscape';
import { mapGraphDataToElements, GraphData } from "../../utils/graphUtils.ts";

export function GraphView() {
    const {
        vaultPath,
        setViewMode,
        selectedGraphNode,
        setSelectedGraphNode,
        setActiveNote,
        files,
    } = useEditorStore();

    const [elements, setElements] = useState<cytoscape.ElementDefinition[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchGraphData = useCallback(async () => {
        if (!vaultPath) return;
        try {
            const data = await invoke<GraphData>('get_graph_data', { vaultPath });
            setElements(mapGraphDataToElements(data));
        } catch (e) {
            console.error('Failed to fetch graph data:', e);
        } finally {
            setLoading(false);
        }
    }, [vaultPath]);

    // Initial fetch
    useEffect(() => {
        fetchGraphData();
    }, [fetchGraphData]);

    // Real-time updates on file changes
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
            // Check if this file exists in our files list
            const existingFile = files.find((f) => f.path === nodeId);

            if (existingFile) {
                // Navigate to the file
                setActiveNote(existingFile);
                setViewMode('editor');
            } else {
                // Create the file and navigate to it
                try {
                    // Extract filename from path
                    const parts = nodeId.replace(/\\/g, '/').split('/');
                    const filename = parts[parts.length - 1];
                    const title = filename.replace(/\.md$/, '');

                    const createdPath = await invoke<string>('create_note', {
                        vaultPath,
                        title,
                    });

                    // Set active note and switch to editor
                    setActiveNote({
                        path: createdPath,
                        filename: createdPath.replace(/\\/g, '/').split('/').pop() || title + '.md',
                        is_dir: false,
                        size: 0,
                        last_modified: Date.now(),
                    });
                    setViewMode('editor');
                } catch (e) {
                    console.error('Failed to create note:', e);
                }
            }
        },
        [files, vaultPath, setActiveNote, setViewMode]
    );

    return (
        <div className="w-full h-full relative flex flex-col">
            {/* Header bar */}
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

            {/* Graph canvas */}
            <div className="flex-1 relative">
                {loading ? (
                    <div className="flex items-center justify-center h-full text-[var(--color-text-muted)] text-sm">
                        Loading graph...
                    </div>
                ) : (
                    <GraphCanvas
                        elements={elements}
                        mode="global"
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
