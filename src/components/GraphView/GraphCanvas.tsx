import { useRef, useEffect } from 'react';
import cytoscape, { Core } from 'cytoscape';
import {
    getCytoscapeStylesheet,
    markOrphanNodes,
} from '../../utils/graphUtils';

interface GraphCanvasProps {
    elements: cytoscape.ElementDefinition[];
    mode: 'global' | 'local';
    focusNodeId?: string;
    onNodeClick: (nodeId: string) => void;
    onNodeDoubleClick: (nodeId: string) => void;
}

export function GraphCanvas({
                                elements,
                                mode,
                                focusNodeId,
                                onNodeClick,
                                onNodeDoubleClick,
                            }: GraphCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const cyRef = useRef<Core | null>(null);

    // Initialize Cytoscape
    useEffect(() => {
        if (!containerRef.current) return;

        const cy = cytoscape({
            container: containerRef.current,
            elements: elements,
            style: getCytoscapeStylesheet(),
            layout: {
                name: 'cose',
                animate: true,
                animationDuration: 500,
                randomize: true,
                nodeRepulsion: () => mode === 'global' ? 8000 : 4000,
                idealEdgeLength: () => mode === 'global' ? 100 : 60,
                gravity: mode === 'global' ? 0.25 : 0.8,
                numIter: mode === 'global' ? 1000 : 500,
                nodeDimensionsIncludeLabels: true,
            } as any,
            minZoom: 0.1,
            maxZoom: 5,
            wheelSensitivity: 0.3,
        });

        cyRef.current = cy;

        // Mark orphans
        markOrphanNodes(cy);

        // Event: single click
        cy.on('tap', 'node', (evt) => {
            const nodeId = evt.target.id();
            // Remove previous highlights
            cy.nodes().removeClass('highlighted');
            evt.target.addClass('highlighted');
            onNodeClick(nodeId);
        });

        // Event: double click
        let tapTimeout: ReturnType<typeof setTimeout> | null = null;
        let lastTapTime = 0;

        cy.on('tap', 'node', (evt) => {
            const now = Date.now();
            if (now - lastTapTime < 300) {
                // Double tap detected
                if (tapTimeout) clearTimeout(tapTimeout);
                onNodeDoubleClick(evt.target.id());
            }
            lastTapTime = now;
        });

        // Event: tap on background clears selection
        cy.on('tap', (evt) => {
            if (evt.target === cy) {
                cy.nodes().removeClass('highlighted');
                onNodeClick('');
            }
        });

        // Hover effects
        cy.on('mouseover', 'node', (evt) => {
            evt.target.addClass('hover');
            containerRef.current!.style.cursor = 'pointer';
        });

        cy.on('mouseout', 'node', (evt) => {
            evt.target.removeClass('hover');
            containerRef.current!.style.cursor = 'default';
        });

        // Focus on specific node for local graph
        if (focusNodeId) {
            cy.ready(() => {
                const focusNode = cy.getElementById(focusNodeId);
                if (focusNode.length > 0) {
                    focusNode.addClass('highlighted');
                    // Center on the focus node after layout
                    cy.one('layoutstop', () => {
                        cy.animate({
                            center: { eles: focusNode },
                            zoom: mode === 'local' ? 1.5 : undefined,
                        } as any);
                    });
                }
            });
        }

        return () => {
            cy.destroy();
            cyRef.current = null;
        };
    }, [elements, mode, focusNodeId]);

    // Update stylesheet when theme changes
    useEffect(() => {
        const observer = new MutationObserver(() => {
            if (cyRef.current) {
                cyRef.current.style(getCytoscapeStylesheet());
            }
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'], // watches for dark/light class toggle
        });

        return () => observer.disconnect();
    }, []);

    // Read background color from CSS variables
    const rootStyle = getComputedStyle(document.documentElement);
    const bgColor = rootStyle.getPropertyValue('--graph-bg').trim() || rootStyle.getPropertyValue('--color-bg-secondary').trim() || '#f9fafb';

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
