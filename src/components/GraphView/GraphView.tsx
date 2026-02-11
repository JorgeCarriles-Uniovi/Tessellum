import { useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useEditorStore } from '../../stores/editorStore';
import { GraphCanvas } from './GraphCanvas';
import { NodeInfoPanel } from './NodeInfoPanel';
import { ArrowLeft } from 'lucide-react';
import cytoscape from 'cytoscape';
import {buildGraphElements} from "../../utils/graphUtils.ts";

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
            const [notes, links] = await Promise.all([
                invoke<[string, number][]>('get_all_notes'),
                invoke<[string, string][]>('get_all_links'),
            ]);
            setElements(buildGraphElements(notes, links, vaultPath));
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
        <div
            style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            {/* Header bar */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 16px',
                    borderBottom: '1px solid var(--color-border-light)',
                    backgroundColor: 'var(--color-bg-primary)',
                    flexShrink: 0,
                }}
            >
                <button
                    onClick={() => setViewMode('editor')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--color-text-muted)',
                        fontSize: '13px',
                        padding: '4px 8px',
                        borderRadius: 'var(--radius-md)',
                        transition: 'var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
                        e.currentTarget.style.color = 'var(--color-text-primary)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--color-text-muted)';
                    }}
                >
                    <ArrowLeft size={14} />
                    Back to Editor
                </button>
                <span
                    style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--color-text-primary)',
                    }}
                >
                    Graph View
                </span>
            </div>

            {/* Graph canvas */}
            <div style={{ flex: 1, position: 'relative' }}>
                {loading ? (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            color: 'var(--color-text-muted)',
                            fontSize: '14px',
                        }}
                    >
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
