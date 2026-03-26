export interface CypherQuerySample {
    id: string;
    label: string;
    description: string;
    query: string;
}

export const CYPHER_QUERY_SAMPLES: CypherQuerySample[] = [
    {
        id: "all-notes",
        label: "All notes",
        description: "Show every note node in the graph.",
        query: "MATCH (n)",
    },
    {
        id: "single-tag",
        label: "Notes by tag",
        description: "Filter notes that contain a specific tag.",
        query: "MATCH (n) WHERE n.tags = rust",
    },
    {
        id: "multiple-tags",
        label: "Exact tag set",
        description: "Match notes with exactly this set of tags.",
        query: "MATCH (n) WHERE n.tags = rust, backend",
    },
    {
        id: "any-of-two-tags",
        label: "At least one of two tags",
        description: "Find notes that contain one tag or the other.",
        query: "MATCH (n) WHERE n.tags = rust OR n.tags = backend",
    },
    {
        id: "incoming-links",
        label: "Linked to selected pattern",
        description: "Find notes that link to notes with a matching title.",
        query: 'MATCH (n) --> (m) WHERE m.title CONTAINS "design"',
    },
    {
        id: "two-hop-chain",
        label: "Two-hop relations",
        description: "Traverse two connected relationships in sequence.",
        query: "MATCH (a) -- (b) -- (c)",
    },
];
