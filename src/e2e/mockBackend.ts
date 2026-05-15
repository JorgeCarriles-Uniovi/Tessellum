import type { FileMetadata, TreeNode } from "../types";
import type { TrashItem } from "../components/TrashModal/types";
import { emitEvent } from "./tauri/event";

export type E2ESeed = {
    vaultPath: string;
    files: Record<string, string>;
};

type MockFile = {
    path: string;
    content: string;
    isDir: boolean;
    lastModified: number;
};

type MockVault = {
    vaultPath: string;
    files: Map<string, MockFile>;
    trash: Map<string, MockFile>;
};

type E2EState = {
    seed?: E2ESeed;
    vault?: MockVault;
    vaultPath?: string;
    seedVault?: (seed: E2ESeed) => void;
};

type SearchReadinessPayload = {
    status: "idle" | "warming" | "ready" | "failed";
    attempt_count: number;
    max_attempts: number;
    retry_delay_ms: number;
    reopen_required: boolean;
    last_error?: string | null;
};

type FullTextSearchRequest = {
    query: string;
    limit?: number;
    offset?: number;
    include_snippets?: boolean;
    tag_filter?: { tags: string[]; match_mode: "All" | "Any" };
};

type FullTextSearchResponse = {
    total: number;
    hits: Array<{
        path: string;
        relative_path: string;
        title: string;
        score: number;
        snippet?: string | null;
        tags: string[];
    }>;
};

type GraphData = {
    nodes: Array<{
        id: string;
        label: string;
        exists: boolean;
        orphan: boolean;
        tags: string[];
    }>;
    edges: Array<{
        source: string;
        target: string;
        broken: boolean;
    }>;
};

declare global {
    interface Window {
        __E2E__?: E2EState;
    }
}

const DEFAULT_VAULT_PATH = "mock://vault";

function getState(): E2EState {
    if (!window.__E2E__) {
        window.__E2E__ = {};
    }
    if (!window.__E2E__.seedVault) {
        window.__E2E__.seedVault = seedVault;
    }
    return window.__E2E__;
}

function normalizePath(value: string): string {
    return value.replace(/\\/g, "/").replace(/^\/+/, "");
}

function getFilename(value: string): string {
    const normalized = normalizePath(value);
    const parts = normalized.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? normalized;
}

function withoutExtension(filename: string): string {
    return filename.replace(/\.[^.]+$/, "");
}

function buildMetadata(file: MockFile): FileMetadata {
    return {
        path: file.path,
        filename: getFilename(file.path),
        is_dir: file.isDir,
        size: file.content.length,
        last_modified: file.lastModified,
    };
}

function ensureVault(): MockVault {
    const state = getState();
    if (!state.vault) {
        if (state.seed) {
            seedVault(state.seed);
        } else {
            seedVault({ vaultPath: DEFAULT_VAULT_PATH, files: {} });
        }
    }
    return state.vault as MockVault;
}

function seedVault(seed: E2ESeed): void {
    const files = new Map<string, MockFile>();
    Object.entries(seed.files).forEach(([relativePath, content]) => {
        const path = normalizePath(relativePath);
        files.set(path, {
            path,
            content,
            isDir: false,
            lastModified: Date.now(),
        });
    });
    const vault: MockVault = {
        vaultPath: seed.vaultPath,
        files,
        trash: new Map(),
    };
    const state = getState();
    state.seed = seed;
    state.vault = vault;
    state.vaultPath = seed.vaultPath;
}

function getDirectoryPaths(paths: string[]): string[] {
    const directories = new Set<string>();
    paths.forEach((filePath) => {
        const parts = normalizePath(filePath).split("/").filter(Boolean);
        let current = "";
        parts.slice(0, -1).forEach((part) => {
            current = current ? `${current}/${part}` : part;
            directories.add(current);
        });
    });
    return [...directories];
}

function buildTree(files: MockFile[]): TreeNode[] {
    const nodeMap = new Map<string, TreeNode>();
    const roots: TreeNode[] = [];

    const ensureNode = (id: string, name: string, isDir: boolean): TreeNode => {
        const existing = nodeMap.get(id);
        if (existing) {
            return existing;
        }
        const file: MockFile = {
            path: id,
            content: "",
            isDir,
            lastModified: Date.now(),
        };
        const node: TreeNode = {
            id,
            name,
            is_dir: isDir,
            children: [],
            file: buildMetadata(file),
        };
        nodeMap.set(id, node);
        return node;
    };

    const addToParent = (parentId: string | null, node: TreeNode) => {
        if (!parentId) {
            if (!roots.includes(node)) {
                roots.push(node);
            }
            return;
        }
        const parent = nodeMap.get(parentId);
        if (parent && !parent.children.includes(node)) {
            parent.children.push(node);
        }
    };

    const allPaths = files.map((file) => file.path);
    const directories = getDirectoryPaths(allPaths);

    directories.forEach((dirPath) => {
        const name = getFilename(dirPath);
        const node = ensureNode(dirPath, name, true);
        const parent = normalizePath(dirPath).split("/").slice(0, -1).join("/") || null;
        addToParent(parent, node);
    });

    files.forEach((file) => {
        const node = ensureNode(file.path, getFilename(file.path), false);
        node.file = buildMetadata(file);
        const parent = normalizePath(file.path).split("/").slice(0, -1).join("/") || null;
        addToParent(parent, node);
    });

    return roots.sort((a, b) => a.name.localeCompare(b.name));
}

function findUniqueFilename(targetDir: string, title: string, files: Map<string, MockFile>): string {
    const baseName = title.trim() || "Untitled";
    let suffix = "";
    let counter = 0;
    while (true) {
        const candidate = `${baseName}${suffix}.md`;
        const fullPath = targetDir ? `${targetDir}/${candidate}` : candidate;
        if (!files.has(fullPath)) {
            return fullPath;
        }
        counter += 1;
        suffix = ` (${counter})`;
    }
}

function parseTags(content: string): string[] {
    const matches = content.match(/(^|\s)#([\w-]+)/g) ?? [];
    const tags = matches.map((match) => match.trim().slice(1));
    return [...new Set(tags)];
}

function parseLinks(content: string): string[] {
    const links: string[] = [];
    const regex = /\[\[([^\]]+)\]\]/g;
    let match: RegExpExecArray | null = null;
    while ((match = regex.exec(content)) !== null) {
        const value = match[1]?.trim();
        if (value) {
            links.push(value);
        }
    }
    return links;
}

function getSearchReadiness(): SearchReadinessPayload {
    return {
        status: "ready",
        attempt_count: 0,
        max_attempts: 1,
        retry_delay_ms: 0,
        reopen_required: false,
    };
}

function buildSearchResponse(vault: MockVault, request: FullTextSearchRequest): FullTextSearchResponse {
    const query = request.query.trim().toLowerCase();
    const tags = request.tag_filter?.tags ?? [];
    const matchAll = (request.tag_filter?.match_mode ?? "All") === "All";

    const hits = [...vault.files.values()]
        .filter((file) => !file.isDir)
        .filter((file) => {
            const content = file.content.toLowerCase();
            const filename = getFilename(file.path).toLowerCase();
            const tagMatches = tags.length === 0
                ? true
                : tags[matchAll ? "every" : "some"]((tag) => content.includes(`#${tag.toLowerCase()}`));
            const queryMatch = query ? content.includes(query) || filename.includes(query) : true;
            return tagMatches && queryMatch;
        })
        .map((file) => {
            const title = withoutExtension(getFilename(file.path));
            const snippet = request.include_snippets
                ? file.content.slice(0, 120)
                : null;
            return {
                path: file.path,
                relative_path: file.path,
                title,
                score: 1,
                snippet,
                tags: parseTags(file.content),
            };
        });

    const offset = request.offset ?? 0;
    const limit = request.limit ?? hits.length;

    return {
        total: hits.length,
        hits: hits.slice(offset, offset + limit),
    };
}

function buildGraphData(vault: MockVault): GraphData {
    const files = [...vault.files.values()].filter((file) => !file.isDir);
    const filenameMap = new Map<string, string>();
    files.forEach((file) => {
        filenameMap.set(withoutExtension(getFilename(file.path)), file.path);
    });

    const edges = files.flatMap((file) => {
        const links = parseLinks(file.content);
        return links.map((link) => {
            const target = filenameMap.get(link) ?? link;
            return {
                source: file.path,
                target,
                broken: !vault.files.has(target),
            };
        });
    });

    const connected = new Set<string>();
    edges.forEach((edge) => {
        connected.add(edge.source);
        connected.add(edge.target);
    });

    const nodes = files.map((file) => ({
        id: file.path,
        label: withoutExtension(getFilename(file.path)),
        exists: true,
        orphan: !connected.has(file.path),
        tags: parseTags(file.content),
    }));

    return { nodes, edges };
}

function toTrashItem(file: MockFile): TrashItem {
    const filename = getFilename(file.path);
    const parentLabel = normalizePath(file.path).split("/").slice(0, -1).join("/") || "Vault";
    return {
        path: file.path,
        filename,
        display_name: filename,
        original_name: filename,
        parent_label: parentLabel,
        restore_path: file.path,
        is_dir: file.isDir,
        timestamp: Date.now(),
    };
}

export async function invokeMock<T>(command: string, payload?: Record<string, unknown>): Promise<T> {
    const vault = ensureVault();

    switch (command) {
        case "set_vault_path": {
            const path = String(payload?.path ?? vault.vaultPath);
            const state = getState();
            state.vaultPath = path;
            vault.vaultPath = path;
            return undefined as T;
        }
        case "ensure_feature_demo_in_empty_vault":
            return false as T;
        case "list_files": {
            const fileList = [...vault.files.values()];
            const dirPaths = getDirectoryPaths(fileList.map((file) => file.path));
            const dirs = dirPaths.map((dir) => ({
                path: dir,
                content: "",
                isDir: true,
                lastModified: Date.now(),
            }));
            return [...dirs, ...fileList].map(buildMetadata) as T;
        }
        case "list_files_tree": {
            const tree = buildTree([...vault.files.values()]);
            return tree as T;
        }
        case "read_file": {
            const path = normalizePath(String(payload?.path ?? ""));
            const file = vault.files.get(path);
            return (file?.content ?? "") as T;
        }
        case "write_file": {
            const path = normalizePath(String(payload?.path ?? ""));
            const content = String(payload?.content ?? "");
            vault.files.set(path, {
                path,
                content,
                isDir: false,
                lastModified: Date.now(),
            });
            emitEvent("file-changed");
            return undefined as T;
        }
        case "create_note": {
            const targetDir = normalizePath(String(payload?.vaultPath ?? ""));
            const title = String(payload?.title ?? "Untitled");
            const normalizedDir = targetDir.endsWith(".md")
                ? targetDir.split("/").slice(0, -1).join("/")
                : targetDir;
            const path = findUniqueFilename(normalizedDir, title, vault.files);
            vault.files.set(path, {
                path,
                content: `# ${title}\n\n`,
                isDir: false,
                lastModified: Date.now(),
            });
            emitEvent("file-changed");
            return path as T;
        }
        case "create_note_from_template": {
            const targetDir = normalizePath(String(payload?.targetDir ?? payload?.vaultPath ?? ""));
            const title = String(payload?.title ?? "Untitled");
            const templateContent = String(payload?.templateContent ?? "");
            const normalizedDir = targetDir.endsWith(".md")
                ? targetDir.split("/").slice(0, -1).join("/")
                : targetDir;
            const path = findUniqueFilename(normalizedDir, title, vault.files);
            vault.files.set(path, {
                path,
                content: templateContent || `# ${title}\n\n`,
                isDir: false,
                lastModified: Date.now(),
            });
            emitEvent("file-changed");
            return path as T;
        }
        case "list_templates": {
            const templates = [...vault.files.values()]
                .filter((file) => file.path.includes(".tessellum/templates/") && !file.isDir)
                .map((file) => ({
                    name: withoutExtension(getFilename(file.path)),
                    path: file.path,
                }));
            return templates as T;
        }
        case "trash_items": {
            const itemPaths = (payload?.itemPaths as string[]) ?? [];
            const deletedPaths: string[] = [];
            itemPaths.forEach((itemPath) => {
                const normalized = normalizePath(itemPath);
                const file = vault.files.get(normalized);
                if (file) {
                    vault.files.delete(normalized);
                    vault.trash.set(normalized, file);
                    deletedPaths.push(normalized);
                }
            });
            return {
                deleted_paths: deletedPaths,
                failed: [],
            } as T;
        }
        case "list_trash_items": {
            return [...vault.trash.values()].map(toTrashItem) as T;
        }
        case "restore_trash_item": {
            const trashItemPath = normalizePath(String(payload?.trashItemPath ?? ""));
            const file = vault.trash.get(trashItemPath);
            if (file) {
                vault.trash.delete(trashItemPath);
                vault.files.set(trashItemPath, file);
            }
            return trashItemPath as T;
        }
        case "delete_trash_item_permanently": {
            const trashItemPath = normalizePath(String(payload?.trashItemPath ?? ""));
            vault.trash.delete(trashItemPath);
            return undefined as T;
        }
        case "get_search_readiness":
        case "ensure_search_ready":
        case "reset_search_readiness_attempts":
            return getSearchReadiness() as T;
        case "search_full_text": {
            const request = payload?.request as FullTextSearchRequest;
            return buildSearchResponse(vault, request) as T;
        }
        case "get_graph_data": {
            return buildGraphData(vault) as T;
        }
        case "get_file_tags": {
            const path = normalizePath(String(payload?.path ?? ""));
            const file = vault.files.get(path);
            return (file ? parseTags(file.content) : []) as T;
        }
        case "sync_vault":
        case "watch_vault":
        case "unwatch_vault":
        case "move_items":
            return undefined as T;
        default:
            console.warn(`[e2e-mock] Unhandled invoke: ${command}`);
            return undefined as T;
    }
}

export function convertFileSrcMock(path: string): string {
    return `asset://${path}`;
}

