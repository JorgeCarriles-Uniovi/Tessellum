function isFenceLine(line: string): boolean {
    const trimmed = line.trimStart();
    return trimmed.startsWith("```") || trimmed.startsWith("~~~");
}

function isBlockedLine(line: string): boolean {
    return line.trimStart().startsWith(">");
}

export function stripInlineCodeSpansForTagScan(line: string): string {
    let result = "";
    let i = 0;
    let inCode = false;
    let delimiterLen = 0;

    while (i < line.length) {
        if (line[i] === "`") {
            const runStart = i;
            while (i < line.length && line[i] === "`") {
                i += 1;
            }
            const runLen = i - runStart;

            if (!inCode) {
                inCode = true;
                delimiterLen = runLen;
            } else if (runLen === delimiterLen) {
                inCode = false;
                delimiterLen = 0;
            }

            result += " ".repeat(runLen);
            continue;
        }

        result += inCode ? " " : line[i];
        i += 1;
    }

    return result;
}

export function getIgnoredTagLineNumbers(content: string): Set<number> {
    const ignored = new Set<number>();
    const lines = content.split(/\r?\n/);
    let inFencedBlock = false;

    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        const lineNumber = i + 1;

        if (isFenceLine(line)) {
            ignored.add(lineNumber);
            inFencedBlock = !inFencedBlock;
            continue;
        }

        if (inFencedBlock || isBlockedLine(line)) {
            ignored.add(lineNumber);
        }
    }

    return ignored;
}




