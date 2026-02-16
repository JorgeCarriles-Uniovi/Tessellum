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

/**
 * Extracts a display name from a file path.
 * Strips the vault path prefix and the .md extension.
 */
export function pathToLabel(filePath: string, vaultPath: string): string {
    // Normalize separators
    const normalized = filePath.replace(/\\/g, '/');
    const normalizedVault = vaultPath.replace(/\\/g, '/');

    // Remove vault prefix
    let relative = normalized;
    if (normalized.startsWith(normalizedVault)) {
        relative = normalized.slice(normalizedVault.length);
        if (relative.startsWith('/')) relative = relative.slice(1);
    }

    // Remove .md extension
    if (relative.endsWith('.md')) {
        relative = relative.slice(0, -3);
    }

    // Return just the filename (last segment)
    const parts = relative.split('/');
    return parts[parts.length - 1];
}

export function buildGraphElements(
    notes: [string, number][],
    links: [string, string][],
    vaultPath: string
): cytoscape.ElementDefinition[] {
    const elements: cytoscape.ElementDefinition[] = [];

    const existingPaths = new Set(notes.map(([path]) => path));

    // Add nodes for all existing notes
    for (const [path] of notes) {
        elements.push({
            data: {
                id: path,
                label: pathToLabel(path, vaultPath),
                exists: true,
            },
        });
    }

    // Process edges and add missing target nodes
    for (const [source, target] of links) {
        const targetExists = existingPaths.has(target);

        // If the target doesn't exist, add a ghost node
        if (!targetExists && !elements.some(el => el.data.id === target)) {
            elements.push({
                data: {
                    id: target,
                    label: pathToLabel(target, vaultPath),
                    exists: false,
                },
            });
        }

        elements.push({
            data: {
                id: `${source}->${target}`,
                source,
                target,
                broken: !targetExists,
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
