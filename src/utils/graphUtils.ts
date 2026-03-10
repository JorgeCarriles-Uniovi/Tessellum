import cytoscape from "cytoscape";

export interface GraphNode {
    id: string; // The full path
    label: string; // The filename
    exists: boolean; // Does the file exist?
}

export interface GraphEdge {
    source: string; // The path of the parent string
    target: string; // The path of the child string
    broken: boolean; // Does the target exist?
}

interface BackendGraphNode {
    id: string;
    label: string;
    exists: boolean;
    orphan: boolean;
}

interface BackendGraphEdge {
    source: string;
    target: string;
    broken: boolean;
}

export interface GraphData {
    nodes: BackendGraphNode[];
    edges: BackendGraphEdge[];
}

export function mapGraphDataToElements(data: GraphData): cytoscape.ElementDefinition[] {
    const elements: cytoscape.ElementDefinition[] = [];

    // Add nodes
    for (const node of data.nodes) {
        elements.push({
            data: {
                id: node.id,
                label: node.label,
                exists: node.exists,
            },
            classes: node.orphan ? 'orphan' : ''
        });
    }

    // Add edges
    for (const edge of data.edges) {
        elements.push({
            data: {
                id: `${edge.source}->${edge.target}`,
                source: edge.source,
                target: edge.target,
                broken: edge.broken,
            },
        });
    }

    return elements;
}

/**
 * Reads CSS custom properties from the DOM and returns a Cytoscape stylesheet.
 */
export function getCytoscapeStylesheet(): any[] {
    const root = document.documentElement;
    const style = getComputedStyle(root);

    const graphBg = style.getPropertyValue('--graph-node').trim() || '#3b82f6';
    const graphOrphan = style.getPropertyValue('--graph-node-orphan').trim() || '#9ca3af';
    const graphMissing = style.getPropertyValue('--graph-node-missing').trim() || '#d1d5db';
    const graphLabel = style.getPropertyValue('--graph-node-label').trim() || '#111827';
    const graphEdge = style.getPropertyValue('--graph-edge').trim() || '#d1d5db';
    const graphEdgeBroken = style.getPropertyValue('--graph-edge-broken').trim() || '#9ca3af';
    const graphNodeActive = style.getPropertyValue('--graph-node-active').trim() || '#2563eb';

    return [
        {
            selector: 'node',
            style: {
                'background-color': graphBg,
                'label': 'data(label)',
                'font-size': '10px',
                'color': graphLabel,
                'text-valign': 'bottom',
                'text-halign': 'center',
                'text-margin-y': 6,
                'width': 20,
                'height': 20,
                'border-width': 2,
                'border-color': graphBg,
                'text-max-width': '80px',
                'text-wrap': 'ellipsis',
            },
        },
        {
            selector: 'node[?exists]',
            style: {
                'background-color': graphBg,
                'border-color': graphBg,
            },
        },
        {
            selector: 'node[!exists]',
            style: {
                'background-color': graphMissing,
                'border-color': graphMissing,
                'border-style': 'dashed',
            },
        },
        {
            selector: 'node.orphan',
            style: {
                'background-color': graphOrphan,
                'border-color': graphOrphan,
            },
        },
        {
            selector: 'node:selected, node.highlighted',
            style: {
                'background-color': graphNodeActive,
                'border-color': graphNodeActive,
                'border-width': 3,
                'width': 26,
                'height': 26,
            },
        },
        {
            selector: 'edge',
            style: {
                'width': 1.5,
                'line-color': graphEdge,
                'target-arrow-color': graphEdge,
                'target-arrow-shape': 'triangle',
                'arrow-scale': 0.8,
                'curve-style': 'bezier',
                'opacity': 0.6,
            },
        },
        {
            selector: 'edge[?broken]',
            style: {
                'line-style': 'dashed',
                'line-color': graphEdgeBroken,
                'target-arrow-color': graphEdgeBroken,
                'line-dash-pattern': [6, 3],
            },
        },
        {
            selector: 'node.hover',
            style: {
                'border-width': 3,
                'width': 24,
                'height': 24,
            },
        },
    ];
}

/**
 * Marks orphaned nodes (nodes with no edges) with the 'orphan' class.
 */
export function markOrphanNodes(cy: cytoscape.Core): void {
    cy.nodes().forEach((node: cytoscape.NodeSingular) => {
        if (node.degree(false) === 0) {
            node.addClass('orphan');
        } else {
            node.removeClass('orphan');
        }
    });
}
