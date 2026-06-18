import { useRef, useEffect, useCallback, useState } from 'react';
import cytoscape, { Core } from 'cytoscape';
import { invoke } from '@tauri-apps/api/core';
import { useGraphStore } from '../../stores/graphStore';
import { useVaultStore } from '../../stores/vaultStore';
import { Plus, ArrowLeft } from 'lucide-react';

export interface CanvasNodeDef {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    type: 'text' | 'note';
    content: string;
}

export interface CanvasEdgeDef {
    id: string;
    source: string;
    target: string;
    label?: string;
}

export interface CanvasData {
    nodes: CanvasNodeDef[];
    edges: CanvasEdgeDef[];
}

function getCanvasStylesheet(): cytoscape.Stylesheet[] {
    const root = getComputedStyle(document.documentElement);
    const bgSecondary = root.getPropertyValue('--color-background-secondary').trim() || '#f3f4f6';
    const borderLight = root.getPropertyValue('--color-border-light').trim() || '#e5e7eb';
    const textPrimary = root.getPropertyValue('--color-text-primary').trim() || '#111827';
    const primary = root.getPropertyValue('--primary').trim() || '#6366f1';
    const textMuted = root.getPropertyValue('--color-text-muted').trim() || '#9ca3af';

    return [
        {
            selector: 'node',
            style: {
                shape: 'round-rectangle' as any,
                width: 'data(width)',
                height: 'data(height)',
                label: 'data(label)',
                'text-valign': 'center' as any,
                'text-halign': 'center' as any,
                'text-wrap': 'wrap' as any,
                'text-max-width': 'data(textWidth)',
                'background-color': bgSecondary,
                'border-color': borderLight,
                'border-width': 1,
                color: textPrimary,
                'font-size': 12,
                'font-family': 'var(--font-sans, system-ui, sans-serif)',
            } as any,
        },
        {
            selector: 'node:selected',
            style: {
                'border-color': primary,
                'border-width': 2,
            } as any,
        },
        {
            selector: 'node.note-card',
            style: {
                'background-color': bgSecondary,
                'border-color': borderLight,
            } as any,
        },
        {
            selector: 'edge',
            style: {
                width: 1.5,
                'line-color': textMuted,
                'target-arrow-color': textMuted,
                'target-arrow-shape': 'triangle',
                'curve-style': 'bezier',
                label: 'data(label)',
                'font-size': 10,
                color: textMuted,
                'text-background-opacity': 1,
                'text-background-color': bgSecondary,
                'text-background-padding': '2px',
            } as any,
        },
        {
            selector: 'edge:selected',
            style: {
                'line-color': primary,
                'target-arrow-color': primary,
            } as any,
        },
    ];
}

function canvasToElements(data: CanvasData): cytoscape.ElementDefinition[] {
    const nodes: cytoscape.ElementDefinition[] = data.nodes.map((n) => ({
        group: 'nodes' as const,
        data: {
            id: n.id,
            label: n.content || '',
            width: Math.max(n.width, 80),
            height: Math.max(n.height, 40),
            textWidth: Math.max(n.width - 16, 64),
            type: n.type,
        },
        position: { x: n.x, y: n.y },
        classes: n.type === 'note' ? 'note-card' : '',
    }));

    const edges: cytoscape.ElementDefinition[] = data.edges.map((e) => ({
        group: 'edges' as const,
        data: {
            id: e.id,
            source: e.source,
            target: e.target,
            label: e.label || '',
        },
    }));

    return [...nodes, ...edges];
}

function generateId(): string {
    return Math.random().toString(36).slice(2, 10);
}

const EMPTY_CANVAS: CanvasData = { nodes: [], edges: [] };

export function CanvasView() {
    const containerRef = useRef<HTMLDivElement>(null);
    const cyRef = useRef<Core | null>(null);
    const canvasDataRef = useRef<CanvasData>(EMPTY_CANVAS);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const { canvasPath, setViewMode } = useGraphStore();
    const { files, setActiveNote, vaultPath } = useVaultStore();
    const [canvasName, setCanvasName] = useState('');
    const [error, setError] = useState<string | null>(null);

    const saveCanvas = useCallback(async (data: CanvasData) => {
        if (!canvasPath || !vaultPath) return;
        try {
            await invoke('write_file', {
                vaultPath,
                path: canvasPath,
                content: JSON.stringify(data, null, 2),
            });
        } catch (e) {
            console.error('Failed to save canvas:', e);
        }
    }, [canvasPath, vaultPath]);

    const scheduleSave = useCallback((data: CanvasData) => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => saveCanvas(data), 800);
    }, [saveCanvas]);

    // Load canvas file when path changes
    useEffect(() => {
        if (!canvasPath || !vaultPath) return;
        const name = canvasPath.split('/').pop() ?? 'Canvas';
        setCanvasName(name.replace(/\.canvas$/, ''));
        setError(null);

        invoke<string>('read_file', { vaultPath, path: canvasPath })
            .then((content) => {
                try {
                    const data: CanvasData = content.trim() ? JSON.parse(content) : EMPTY_CANVAS;
                    canvasDataRef.current = data;
                    if (cyRef.current) {
                        cyRef.current.elements().remove();
                        cyRef.current.add(canvasToElements(data));
                        cyRef.current.layout({ name: 'preset' } as any).run();
                        if (data.nodes.length > 0) {
                            cyRef.current.fit(undefined, 60);
                        }
                    }
                } catch {
                    canvasDataRef.current = EMPTY_CANVAS;
                    setError('Invalid canvas file — starting with empty canvas.');
                }
            })
            .catch((e) => setError(String(e)));
    }, [canvasPath, vaultPath]);

    // Init Cytoscape once
    useEffect(() => {
        if (!containerRef.current) return;

        const cy = cytoscape({
            container: containerRef.current,
            elements: [],
            style: getCanvasStylesheet(),
            layout: { name: 'preset' } as any,
            minZoom: 0.1,
            maxZoom: 5,
            wheelSensitivity: 0.3,
            userZoomingEnabled: true,
            userPanningEnabled: true,
            boxSelectionEnabled: true,
        });

        cyRef.current = cy;

        // Double-tap to open note
        let lastTap = 0;
        cy.on('tap', 'node', (evt) => {
            const now = Date.now();
            if (now - lastTap < 300) {
                const nodeData = evt.target.data();
                if (nodeData.type === 'note') {
                    const content: string = nodeData.label ?? '';
                    const match = content.match(/^\[\[(.+?)(?:\|.+?)?\]\]$/);
                    const target = match ? match[1] : content;
                    const file = files.find(
                        (f) =>
                            f.path.endsWith(`/${target}.md`) ||
                            f.path.endsWith(`/${target}`) ||
                            f.name === target ||
                            f.name === `${target}.md`,
                    );
                    if (file) {
                        setActiveNote(file);
                        setViewMode('editor');
                    }
                }
            }
            lastTap = now;
        });

        // Save positions after drag
        cy.on('dragfree', 'node', (evt) => {
            const id = evt.target.id();
            const pos = evt.target.position();
            const data = canvasDataRef.current;
            const updated: CanvasData = {
                ...data,
                nodes: data.nodes.map((n) =>
                    n.id === id ? { ...n, x: Math.round(pos.x), y: Math.round(pos.y) } : n,
                ),
            };
            canvasDataRef.current = updated;
            scheduleSave(updated);
        });

        // Update stylesheet on theme change
        const observer = new MutationObserver(() => {
            cy.style(getCanvasStylesheet());
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

        return () => {
            observer.disconnect();
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
            try {
                cy.destroy();
            } catch {}
            cyRef.current = null;
        };
    }, []);

    const handleAddCard = useCallback(() => {
        const cy = cyRef.current;
        if (!cy) return;

        const id = generateId();
        const ext = cy.extent();
        const cx = (ext.x1 + ext.x2) / 2;
        const cy2 = (ext.y1 + ext.y2) / 2;

        const newNode: CanvasNodeDef = {
            id,
            x: cx,
            y: cy2,
            width: 200,
            height: 80,
            type: 'text',
            content: 'New card',
        };

        const updated: CanvasData = {
            ...canvasDataRef.current,
            nodes: [...canvasDataRef.current.nodes, newNode],
        };
        canvasDataRef.current = updated;

        cy.add({
            group: 'nodes',
            data: {
                id,
                label: newNode.content,
                width: newNode.width,
                height: newNode.height,
                textWidth: newNode.width - 16,
                type: newNode.type,
            },
            position: { x: cx, y: cy2 },
        });

        scheduleSave(updated);
    }, [scheduleSave]);

    const rootStyle = getComputedStyle(document.documentElement);
    const bgColor = rootStyle.getPropertyValue('--color-background-primary').trim() || '#ffffff';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
            {/* Toolbar */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.375rem 0.75rem',
                    borderBottom: '1px solid var(--color-border-light)',
                    backgroundColor: 'var(--color-background-secondary)',
                    flexShrink: 0,
                }}
            >
                <button
                    onClick={() => setViewMode('editor')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.25rem',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--color-text-muted)',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                    }}
                    title="Back to editor"
                >
                    <ArrowLeft size={14} />
                </button>

                <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--color-text-primary)' }}>
                    {canvasName || 'Canvas'}
                </span>

                <div style={{ flex: 1 }} />

                <button
                    onClick={handleAddCard}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        padding: '0.25rem 0.625rem',
                        borderRadius: '0.25rem',
                        border: '1px solid var(--color-border-light)',
                        background: 'var(--color-background-secondary)',
                        color: 'var(--color-text-secondary)',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                    }}
                >
                    <Plus size={12} />
                    Add card
                </button>
            </div>

            {/* Canvas area */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                {error && (
                    <div
                        style={{
                            position: 'absolute',
                            top: '0.75rem',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            backgroundColor: 'var(--color-background-secondary)',
                            border: '1px solid var(--color-border-light)',
                            borderRadius: '0.375rem',
                            padding: '0.375rem 0.75rem',
                            fontSize: '0.75rem',
                            color: 'var(--color-text-muted)',
                            zIndex: 10,
                        }}
                    >
                        {error}
                    </div>
                )}
                <div
                    ref={containerRef}
                    style={{ width: '100%', height: '100%', backgroundColor: bgColor }}
                />
            </div>
        </div>
    );
}
