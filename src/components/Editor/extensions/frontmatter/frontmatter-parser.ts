import { Text } from "@codemirror/state";

export interface FrontmatterBlock {
    from: number;
    to: number;
    yaml: string;
    properties: Record<string, any>;
}

export function parseFrontmatter(doc: Text): FrontmatterBlock | null {
    if (doc.lines < 2) return null;

    const firstLine = doc.line(1);
    if (firstLine.text !== "---") {
        return null;
    }

    let endLineNum = -1;
    let yamlLines: string[] = [];

    for (let i = 2; i <= doc.lines; i++) {
        const line = doc.line(i);
        if (line.text === "---") {
            endLineNum = i;
            break;
        }
        yamlLines.push(line.text);
    }

    if (endLineNum === -1) {
        return null;
    }

    const endLine = doc.line(endLineNum);
    const yamlString = yamlLines.join("\n");

    // Lightweight parsing of YAML
    const properties: Record<string, any> = {};
    for (const line of yamlLines) {
        const match = line.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
        if (match) {
            const [, key, valueStr] = match;
            let val = valueStr.trim();
            // Basic handling of array [a, b]
            if (val.startsWith("[") && val.endsWith("]")) {
                const inner = val.slice(1, -1);
                properties[key] = inner.split(",")
                    .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
                    .filter(Boolean);
            } else {
                properties[key] = val.replace(/^['"]|['"]$/g, '');
            }
        }
    }

    return {
        from: firstLine.from,
        to: endLine.to,
        yaml: yamlString,
        properties
    };
}

export function stringifyFrontmatter(properties: Record<string, any>): string {
    let yaml = "---\n";
    for (const [key, value] of Object.entries(properties)) {
        if (Array.isArray(value)) {
            yaml += `${key}: [${value.join(", ")}]\n`;
        } else {
            yaml += `${key}: ${value}\n`;
        }
    }
    yaml += "---";
    return yaml;
}
