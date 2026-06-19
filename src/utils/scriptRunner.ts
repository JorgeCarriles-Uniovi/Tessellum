// Script runner: executes user scripts in a controlled context via Function evaluation.
// Scripts receive a restricted API object. No Worker is used to avoid CSP complexity.

import { invoke } from "@tauri-apps/api/core";

export interface ScriptAPI {
    read_note: (path: string) => Promise<string>;
    write_note: (path: string, content: string) => Promise<void>;
    query_index: (query: string, topK?: number) => Promise<Array<{ path: string; title: string; score: number }>>;
    send_notification: (message: string) => void;
    open_file: (path: string) => void;
    log: (...args: unknown[]) => void;
}

export interface ScriptRunResult {
    output: string[];
    error?: string;
    duration: number;
}

export async function runScript(
    code: string,
    vaultPath: string,
    opts: {
        onOpenFile?: (path: string) => void;
        onNotification?: (msg: string) => void;
    } = {}
): Promise<ScriptRunResult> {
    const output: string[] = [];
    const start = Date.now();

    const api: ScriptAPI = {
        read_note: async (path: string) => {
            return invoke<string>("read_file", { vaultPath, path });
        },
        write_note: async (path: string, content: string) => {
            await invoke("write_file", { vaultPath, path, content });
        },
        query_index: async (query: string, topK = 10) => {
            return invoke("semantic_search", { vaultPath, query, topK });
        },
        send_notification: (message: string) => {
            output.push(`[notification] ${message}`);
            opts.onNotification?.(message);
        },
        open_file: (path: string) => {
            output.push(`[open] ${path}`);
            opts.onOpenFile?.(path);
        },
        log: (...args: unknown[]) => {
            const msg = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
            output.push(msg);
        },
    };

    try {
        // Wrap code in an async function that receives the api object
        const wrapped = `
(async function(tessellum) {
    const { read_note, write_note, query_index, send_notification, open_file, log } = tessellum;
    ${code}
})`;
        // eslint-disable-next-line no-new-func
        const fn = Function(`"use strict"; return ${wrapped}`)();
        await fn(api);
        return { output, duration: Date.now() - start };
    } catch (err) {
        return {
            output,
            error: String(err),
            duration: Date.now() - start,
        };
    }
}
