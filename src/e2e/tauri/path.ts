export async function join(...parts: string[]): Promise<string> {
    return parts.filter(Boolean).join("/");
}

export async function dirname(path: string): Promise<string> {
    const normalized = path.replace(/\\/g, "/");
    const segments = normalized.split("/").filter(Boolean);
    return segments.slice(0, -1).join("/") || "";
}

export async function extname(fileName: string): Promise<string> {
    const match = /\.[^.]+$/.exec(fileName);
    return match ? match[0] : "";
}

