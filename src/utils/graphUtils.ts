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
    tags: string[];
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

export function stringToColor(str: string): { base: string; dark: string; h: number } {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    // Base color: fairly saturated and bright
    const base = `hsl(${h}, 70%, 60%)`;
    // Faded out color for orphans
    const dark = `hsla(${h}, 70%, 60%, 0.3)`;
    return { base, dark, h };
}

export function mapGraphDataToElements(data: GraphData): cytoscape.ElementDefinition[] {
    const elements: cytoscape.ElementDefinition[] = [];

    // Add nodes
    for (const node of data.nodes) {
        let baseColor = undefined;
        let darkColor = undefined;

        if (node.tags && node.tags.length > 0) {
            const firstTag = node.tags[0];
            const colors = stringToColor(firstTag);
            baseColor = colors.base;
            darkColor = colors.dark;
        }

        elements.push({
            data: {
                id: node.id,
                label: node.label,
                exists: node.exists,
                baseColor: baseColor,
                darkColor: darkColor,
                tags: node.tags,
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

    const graphBg = style.getPropertyValue('--graph-node').trim() || style.getPropertyValue('--color-blue-500').trim();
    const graphOrphan = style.getPropertyValue('--graph-node-orphan').trim() || style.getPropertyValue('--color-gray-400').trim();
    const graphMissing = style.getPropertyValue('--graph-node-missing').trim() || style.getPropertyValue('--color-gray-300').trim();
    const graphLabel = style.getPropertyValue('--graph-node-label').trim() || style.getPropertyValue('--color-text-primary').trim();
    const graphEdge = style.getPropertyValue('--graph-edge').trim() || style.getPropertyValue('--color-border-medium').trim();
    const graphEdgeBroken = style.getPropertyValue('--graph-edge-broken').trim() || style.getPropertyValue('--color-gray-400').trim();
    const graphNodeActive = style.getPropertyValue('--graph-node-active').trim() || style.getPropertyValue('--color-blue-600').trim();
    const accentColor =
        style.getPropertyValue('--color-accent-default').trim() ||
        style.getPropertyValue('--color-accent').trim() ||
        style.getPropertyValue('--color-blue-600').trim();

    return [
        {
            selector: 'node',
            style: {
                'background-color': (ele: any) => ele.data('baseColor') || graphBg,
                'label': 'data(label)',
                'font-size': '10px',
                'color': graphLabel,
                'text-valign': 'bottom',
                'text-halign': 'center',
                'text-margin-y': 6,
                'width': 20,
                'height': 20,
                'border-width': 2,
                'border-color': (ele: any) => ele.data('baseColor') || graphBg,
                'text-max-width': '80px',
                'text-wrap': 'ellipsis',
            },
        },
        {
            selector: 'node[?exists]',
            style: {
                'background-color': (ele: any) => ele.data('baseColor') || graphBg,
                'border-color': (ele: any) => ele.data('baseColor') || graphBg,
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
                'background-color': (ele: any) => ele.data('baseColor') || graphOrphan,
                'border-color': (ele: any) => ele.data('baseColor') || graphOrphan,
                'background-opacity': 0.3,
                'border-opacity': 0.3,
            },
        },
        {
            selector: 'node:selected, node.highlighted',
            style: {
                'background-color': (ele: any) => ele.data('baseColor') || graphNodeActive,
                'border-color': (ele: any) => ele.data('baseColor') || graphNodeActive,
                'border-width': 3,
                'width': 26,
                'height': 26,
            },
        },
        {
            selector: 'node.query-highlighted',
            style: {
                'border-color': accentColor,
                'border-width': 4,
                'width': 28,
                'height': 28,
            },
        },
        {
            selector: 'node.orphan:selected, node.orphan.highlighted',
            style: {
                'background-color': (ele: any) => ele.data('baseColor') || graphOrphan,
                'border-color': (ele: any) => ele.data('baseColor') || graphOrphan,
                'background-opacity': 0.3,
                'border-opacity': 0.3,
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
            selector: 'edge.link-highlighted, edge[?broken].link-highlighted',
            style: {
                'line-color': accentColor,
                'target-arrow-color': accentColor,
                'width': 3.5,
                'opacity': 1,
            },
        },
        {
            selector: '.filtered-out',
            style: {
                display: 'none',
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
        // Only mark as orphan if it has literally no connected edges
        // (incoming or outgoing)
        if (node.connectedEdges().length === 0) {
            node.addClass('orphan');
        } else {
            node.removeClass('orphan');
        }
    });
}
