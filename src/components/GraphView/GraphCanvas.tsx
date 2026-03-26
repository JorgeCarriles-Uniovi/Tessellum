import { useRef, useEffect } from 'react';
import cytoscape, { Core } from 'cytoscape';
import {
    getCytoscapeStylesheet,
    markOrphanNodes,
} from '../../utils/graphUtils';

interface GraphCanvasProps {
    elements: cytoscape.ElementDefinition[];
    visibleNodeIds?: Set<string> | null;
    visibleEdgeIds?: Set<string> | null;
    queryHighlightedNodeIds?: Set<string> | null;
    mode: 'global' | 'local';
    focusNodeId?: string;
    selectedNodeId?: string;
    onNodeClick: (nodeId: string) => void;
    onNodeDoubleClick: (nodeId: string) => void;
}

export function GraphCanvas({
                                elements,
                                visibleNodeIds,
                                visibleEdgeIds,
                                queryHighlightedNodeIds,
                                mode,
                                focusNodeId,
                                selectedNodeId,
                                onNodeClick,
                                onNodeDoubleClick,
                            }: GraphCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const cyRef = useRef<Core | null>(null);
    const focusNodeIdRef = useRef<string | undefined>(focusNodeId);
    const selectedNodeIdRef = useRef<string | null>(selectedNodeId ?? null);
    const hoveredNodeIdRef = useRef<string | null>(null);

    useEffect(() => {
        focusNodeIdRef.current = focusNodeId;
    }, [focusNodeId]);

    useEffect(() => {
        selectedNodeIdRef.current = selectedNodeId ?? null;
    }, [selectedNodeId]);

    const getLayoutOptions = () => ({
        name: 'cose',
        animate: true,
        animationDuration: 500,
        randomize: true,
        nodeRepulsion: () => (mode === 'global' ? 6000 : 4000),
        idealEdgeLength: () => (mode === 'global' ? 70 : 60),
        gravity: mode === 'global' ? 1.0 : 0.8,
        numIter: mode === 'global' ? 1000 : 500,
        nodeDimensionsIncludeLabels: true,
        componentSpacing: mode === 'global' ? 80 : 50,
        padding: 40,
    } as any);

    // Initialize Cytoscape once
    useEffect(() => {
        if (!containerRef.current) return;

        const cy = cytoscape({
            container: containerRef.current,
            elements: [],
            style: getCytoscapeStylesheet(),
            layout: getLayoutOptions(),
            minZoom: 0.1,
            maxZoom: 5,
            wheelSensitivity: 0.3,
        });

        cyRef.current = cy;

        // After layout finishes, reposition orphan nodes in a circle around the main cluster
        const handleLayoutStop = () => {
            const orphans = cy.nodes('.orphan').not('.filtered-out');

            if (orphans.length === 0) {
                if (focusNodeIdRef.current) {
                    cy.animate({ fit: { eles: cy.elements(), padding: 60 }, duration: 300 } as any);
                }
                return;
            }

            const connected = cy.nodes().not('.orphan');
            let cx: number, cy2: number, radius: number;

            if (connected.length > 0) {
                const bb = connected.boundingBox({});
                cx = (bb.x1 + bb.x2) / 2;
                cy2 = (bb.y1 + bb.y2) / 2;
                radius = Math.max(bb.w, bb.h) / 2 + 80;
            } else {
                const ext = cy.extent();
                cx = (ext.x1 + ext.x2) / 2;
                cy2 = (ext.y1 + ext.y2) / 2;
                radius = orphans.length > 1 ? Math.max(120, orphans.length * 18) : 0;
            }

            orphans.forEach((node: cytoscape.NodeSingular, i: number) => {
                const angle = (2 * Math.PI * i) / orphans.length - Math.PI / 2;
                node.animate({
                    position: {
                        x: cx + radius * Math.cos(angle),
                        y: cy2 + radius * Math.sin(angle),
                    },
                    duration: 400,
                    easing: 'ease-out-cubic' as any,
                });
            });

            separateOverlappingNodes(cy.nodes().not('.filtered-out'));

            setTimeout(() => {
                cy.animate({ fit: { eles: cy.elements(), padding: 60 }, duration: 300 } as any);
            }, 420);
        };

        cy.on('layoutstop', handleLayoutStop);

        cy.on('tap', 'node', (evt: cytoscape.EventObject) => {
            const nodeId = evt.target.id();
            selectedNodeIdRef.current = nodeId;
            applyNodeLinkHighlight(cy, nodeId);
            onNodeClick(nodeId);
        });

        let lastTapTime = 0;
        cy.on('tap', 'node', (evt: cytoscape.EventObject) => {
            const now = Date.now();
            if (now - lastTapTime < 300) {
                onNodeDoubleClick(evt.target.id());
            }
            lastTapTime = now;
        });

        cy.on('tap', (evt: cytoscape.EventObject) => {
            if (evt.target === cy) {
                selectedNodeIdRef.current = null;
                applyNodeLinkHighlight(cy, null);
                onNodeClick('');
            }
        });

        cy.on('mouseover', 'node', (evt: cytoscape.EventObject) => {
            evt.target.addClass('hover');
            hoveredNodeIdRef.current = evt.target.id();
            applyNodeLinkHighlight(cy, hoveredNodeIdRef.current);
            if (containerRef.current) {
                containerRef.current.style.cursor = 'pointer';
            }
        });

        cy.on('mouseout', 'node', (evt: cytoscape.EventObject) => {
            evt.target.removeClass('hover');
            hoveredNodeIdRef.current = null;
            applyNodeLinkHighlight(cy, selectedNodeIdRef.current);
            if (containerRef.current) {
                containerRef.current.style.cursor = 'default';
            }
        });

        return () => {
            cy.destroy();
            cyRef.current = null;
        };
    }, []);

    // Update stylesheet when theme changes
    useEffect(() => {
        const observer = new MutationObserver(() => {
            if (cyRef.current) {
                cyRef.current.style(getCytoscapeStylesheet());
            }
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
        });

        return () => observer.disconnect();
    }, []);

    // Update elements without re-initializing Cytoscape
    useEffect(() => {
        if (!cyRef.current) return;
        const cy = cyRef.current;

        const nextById = new Map<string, cytoscape.ElementDefinition>();
        elements.forEach((el) => {
            if (el.data && typeof el.data.id === 'string') {
                nextById.set(el.data.id, el);
            }
        });

        let structureChanged = false;

        cy.batch(() => {
            cy.elements().forEach((ele) => {
                if (!nextById.has(ele.id())) {
                    cy.remove(ele);
                    structureChanged = true;
                }
            });

            nextById.forEach((def, id) => {
                const existing = cy.getElementById(id);
                if (existing.empty()) {
                    cy.add(def);
                    structureChanged = true;
                    return;
                }
                existing.data(def.data as any);
                existing.classes(typeof def.classes === 'string' ? def.classes : '');
            });
        });

        markOrphanNodes(cy);

        if (structureChanged) {
            cy.layout(getLayoutOptions()).run();
        }
    }, [elements, mode]);

    // Apply filtering without re-initialization
    useEffect(() => {
        if (!cyRef.current) return;
        const cy = cyRef.current;

        const nodeSet = visibleNodeIds ?? null;
        const edgeSet = visibleEdgeIds ?? null;

        cy.batch(() => {
            cy.nodes().forEach((node) => {
                if (!nodeSet) {
                    node.removeClass('filtered-out');
                    return;
                }
                if (nodeSet.has(node.id())) {
                    node.removeClass('filtered-out');
                } else {
                    node.addClass('filtered-out');
                }
            });

            cy.edges().forEach((edge) => {
                if (!edgeSet) {
                    edge.removeClass('filtered-out');
                    return;
                }
                const sourceId = edge.data('source') as string;
                const targetId = edge.data('target') as string;
                const endpointsVisible =
                    !nodeSet || (nodeSet.has(sourceId) && nodeSet.has(targetId));

                if (edgeSet.has(edge.id()) && endpointsVisible) {
                    edge.removeClass('filtered-out');
                } else {
                    edge.addClass('filtered-out');
                }
            });
        });

        const visibleNodes = cy.nodes().not('.filtered-out');
        const visibleEdges = cy.edges().not('.filtered-out');
        if (visibleNodes.length > 1 && visibleEdges.length === 0) {
            visibleNodes.layout({
                name: 'circle',
                fit: false,
                avoidOverlap: true,
                spacingFactor: 1.2,
                animate: true,
                animationDuration: 300,
            } as any).run();
        }

        separateOverlappingNodes(visibleNodes);
    }, [visibleNodeIds, visibleEdgeIds]);

    useEffect(() => {
        if (!cyRef.current) return;
        const cy = cyRef.current;

        cy.batch(() => {
            cy.nodes().removeClass('query-highlighted');
            if (!queryHighlightedNodeIds || queryHighlightedNodeIds.size === 0) {
                return;
            }
            queryHighlightedNodeIds.forEach((nodeId) => {
                const node = cy.getElementById(nodeId);
                if (!node.empty()) {
                    node.addClass('query-highlighted');
                }
            });
        });
    }, [queryHighlightedNodeIds, elements]);

    // Highlight the focus node for local graph
    useEffect(() => {
        if (!cyRef.current || !focusNodeId) return;
        const cy = cyRef.current;
        const focusNode = cy.getElementById(focusNodeId);
        if (focusNode.length > 0) {
            focusNode.addClass('highlighted');
        }
    }, [focusNodeId]);

    // Highlight selected node links with accent color.
    useEffect(() => {
        if (!cyRef.current) return;
        const activeNodeId = hoveredNodeIdRef.current ?? selectedNodeId ?? null;
        applyNodeLinkHighlight(cyRef.current, activeNodeId);
    }, [selectedNodeId, elements]);

    // Read background color from CSS variables
    const rootStyle = getComputedStyle(document.documentElement);
    const bgColor =
        rootStyle.getPropertyValue('--graph-bg').trim() ||
        rootStyle.getPropertyValue('--color-bg-secondary').trim() ||
        '#f9fafb';

    return (
        <div
            ref={containerRef}
            style={{
                width: '100%',
                height: '100%',
                backgroundColor: bgColor,
            }}
        />
    );
}

function separateOverlappingNodes(nodes: cytoscape.NodeCollection): void {
    if (nodes.length < 2) return;

    const minDistance = 46;
    const maxIterations = 10;

    for (let iteration = 0; iteration < maxIterations; iteration++) {
        let moved = false;

        for (let i = 0; i < nodes.length; i++) {
            const a = nodes[i];
            const posA = a.position();

            for (let j = i + 1; j < nodes.length; j++) {
                const b = nodes[j];
                const posB = b.position();

                const dx = posB.x - posA.x;
                const dy = posB.y - posA.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance >= minDistance) {
                    continue;
                }

                const angle = distance === 0 ? Math.random() * Math.PI * 2 : Math.atan2(dy, dx);
                const offset = (minDistance - distance) / 2;
                const moveX = Math.cos(angle) * offset;
                const moveY = Math.sin(angle) * offset;

                a.position({ x: posA.x - moveX, y: posA.y - moveY });
                b.position({ x: posB.x + moveX, y: posB.y + moveY });
                moved = true;
            }
        }

        if (!moved) {
            break;
        }
    }
}

function applyNodeLinkHighlight(cy: Core, nodeId: string | null): void {
    cy.batch(() => {
        cy.nodes().removeClass('highlighted');
        cy.edges().removeClass('link-highlighted');

        if (!nodeId) {
            return;
        }

        const node = cy.getElementById(nodeId);
        if (node.empty()) {
            return;
        }

        node.addClass('highlighted');
        node.connectedEdges().addClass('link-highlighted');
    });
}
