/**
 * Normalizes Cypher tag-equality shorthand in WHERE predicates:
 * - n.tags = tag1, tag2
 * - n.tags = [tag1, tag2]
 * into:
 * - n.tags = ["tag1", "tag2"]
 */
export function normalizeCypherTagEqualityShorthand(query: string): string {
    const trimmed = query.trim();
    if (!trimmed) {
        return query;
    }

    const top = trimmed.match(/^MATCH\s+(.+?)(?:\s+WHERE\s+(.+?))?(?:\s+RETURN\s+(.+))?$/i);
    if (!top) {
        return query;
    }

    const patternText = top[1].trim();
    const whereText = (top[2] ?? "").trim();
    const returnText = (top[3] ?? "").trim();

    if (!whereText) {
        return query;
    }

    const parts = whereText
        .split(/\s+(AND|OR)\s+/i)
        .map((part) => part.trim())
        .filter((part) => part.length > 0);

    const normalizedParts = parts.map((part, index) => {
        if (index % 2 === 1) {
            return part;
        }
        return normalizeTagEqualsPredicate(part);
    });

    const nextWhere = normalizedParts.join(" ");
    const whereClause = nextWhere.length > 0 ? ` WHERE ${nextWhere}` : "";
    const returnClause = returnText.length > 0 ? ` RETURN ${returnText}` : "";
    return `MATCH ${patternText}${whereClause}${returnClause}`;
}

/**
 * Applies all Cypher UX normalizations:
 * - tag shorthand support
 * - optional RETURN clause (defaults to all MATCH variables)
 */
export function normalizeCypherQuery(query: string): string {
    const withTagShorthand = normalizeCypherTagEqualityShorthand(query);
    return ensureReturnClause(withTagShorthand);
}

function normalizeTagEqualsPredicate(predicate: string): string {
    const equalsMatch = predicate.match(
        /^([A-Za-z_][A-Za-z0-9_]*)\.(tags?)\s*=\s*(.+)$/i
    );
    if (!equalsMatch) {
        return predicate;
    }

    const left = `${equalsMatch[1]}.${equalsMatch[2]}`;
    const right = equalsMatch[3].trim();

    if (isAlreadyQuotedList(right)) {
        return predicate;
    }

    const normalizedTags = parseTagTokens(right);
    if (!normalizedTags) {
        return predicate;
    }

    const serialized = normalizedTags
        .map((tag) => `"${escapeDoubleQuoted(tag)}"`)
        .join(", ");
    return `${left} = [${serialized}]`;
}

function ensureReturnClause(query: string): string {
    const trimmed = query.trim().replace(/;$/, "");
    if (!trimmed) {
        return query;
    }

    const top = trimmed.match(/^MATCH\s+(.+?)(?:\s+WHERE\s+(.+?))?(?:\s+RETURN\s+(.+))?$/i);
    if (!top) {
        return query;
    }

    const patternText = top[1].trim();
    const whereText = (top[2] ?? "").trim();
    const returnText = (top[3] ?? "").trim();
    if (returnText.length > 0) {
        return trimmed;
    }

    const variables = extractPatternVariables(patternText);
    if (variables.length === 0) {
        return trimmed;
    }

    const whereClause = whereText.length > 0 ? ` WHERE ${whereText}` : "";
    const generatedReturn = variables.map((v) => `${v}.id`).join(", ");
    return `MATCH ${patternText}${whereClause} RETURN ${generatedReturn}`;
}

function extractPatternVariables(patternText: string): string[] {
    const regex = /\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)/g;
    const variables: string[] = [];
    const seen = new Set<string>();

    let match: RegExpExecArray | null;
    while ((match = regex.exec(patternText)) !== null) {
        const variable = match[1];
        if (seen.has(variable)) {
            continue;
        }
        seen.add(variable);
        variables.push(variable);
    }

    return variables;
}

function isAlreadyQuotedList(input: string): boolean {
    const trimmed = input.trim();
    if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
        return false;
    }

    const inner = trimmed.slice(1, -1).trim();
    if (!inner) {
        return true;
    }

    return inner
        .split(",")
        .map((token) => token.trim())
        .every((token) => /^"(?:[^"\\]|\\.)*"$|^'(?:[^'\\]|\\.)*'$/.test(token));
}

function parseTagTokens(input: string): string[] | null {
    const trimmed = input.trim();

    const inner = trimmed.startsWith("[") && trimmed.endsWith("]")
        ? trimmed.slice(1, -1).trim()
        : trimmed;

    if (!inner) {
        return [];
    }

    const rawTokens = inner.split(",").map((token) => token.trim());
    if (rawTokens.some((token) => token.length === 0)) {
        return null;
    }

    const tokens: string[] = [];
    for (const token of rawTokens) {
        const single = token.match(/^'(.*)'$/);
        if (single) {
            tokens.push(single[1].replace(/\\'/g, "'"));
            continue;
        }

        const double = token.match(/^"(.*)"$/);
        if (double) {
            tokens.push(double[1].replace(/\\"/g, '"'));
            continue;
        }

        if (/\s/.test(token)) {
            return null;
        }
        tokens.push(token);
    }

    return tokens;
}

function escapeDoubleQuoted(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
