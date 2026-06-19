// Sandboxed script execution runtime
// This worker runs user scripts with a restricted API surface.
// The main thread brokers all vault operations.

export type ScriptMessage =
    | { type: "run"; scriptId: string; code: string }
    | { type: "api-response"; callId: number; result: unknown; error?: string };

export type WorkerMessage =
    | { type: "api-call"; callId: number; method: string; args: unknown[] }
    | { type: "log"; level: "log" | "warn" | "error"; message: string }
    | { type: "done"; scriptId: string; error?: string };
