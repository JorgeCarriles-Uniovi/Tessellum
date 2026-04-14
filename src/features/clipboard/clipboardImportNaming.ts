function splitFileName(fileName: string): { stem: string; extension: string } {
    const lastDotIndex = fileName.lastIndexOf(".");
    if (lastDotIndex <= 0) {
        return { stem: fileName, extension: "" };
    }

    return {
        stem: fileName.slice(0, lastDotIndex),
        extension: fileName.slice(lastDotIndex),
    };
}

function joinPath(destinationDir: string, fileName: string): string {
    const separator = destinationDir.endsWith("/") ? "" : "/";
    return `${destinationDir}${separator}${fileName}`;
}

export function buildAutoRenamedPath(
    destinationDir: string,
    fileName: string,
    hasConflict: (candidate: string) => boolean,
): string {
    const initialCandidate = joinPath(destinationDir, fileName);
    if (!hasConflict(initialCandidate)) {
        return initialCandidate;
    }

    const { stem, extension } = splitFileName(fileName);
    let copyIndex = 1;

    while (true) {
        const renamedFileName = `${stem} (${copyIndex})${extension}`;
        const candidatePath = joinPath(destinationDir, renamedFileName);
        if (!hasConflict(candidatePath)) {
            return candidatePath;
        }
        copyIndex += 1;
    }
}
