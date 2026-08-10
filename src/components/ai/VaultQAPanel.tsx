import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ArrowLeft, ArrowUp, File, Lock, Sparkle } from "lucide-react";
import { theme } from "../../styles/theme";
import { useVaultStore } from "../../stores/vaultStore";
import { useAIStore } from "../../stores/aiStore";
import { IconButton } from "../ui";

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

type QaScope = "note" | "vault";

let reqCounter = 0;
function nextReqId() {
    return `qa-${Date.now()}-${++reqCounter}`;
}

const NOTE_SCOPE_SUGGESTIONS = [
    "Summarize this note",
    "What are the open questions here?",
    "How does this connect to my other notes?",
];
const VAULT_SCOPE_SUGGESTIONS = [
    "What have I written about lately?",
    "What ideas keep recurring in my notes?",
    "What's still unresolved across my vault?",
];

function ThinkingDots() {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 0" }}>
            {[0, 150, 300].map((delay) => (
                <span
                    key={delay}
                    className="inline-block rounded-full animate-bounce"
                    style={{ width: 5, height: 5, background: theme.colors.text.muted, animationDelay: `${delay}ms` }}
                />
            ))}
        </div>
    );
}

export function VaultQAPanel({ onClose }: { onClose: () => void }) {
    const vaultPath = useVaultStore((s) => s.vaultPath);
    const activeNote = useVaultStore((s) => s.activeNote);
    const openNote = useVaultStore((s) => s.setActiveNote);
    const files = useVaultStore((s) => s.files);
    const providerConfig = useAIStore((s) => s.providerConfig);
    const isOnDevice = providerConfig.kind === "ollama";

    const [query, setQuery] = useState("");
    const [scope, setScope] = useState<QaScope>("vault");
    const [messages, setMessages] = useState<QAMessage[]>([]);
    const [streaming, setStreaming] = useState(false);
    const currentReqRef = useRef<string | null>(null);
    const unlistenRef = useRef<(() => void) | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scope === "note" && !activeNote) {
            setScope("vault");
        }
    }, [scope, activeNote]);

    const cleanupListener = useCallback(() => {
        if (unlistenRef.current) {
            unlistenRef.current();
            unlistenRef.current = null;
        }
    }, []);

    const handleSubmit = useCallback(async (overrideQuery?: string) => {
        const userQuery = (overrideQuery ?? query).trim();
        if (!userQuery || streaming || !vaultPath) return;
        setQuery("");
        setMessages((prev) => [...prev, { role: "user", content: userQuery }]);
        setStreaming(true);

        let citations: string[] = [];
        let contextChunks = "";
        try {
            if (scope === "note" && activeNote) {
                const content = await invoke<string>("read_file", {
                    vaultPath,
                    path: activeNote.path,
                });
                contextChunks = `[${activeNote.filename}]\n${content.slice(0, 3000)}`;
                citations = [activeNote.path];
            } else {
                const hits = await invoke<SemanticHit[]>("semantic_search", {
                    vaultPath,
                    query: userQuery,
                    topK: 5,
                });
                citations = hits.map((h) => h.path);

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
            }
        } catch {
            // proceed without context
        }

        const prompt = `You are a helpful assistant for a personal knowledge base. Answer the question based ONLY on the provided notes. If the notes don't contain the answer, say so. Cite which note you used.\n\nQuestion: ${userQuery}`;

        cleanupListener();
        const reqId = nextReqId();
        currentReqRef.current = reqId;

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
    }, [query, streaming, vaultPath, providerConfig, cleanupListener, scope, activeNote]);

    const getTitle = (path: string) => {
        const file = files.find((f) => f.path === path);
        return file?.filename?.replace(/\.md$/, "") ?? path.split("/").pop()?.replace(/\.md$/, "") ?? path;
    };

    const suggestions = scope === "note" && activeNote ? NOTE_SCOPE_SUGGESTIONS : VAULT_SCOPE_SUGGESTIONS;
    const showSuggestions = messages.length === 0;
    const sendDisabled = !query.trim() || streaming;

    const scopeTabStyle = (isActive: boolean): CSSProperties => ({
        flex: 1,
        padding: "5px 0",
        border: "none",
        borderRadius: 7,
        fontSize: 11,
        fontWeight: 600,
        fontFamily: "inherit",
        cursor: "pointer",
        background: isActive ? theme.colors.background.elevated : "transparent",
        color: isActive ? theme.colors.text.primary : theme.colors.text.tertiary,
        boxShadow: isActive ? theme.shadows.sm : "none",
    });

    return (
        <div
            className="flex flex-col h-full"
            style={{ background: theme.colors.background.secondary }}
        >
            {/* Header */}
            <div
                className="flex items-center gap-2 px-2 py-2.5 flex-shrink-0"
                style={{ borderBottom: `1px solid ${theme.colors.border.light}` }}
            >
                <IconButton label="Back" size={26} onClick={onClose}>
                    <ArrowLeft size={15} />
                </IconButton>
                <Sparkle size={15} style={{ color: "var(--color-accent-default)", flexShrink: 0 }} />
                <span className="text-sm font-semibold flex-1" style={{ color: theme.colors.text.primary }}>
                    Ask this vault
                </span>
                {isOnDevice && (
                    <span
                        title="Runs on-device — nothing leaves your vault"
                        className="inline-flex items-center gap-1.5 flex-shrink-0"
                        style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: theme.colors.semantic.green,
                            background: "color-mix(in srgb, var(--color-green) 14%, transparent)",
                            borderRadius: 20,
                            padding: "3px 8px",
                        }}
                    >
                        <span
                            aria-hidden
                            className="rounded-full"
                            style={{ width: 5, height: 5, background: theme.colors.semantic.green }}
                        />
                        On-device
                    </span>
                )}
            </div>

            {/* Scope toggle */}
            <div
                className="flex items-center gap-0.5 flex-shrink-0"
                style={{
                    background: theme.colors.background.app,
                    border: `1px solid ${theme.colors.border.light}`,
                    borderRadius: 9,
                    padding: 2,
                    margin: "10px 12px",
                }}
            >
                <button
                    type="button"
                    disabled={!activeNote}
                    title={activeNote ? undefined : "Open a note to ask about it"}
                    style={{ ...scopeTabStyle(scope === "note"), opacity: activeNote ? 1 : 0.45, cursor: activeNote ? "pointer" : "not-allowed" }}
                    onClick={() => activeNote && setScope("note")}
                >
                    This note
                </button>
                <button
                    type="button"
                    style={scopeTabStyle(scope === "vault")}
                    onClick={() => setScope("vault")}
                >
                    Whole vault
                </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-4">
                {showSuggestions && (
                    <>
                        <p
                            className="text-xs text-center mt-6"
                            style={{ color: theme.colors.text.muted }}
                        >
                            Ask anything about your notes. The AI uses your vault as context.
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
                            {suggestions.map((text) => (
                                <button
                                    key={text}
                                    type="button"
                                    onClick={() => handleSubmit(text)}
                                    className="transition-colors"
                                    style={{
                                        fontSize: 11.5,
                                        fontWeight: 500,
                                        color: "var(--color-accent-default)",
                                        background: "var(--color-accent-soft)",
                                        border: "1px solid color-mix(in srgb, var(--color-accent-default) 22%, transparent)",
                                        borderRadius: 20,
                                        padding: "5px 12px",
                                        cursor: "pointer",
                                        fontFamily: "inherit",
                                    }}
                                >
                                    {text}
                                </button>
                            ))}
                        </div>
                    </>
                )}

                {messages.map((msg, idx) => {
                    const isLast = idx === messages.length - 1;
                    if (msg.role === "user") {
                        return (
                            <div
                                key={idx}
                                style={{
                                    alignSelf: "flex-end",
                                    maxWidth: "88%",
                                    background: theme.colors.background.active,
                                    color: theme.colors.text.primary,
                                    fontSize: 13,
                                    lineHeight: 1.5,
                                    padding: "9px 13px",
                                    borderRadius: "14px 14px 4px 14px",
                                    whiteSpace: "pre-wrap",
                                    wordBreak: "break-word",
                                }}
                            >
                                {msg.content}
                            </div>
                        );
                    }

                    return (
                        <div key={idx} className="flex flex-col" style={{ gap: 9 }}>
                            <div className="flex items-center" style={{ gap: 7 }}>
                                <Sparkle size={13} style={{ color: "var(--color-accent-default)" }} />
                                <span
                                    style={{
                                        fontSize: 10.5,
                                        fontWeight: 600,
                                        letterSpacing: "0.06em",
                                        textTransform: "uppercase",
                                        color: theme.colors.text.muted,
                                    }}
                                >
                                    Answer
                                </span>
                            </div>

                            {msg.content ? (
                                <div
                                    style={{
                                        fontFamily: theme.typography.fontFamily.editor,
                                        fontSize: 14,
                                        lineHeight: 1.65,
                                        color: theme.colors.text.primary,
                                        whiteSpace: "pre-wrap",
                                        wordBreak: "break-word",
                                    }}
                                >
                                    {msg.content}
                                </div>
                            ) : streaming && isLast ? (
                                <ThinkingDots />
                            ) : null}

                            {msg.citations && msg.citations.length > 0 && (
                                <div className="flex flex-wrap" style={{ gap: 6 }}>
                                    {msg.citations.map((path) => (
                                        <button
                                            key={path}
                                            type="button"
                                            className="inline-flex items-center transition-colors"
                                            style={{
                                                gap: 5,
                                                fontSize: 11,
                                                fontWeight: 500,
                                                color: theme.colors.text.secondary,
                                                background: theme.colors.background.elevated,
                                                border: `1px solid ${theme.colors.border.light}`,
                                                borderRadius: 20,
                                                padding: "3px 10px",
                                                cursor: "pointer",
                                            }}
                                            onClick={() => {
                                                const file = files.find((f) => f.path === path);
                                                if (file) openNote(file);
                                            }}
                                        >
                                            <File size={10} style={{ color: theme.colors.text.muted }} />
                                            {getTitle(path)}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Input */}
            <div
                className="flex-shrink-0 px-3 pt-2.5 pb-3"
                style={{ borderTop: `1px solid ${theme.colors.border.light}` }}
            >
                <div
                    className="flex items-center"
                    style={{
                        gap: 8,
                        padding: "5px 5px 5px 12px",
                        background: theme.colors.background.elevated,
                        border: `1px solid ${theme.colors.border.medium}`,
                        borderRadius: 12,
                    }}
                >
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                handleSubmit();
                            }
                        }}
                        placeholder="Ask about your notes…"
                        style={{
                            flex: 1,
                            minWidth: 0,
                            border: "none",
                            background: "transparent",
                            outline: "none",
                            fontFamily: "inherit",
                            fontSize: 12.5,
                            color: theme.colors.text.primary,
                            padding: "5px 0",
                        }}
                    />
                    <IconButton
                        label="Send"
                        size={28}
                        disabled={sendDisabled}
                        onClick={() => handleSubmit()}
                        style={{
                            borderRadius: 8,
                            background: sendDisabled ? "transparent" : "var(--color-accent-default)",
                            color: sendDisabled ? theme.colors.text.muted : "#fff",
                            cursor: sendDisabled ? "default" : "pointer",
                        }}
                    >
                        <ArrowUp size={14} />
                    </IconButton>
                </div>
                <div
                    className="flex items-center"
                    style={{ gap: 5, padding: "7px 2px 0", fontSize: 10.5, color: theme.colors.text.muted }}
                >
                    <Lock size={10} style={{ flexShrink: 0 }} />
                    {isOnDevice
                        ? "Answers stay on this device and cite your notes — verify anything important."
                        : "Answers cite your notes — verify anything important."}
                </div>
            </div>
        </div>
    );
}
