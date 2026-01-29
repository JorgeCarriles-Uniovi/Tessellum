// shared-latex-utils.ts
export interface LatexMatch {
    start: number;
    end: number;
    formula: string;
    isBlock: boolean;
}

export function findLatexExpressions(text: string): LatexMatch[] {
    const matches: LatexMatch[] = [];
    let i = 0;

    while (i < text.length) {
        // Check for block math ($$)
        if (text[i] === '$' && text[i + 1] === '$') {
            const start = i;
            i += 2; // Skip opening $$

            // Find closing $$
            while (i < text.length - 1) {
                if (text[i] === '\\') {
                    i += 2; // Skip escaped character
                    continue;
                }
                if (text[i] === '$' && text[i + 1] === '$') {
                    const end = i + 2;
                    const formula = text.slice(start + 2, i);
                    matches.push({ start, end, formula, isBlock: true });
                    i = end;
                    break;
                }
                i++;
            }
            continue;
        }

        // Check for inline math ($)
        if (text[i] === '$') {
            const start = i;
            i++; // Skip opening $

            // Find closing $ (must be on same line)
            while (i < text.length) {
                if (text[i] === '\n') {
                    // No closing $ on this line, not a valid inline math
                    i = start + 1;
                    break;
                }
                if (text[i] === '\\') {
                    i += 2; // Skip escaped character
                    continue;
                }
                if (text[i] === '$') {
                    const end = i + 1;
                    const formula = text.slice(start + 1, i);
                    matches.push({ start, end, formula, isBlock: false });
                    i = end;
                    break;
                }
                i++;
            }
            continue;
        }

        i++;
    }

    return matches;
}