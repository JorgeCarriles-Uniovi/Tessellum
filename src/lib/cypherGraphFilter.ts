import type { GraphData } from "../utils/graphUtils";

export interface GraphFilter {
    nodeIds: Set<string>;
    edgeIds: Set<string>;
}

type Direction = "out" | "in" | "undirected";
type LogicalOp = "AND" | "OR";
type Property = "id" | "label" | "tags" | "exists";
type Operator = "=" | "CONTAINS" | "IN";

interface RelationStep {
    leftVar: string;
    rightVar: string;
    direction: Direction;
}

interface Predicate {
    variable: string;
    property: Property;
    operator: Operator;
    value: string | string[] | boolean;
}

interface ParsedCypher {
    variables: string[];
    steps: RelationStep[];
    where?: Predicate[];
    whereOps?: LogicalOp[];
}

interface Binding {
    nodes: Map<string, GraphData["nodes"][number]>;
    edgeIds: string[];
}

export function runCypherGraphFilter(query: string, graphData: GraphData): GraphFilter {
    const parsed = parseCypher(query);
    const matches = findMatches(parsed, graphData);

    const nodeIds = new Set<string>();
    const edgeIds = new Set<string>();

    for (const match of matches) {
        for (const node of match.nodes.values()) {
            nodeIds.add(node.id);
        }
        for (const edgeId of match.edgeIds) {
            edgeIds.add(edgeId);
        }
    }

    return { nodeIds, edgeIds };
}

export function applyFilterToGraphData(
    graphData: GraphData,
    filter: GraphFilter
): GraphData {
    const nodes = graphData.nodes.filter((node) => filter.nodeIds.has(node.id));
    const nodeIdSet = new Set(nodes.map((node) => node.id));
    const edges = graphData.edges.filter((edge) => {
        if (filter.edgeIds.size > 0) {
            return filter.edgeIds.has(`${edge.source}->${edge.target}`);
        }
        return nodeIdSet.has(edge.source) && nodeIdSet.has(edge.target);
    });

    return { nodes, edges };
}

function parseCypher(query: string): ParsedCypher {
    const trimmed = query.trim().replace(/;$/, "");
    if (!trimmed) {
        return { variables: [], steps: [] };
    }

    const top = trimmed.match(/^MATCH\s+(.+?)(?:\s+WHERE\s+(.+?))?(?:\s+RETURN\s+(.+))?$/i);
    if (!top) {
        throw new Error(
            "Unsupported Cypher syntax. Use MATCH (n), MATCH (n) --> (x), or MATCH (n) -- (x) --> (y)."
        );
    }

    const patternText = top[1].trim();
    const whereText = (top[2] ?? "").trim();
    const returnText = (top[3] ?? "").trim();

    const pattern = parsePattern(patternText);
    if (returnText) {
        validateReturnClause(returnText, pattern.variables);
    }

    if (!whereText) {
        return { variables: pattern.variables, steps: pattern.steps };
    }

    const where = parseWhere(whereText, pattern.variables);
    return {
        variables: pattern.variables,
        steps: pattern.steps,
        where: where.predicates,
        whereOps: where.operators,
    };
}

function parsePattern(input: string): { variables: string[]; steps: RelationStep[] } {
    const tokenRegex = /\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)|(-->|<--|--)/g;
    const parts: Array<{ kind: "node"; value: string } | { kind: "rel"; value: string }> = [];

    let match: RegExpExecArray | null;
    while ((match = tokenRegex.exec(input)) !== null) {
        if (match[1]) {
            parts.push({ kind: "node", value: match[1] });
        } else {
            parts.push({ kind: "rel", value: match[2] });
        }
    }

    if (parts.length === 0) {
        throw new Error(`Invalid MATCH pattern "${input}".`);
    }
    if (parts[0].kind !== "node") {
        throw new Error("MATCH pattern must start with a node like (n).");
    }
    if (parts[parts.length - 1].kind !== "node") {
        throw new Error("MATCH pattern must end with a node like (x).");
    }

    const variables: string[] = [];
    const steps: RelationStep[] = [];

    for (let i = 0; i < parts.length; i += 2) {
        const node = parts[i];
        if (!node || node.kind !== "node") {
            throw new Error("Invalid node position in MATCH pattern.");
        }
        variables.push(node.value);

        const rel = parts[i + 1];
        const nextNode = parts[i + 2];
        if (!rel && !nextNode) {
            break;
        }
        if (!rel || rel.kind !== "rel" || !nextNode || nextNode.kind !== "node") {
            throw new Error(
                `Invalid relation chain in MATCH pattern "${input}". Use (n) -- (x) --> (y).`
            );
        }

        steps.push({
            leftVar: node.value,
            rightVar: nextNode.value,
            direction: rel.value === "-->" ? "out" : rel.value === "<--" ? "in" : "undirected",
        });
    }

    return { variables, steps };
}

function validateReturnClause(returnText: string, variables: string[]): void {
    const allowed = new Set<string>();
    for (const variable of variables) {
        const lower = variable.toLowerCase();
        allowed.add(lower);
        allowed.add(`${lower}.id`);
    }

    const returns = returnText
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value.length > 0);

    if (returns.length === 0 || returns.some((value) => !allowed.has(value))) {
        throw new Error(`Unsupported RETURN clause "${returnText}". Use variables from MATCH.`);
    }
}

function parseWhere(
    input: string,
    variables: string[]
): { predicates: Predicate[]; operators: LogicalOp[] } {
    const parts = input
        .split(/\s+(AND|OR)\s+/i)
        .map((part) => part.trim())
        .filter((part) => part.length > 0);

    if (parts.length === 0) {
        throw new Error("Invalid WHERE clause.");
    }

    const predicates: Predicate[] = [];
    const operators: LogicalOp[] = [];

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (i % 2 === 1) {
            const op = part.toUpperCase();
            if (op !== "AND" && op !== "OR") {
                throw new Error(`Invalid logical operator "${part}" in WHERE clause.`);
            }
            operators.push(op);
            continue;
        }
        predicates.push(parsePredicate(part, variables));
    }

    return { predicates, operators };
}

function parsePredicate(input: string, variables: string[]): Predicate {
    const containsMatch = input.match(
        /^([A-Za-z_][A-Za-z0-9_]*)\.(id|label|tags?)\s+CONTAINS\s+(.+)$/i
    );
    if (containsMatch) {
        const variable = normalizeVariable(containsMatch[1], variables);
        const property = normalizeProperty(containsMatch[2]);
        const value = parseString(containsMatch[3]);
        return { variable, property, operator: "CONTAINS", value };
    }

    const equalsMatch = input.match(
        /^([A-Za-z_][A-Za-z0-9_]*)\.(id|label|exists|tags?)\s*=\s*(.+)$/i
    );
    if (equalsMatch) {
        const variable = normalizeVariable(equalsMatch[1], variables);
        const property = normalizeProperty(equalsMatch[2]);
        const value = property === "exists"
            ? parseBool(equalsMatch[3])
            : property === "tags"
                ? parseTagEqualsValue(equalsMatch[3])
                : parseString(equalsMatch[3]);
        return { variable, property, operator: "=", value };
    }

    const inMatch = input.match(/^(.+)\s+IN\s+([A-Za-z_][A-Za-z0-9_]*)\.tags?$/i);
    if (inMatch) {
        const variable = normalizeVariable(inMatch[2], variables);
        const value = parseString(inMatch[1]);
        return { variable, property: "tags", operator: "IN", value };
    }

    throw new Error(`Unsupported WHERE predicate "${input}".`);
}

function normalizeVariable(value: string, allowed: string[]): string {
    const found = allowed.find((item) => item.toLowerCase() === value.toLowerCase());
    if (!found) {
        throw new Error(`Unknown variable "${value}" in WHERE clause.`);
    }
    return found;
}

function normalizeProperty(value: string): Property {
    const lower = value.toLowerCase();
    if (lower === "id") return "id";
    if (lower === "label") return "label";
    if (lower === "exists") return "exists";
    if (lower === "tag" || lower === "tags") return "tags";
    throw new Error(`Unsupported property "${value}".`);
}

function parseString(value: string): string {
    const trimmed = value.trim();
    const single = trimmed.match(/^'(.*)'$/);
    if (single) return single[1].replace(/\\'/g, "'");
    const double = trimmed.match(/^"(.*)"$/);
    if (double) return double[1].replace(/\\"/g, '"');
    throw new Error(`Expected quoted string but got "${value}".`);
}

function parseBool(value: string): boolean {
    const lower = value.trim().toLowerCase();
    if (lower === "true") return true;
    if (lower === "false") return false;
    throw new Error(`Expected boolean true/false but got "${value}".`);
}

function parseTagEqualsValue(value: string): string | string[] {
    const trimmed = value.trim();

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        const list = parseTagTokenList(trimmed.slice(1, -1));
        return list.length === 1 ? list[0] : list;
    }

    if (trimmed.includes(",")) {
        const list = parseTagTokenList(trimmed);
        return list.length === 1 ? list[0] : list;
    }

    return parseString(trimmed);
}

function parseTagTokenList(input: string): string[] {
    const tokens = input
        .split(",")
        .map((token) => token.trim())
        .filter((token) => token.length > 0)
        .map(parseTagToken);

    if (tokens.length === 0) {
        throw new Error("Expected at least one tag in tags comparison.");
    }

    return tokens;
}

function parseTagToken(token: string): string {
    const single = token.match(/^'(.*)'$/);
    if (single) return single[1].replace(/\\'/g, "'");

    const double = token.match(/^"(.*)"$/);
    if (double) return double[1].replace(/\\"/g, '"');

    if (/\s/.test(token)) {
        throw new Error(`Expected quoted tag token but got "${token}".`);
    }
    return token;
}

function findMatches(parsed: ParsedCypher, data: GraphData): Binding[] {
    if (parsed.variables.length === 0) {
        return [];
    }

    if (parsed.steps.length === 0) {
        return data.nodes
            .map((node) => {
                const binding: Binding = { nodes: new Map([[parsed.variables[0], node]]), edgeIds: [] };
                return evaluateWhere(parsed, binding) ? binding : null;
            })
            .filter((binding): binding is Binding => binding !== null);
    }

    const firstVar = parsed.variables[0];
    const results: Binding[] = [];

    for (const startNode of data.nodes) {
        const initial: Binding = { nodes: new Map([[firstVar, startNode]]), edgeIds: [] };
        expandFromStep(parsed, data, 0, initial, results);
    }

    return results;
}

function expandFromStep(
    parsed: ParsedCypher,
    data: GraphData,
    stepIndex: number,
    binding: Binding,
    results: Binding[]
): void {
    if (stepIndex >= parsed.steps.length) {
        if (evaluateWhere(parsed, binding)) {
            results.push(binding);
        }
        return;
    }

    const step = parsed.steps[stepIndex];
    const leftNode = binding.nodes.get(step.leftVar);
    if (!leftNode) {
        return;
    }

    for (const edge of data.edges) {
        const match = resolveEdgeMatch(edge, step.direction, leftNode.id);
        if (!match) {
            continue;
        }

        const rightNode = data.nodes.find((node) => node.id === match.nextNodeId);
        if (!rightNode) {
            continue;
        }

        const existing = binding.nodes.get(step.rightVar);
        if (existing && existing.id !== rightNode.id) {
            continue;
        }

        const nextNodes = new Map(binding.nodes);
        nextNodes.set(step.rightVar, rightNode);

        const nextEdgeIds = [...binding.edgeIds, `${edge.source}->${edge.target}`];
        const nextBinding: Binding = { nodes: nextNodes, edgeIds: nextEdgeIds };
        expandFromStep(parsed, data, stepIndex + 1, nextBinding, results);
    }
}

function resolveEdgeMatch(
    edge: GraphData["edges"][number],
    direction: Direction,
    leftNodeId: string
): { nextNodeId: string } | null {
    if (direction === "out") {
        if (edge.source === leftNodeId) {
            return { nextNodeId: edge.target };
        }
        return null;
    }

    if (direction === "in") {
        if (edge.target === leftNodeId) {
            return { nextNodeId: edge.source };
        }
        return null;
    }

    if (edge.source === leftNodeId) {
        return { nextNodeId: edge.target };
    }
    if (edge.target === leftNodeId) {
        return { nextNodeId: edge.source };
    }
    return null;
}

function evaluateWhere(parsed: ParsedCypher, binding: Binding): boolean {
    if (!parsed.where || parsed.where.length === 0) {
        return true;
    }

    const values = parsed.where.map((predicate) => evaluatePredicate(predicate, binding));
    let result = values[0];

    for (let i = 0; i < parsed.whereOps!.length; i++) {
        const op = parsed.whereOps![i];
        result = op === "AND" ? result && values[i + 1] : result || values[i + 1];
    }

    return result;
}

function evaluatePredicate(predicate: Predicate, binding: Binding): boolean {
    const node = binding.nodes.get(predicate.variable);
    if (!node) {
        return false;
    }

    if (predicate.property === "exists") {
        if (typeof predicate.value !== "boolean") return false;
        return predicate.operator === "=" && node.exists === predicate.value;
    }

    if (predicate.property === "tags") {
        const nodeTags = normalizeTagSet(node.tags);
        if (predicate.operator === "CONTAINS") {
            if (typeof predicate.value !== "string") return false;
            const probe = predicate.value.toLowerCase();
            return node.tags.some((tag) => tag.toLowerCase().includes(probe));
        }

        if (typeof predicate.value === "string") {
            const probe = predicate.value.toLowerCase();
            return nodeTags.includes(probe);
        }
        if (!Array.isArray(predicate.value)) {
            return false;
        }

        const expectedTags = normalizeTagSet(predicate.value);
        if (expectedTags.length !== nodeTags.length) {
            return false;
        }
        return expectedTags.every((tag, index) => tag === nodeTags[index]);
    }

    const target = predicate.property === "id" ? node.id : node.label;
    if (typeof predicate.value !== "string") return false;
    const left = target.toLowerCase();
    const right = predicate.value.toLowerCase();

    if (predicate.operator === "CONTAINS") {
        return left.includes(right);
    }
    return left === right;
}

function normalizeTagSet(tags: string[]): string[] {
    return Array.from(new Set(tags.map((tag) => tag.toLowerCase()))).sort();
}
