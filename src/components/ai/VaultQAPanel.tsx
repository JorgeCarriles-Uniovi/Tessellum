import { useState, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Sparkles, Send, X } from "lucide-react";
import { theme } from "../../styles/theme";
import { useVaultStore } from "../../stores/vaultStore";
import { useAIStore } from "../../stores/aiStore";

interface SemanticHit {
    path: string;
    title: string;
    score: number;
}

interface AiTokenPayload {
    request_id: string;
    token: string;
    done: boolean;
    error?: string;
}

interface QAMessage {
    role: "user" | "assistant";
    content: string;
    citations?: string[];
}

let reqCounter = 0;
function nextReqId() {
    return `qa-${Date.now()}-${++reqCounter}`;
}

export function VaultQAPanel({ onClose }: { onClose: () => void }) {
    const vaultPath = useVaultStore((s) => s.vaultPath);
    const openNote = useVaultStore((s) => s.setActiveNote);
    const files = useVaultStore((s) => s.files);
    const providerConfig = useAIStore((s) => s.providerConfig);

    const [query, setQuery] = useState("");
    const [messages, setMessages] = useState<QAMessage[]>([]);
    const [streaming, setStreaming] = useState(false);
    const currentReqRef = useRef<string | null>(null);
    const unlistenRef = useRef<(() => void) | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const cleanupListener = useCallback(() => {
        if (unlistenRef.current) {
            unlistenRef.current();
            unlistenRef.current = null;
        }
    }, []);

    const handleSubmit = useCallback(async () => {
        if (!query.trim() || streaming || !vaultPath) return;
        const userQuery = query.trim();
        setQuery("");
        setMessages((prev) => [...prev, { role: "user", content: userQuery }]);
        setStreaming(true);

        // Retrieve relevant note chunks via semantic search
        let citations: string[] = [];
        let contextChunks = "";
        try {
            const hits = await invoke<SemanticHit[]>("semantic_search", {
                vaultPath,
                query: userQuery,
                topK: 5,
            });
            citations = hits.map((h) => h.path);

            // Read top-3 notes for context
            const contextParts: string[] = [];
            for (const hit of hits.slice(0, 3)) {
                try {
                    const content = await invoke<string>("read_file", {
                        vaultPath,
                        path: hit.path,
                    });
                    const snippet = content.slice(0, 800);
                    contextParts.push(`[${hit.title || hit.path}]\n${snippet}`);
                } catch {
                    // skip unreadable notes
                }
            }
            contextChunks = contextParts.join("\n\n---\n\n");
        } catch {
            // proceed without context
        }

        const prompt = `You are a helpful assistant for a personal knowledge base. Answer the question based ONLY on the provided notes. If the notes don't contain the answer, say so. Cite which note you used.\n\nQuestion: ${userQuery}`;

        // Stream AI response
        cleanupListener();
        const reqId = nextReqId();
        currentReqRef.current = reqId;

        // Append placeholder message
        setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "", citations },
        ]);

        const unlisten = await listen<AiTokenPayload>("ai-token", (event) => {
            const payload = event.payload;
            if (payload.request_id !== currentReqRef.current) return;

            if (payload.error) {
                setMessages((prev) =>
                    prev.map((m, i) =>
                        i === prev.length - 1
                            ? { ...m, content: `Error: ${payload.error}` }
                            : m
                    )
                );
                setStreaming(false);
                cleanupListener();
                return;
            }

            if (payload.token) {
                setMessages((prev) =>
                    prev.map((m, i) =>
                        i === prev.length - 1
                            ? { ...m, content: m.content + payload.token }
                            : m
                    )
                );
            }

            if (payload.done) {
                setStreaming(false);
                cleanupListener();
                scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
            }
        });
        unlistenRef.current = unlisten;

        try {
            await invoke("ai_generate", {
                prompt,
                context: contextChunks,
                providerConfig,
                requestId: reqId,
            });
        } catch (err) {
            setMessages((prev) =>
                prev.map((m, i) =>
                    i === prev.length - 1
                        ? { ...m, content: `Error: ${String(err)}` }
                        : m
                )
            );
            setStreaming(false);
            cleanupListener();
        }
    }, [query, streaming, vaultPath, providerConfig, cleanupListener]);

    const getTitle = (path: string) => {
        const file = files.find((f) => f.path === path);
        return file?.name?.replace(/\.md$/, "") ?? path.split("/").pop()?.replace(/\.md$/, "") ?? path;
    };

    return (
        <div
            className="flex flex-col h-full"
            style={{ background: theme.colors.background.secondary }}
        >
            {/* Header */}
            <div
                className="flex items-center gap-2 px-4 py-3 flex-shrink-0"
                style={{ borderBottom: `1px solid ${theme.colors.border.light}` }}
            >
                <Sparkles size={15} style={{ color: "var(--primary)" }} />
                <span className="text-sm font-semibold flex-1" style={{ color: theme.colors.text.primary }}>
                    Vault Q&A
                </span>
                <button
                    className="flex items-center justify-center w-6 h-6 rounded transition-colors"
                    style={{ background: "transparent", border: "none", color: theme.colors.text.muted, cursor: "pointer" }}
                    onClick={onClose}
                >
                    <X size={14} />
                </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {messages.length === 0 && (
                    <p
                        className="text-xs text-center mt-8"
                        style={{ color: theme.colors.text.muted }}
                    >
                        Ask anything about your notes. The AI uses your vault as context.
                    </p>
                )}

                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div
                            className="max-w-[85%] rounded-xl px-3 py-2 text-sm"
                            style={{
                                background:
                                    msg.role === "user"
                                        ? "var(--primary)"
                                        : theme.colors.background.primary,
                                color:
                                    msg.role === "user"
                                        ? "#fff"
                                        : theme.colors.text.primary,
                                border:
                                    msg.role === "assistant"
                                        ? `1px solid ${theme.colors.border.light}`
                                        : "none",
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                            }}
                        >
                            {msg.content || (streaming && idx === messages.length - 1 ? (
                                <span
                                    className="inline-block w-2 h-4 rounded-sm animate-pulse"
                                    style={{ background: "var(--primary)" }}
                                />
                            ) : null)}

                            {/* Citations */}
                            {msg.role === "assistant" && msg.citations && msg.citations.length > 0 && (
                                <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${theme.colors.border.light}` }}>
                                    <p className="text-[0.625rem] mb-1" style={{ color: theme.colors.text.muted }}>
                                        Sources:
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                        {msg.citations.map((path) => (
                                            <button
                                                key={path}
                                                className="text-[0.625rem] px-1.5 py-0.5 rounded transition-colors"
                                                style={{
                                                    background: "color-mix(in srgb, var(--primary) 12%, transparent)",
                                                    color: "var(--primary)",
                                                    border: "none",
                                                    cursor: "pointer",
                                                }}
                                                onClick={() => {
                                                    const file = files.find((f) => f.path === path);
                                                    if (file) openNote(file);
                                                }}
                                            >
                                                {getTitle(path)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Input */}
            <div
                className="flex-shrink-0 px-4 py-3 flex gap-2 items-end"
                style={{ borderTop: `1px solid ${theme.colors.border.light}` }}
            >
                <textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit();
                        }
                    }}
                    placeholder="Ask about your notes… (Enter to send)"
                    rows={2}
                    className="flex-1 text-sm resize-none rounded-lg px-3 py-2"
                    style={{
                        background: theme.colors.background.primary,
                        border: `1px solid ${theme.colors.border.light}`,
                        color: theme.colors.text.primary,
                        outline: "none",
                        fontFamily: "inherit",
                    }}
                />
                <button
                    className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0"
                    style={{
                        background: "var(--primary)",
                        border: "none",
                        color: "#fff",
                        cursor: !query.trim() || streaming ? "default" : "pointer",
                        opacity: !query.trim() || streaming ? 0.6 : 1,
                    }}
                    disabled={!query.trim() || streaming}
                    onClick={handleSubmit}
                >
                    <Send size={15} />
                </button>
            </div>
        </div>
    );
}
