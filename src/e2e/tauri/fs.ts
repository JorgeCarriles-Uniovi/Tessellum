export type UnwatchFn = () => Promise<void>;

type FsEntry = {
    name: string;
    path: string;
    children?: FsEntry[];
    isFile: boolean;
    isDirectory: boolean;
};

export async function exists(path: string): Promise<boolean> {
    const vaultPath = window.__E2E__?.seed?.vaultPath;
    if (vaultPath && path === vaultPath) {
        return true;
    }
    return false;
}

export async function readDir(_path: string): Promise<FsEntry[]> {
    return [];
}

export async function readTextFile(_path: string): Promise<string> {
    return "";
}

export async function readFile(_path: string): Promise<Uint8Array> {
    return new Uint8Array();
}

export async function mkdir(_path: string, _options?: { recursive?: boolean }): Promise<void> {
    return undefined;
}

export async function watch(_path: string, _handler: (event: unknown) => void): Promise<UnwatchFn> {
    return async () => undefined;
}
