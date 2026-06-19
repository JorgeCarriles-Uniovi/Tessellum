import { useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Sparkles, X, RotateCcw, Check } from "lucide-react";
import { theme } from "../../styles/theme";
import { useAIStore } from "../../stores/aiStore";
import type { EditorView } from "@codemirror/view";

interface AiTokenPayload {
    request_id: string;
    token: string;
    done: boolean;
    error?: string;
}

let requestCounter = 0;
function nextRequestId() {
    return `ai-${Date.now()}-${++requestCounter}`;
}

interface AIPanelProps {
    getView: () => EditorView | undefined | null;
}

export function AIPanel({ getView }: AIPanelProps) {
    const isOpen = useAIStore((s) => s.isOpen);
    const prompt = useAIStore((s) => s.prompt);
    const output = useAIStore((s) => s.output);
    const streaming = useAIStore((s) => s.streaming);
    const selectedContext = useAIStore((s) => s.selectedContext);
    const providerConfig = useAIStore((s) => s.providerConfig);
    const {
        closePanel,
        setPrompt,
        setOutput,
        appendToken,
        setStreaming,
        reset,
    } = useAIStore();

    const currentRequestId = useRef<string | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const unlistenRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        if (isOpen && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [isOpen]);

    const cleanupListener = useCallback(() => {
        if (unlistenRef.current) {
            unlistenRef.current();
            unlistenRef.current = null;
        }
    }, []);

    useEffect(() => {
        return () => {
            cleanupListener();
        };
    }, [cleanupListener]);

    // Global keyboard shortcuts when panel is open
    useEffect(() => {
        if (!isOpen) return;

        const handler = (e: KeyboardEvent) => {
            const inTextarea = e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement;

            if (e.key === "Escape" && !inTextarea) {
                e.preventDefault();
                handleClose();
            }
            if (e.key === "Tab" && !inTextarea && output && !streaming) {
                e.preventDefault();
                handleAccept();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !inTextarea && !streaming) {
                e.preventDefault();
                handleRegenerate();
            }
        };

        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [isOpen, output, streaming, handleClose, handleAccept, handleRegenerate]);

    const startGeneration = useCallback(async (promptText: string) => {
        cleanupListener();
        reset();
        setStreaming(true);

        const reqId = nextRequestId();
        currentRequestId.current = reqId;

        // Set up listener before invoking so no tokens are missed
        const unlisten = await listen<AiTokenPayload>("ai-token", (event) => {
            const payload = event.payload;
            if (payload.request_id !== currentRequestId.current) return;

            if (payload.error) {
                setOutput(`Error: ${payload.error}`);
                setStreaming(false);
                cleanupListener();
                return;
            }

            if (payload.token) {
                appendToken(payload.token);
            }

            if (payload.done) {
                setStreaming(false);
                cleanupListener();
            }
        });
        unlistenRef.current = unlisten;

        try {
            await invoke("ai_generate", {
                prompt: promptText,
                context: selectedContext,
                providerConfig,
                requestId: reqId,
            });
        } catch (err) {
            setOutput(`Error: ${String(err)}`);
            setStreaming(false);
            cleanupListener();
        }
    }, [selectedContext, providerConfig, appendToken, setStreaming, setOutput, reset, cleanupListener]);

    const handleSubmit = useCallback(() => {
        if (!prompt.trim() || streaming) return;
        startGeneration(prompt.trim());
    }, [prompt, streaming, startGeneration]);

    const handleAccept = useCallback(() => {
        if (!output) return;
        const view = getView();
        if (!view) return;

        const { state } = view;
        const selection = state.selection.main;

        if (selection.empty) {
            // Insert at cursor
            view.dispatch({
                changes: { from: selection.from, insert: output },
                selection: { anchor: selection.from + output.length },
            });
        } else {
            // Replace selection
            view.dispatch({
                changes: { from: selection.from, to: selection.to, insert: output },
                selection: { anchor: selection.from + output.length },
            });
        }

        view.focus();
        closePanel();
    }, [output, getView, closePanel]);

    const handleRegenerate = useCallback(() => {
        if (!prompt.trim() || streaming) return;
        startGeneration(prompt.trim());
    }, [prompt, streaming, startGeneration]);

    const handleClose = useCallback(() => {
        cleanupListener();
        currentRequestId.current = null;
        closePanel();
    }, [cleanupListener, closePanel]);

    if (!isOpen) return null;

    return (
        <div
            className="absolute inset-x-4 bottom-4 z-50 rounded-2xl shadow-xl overflow-hidden"
            style={{
                background: theme.colors.background.secondary,
                border: `1px solid ${theme.colors.border.light}`,
                maxHeight: "60%",
                display: "flex",
                flexDirection: "column",
            }}
        >
            {/* Header */}
            <div
                className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0"
                style={{
                    borderBottom: `1px solid ${theme.colors.border.light}`,
                    background: theme.colors.background.primary,
                }}
            >
                <Sparkles size={14} style={{ color: "var(--primary)" }} />
                <span className="text-xs font-semibold" style={{ color: theme.colors.text.primary }}>
                    AI Writing Assistant
                </span>
                <span className="flex-1" />
                <button
                    className="flex items-center justify-center w-6 h-6 rounded-md transition-colors"
                    style={{ background: "transparent", border: "none", color: theme.colors.text.muted }}
                    onClick={handleClose}
                    title="Close (Esc)"
                >
                    <X size={14} />
                </button>
            </div>

            {/* Context snippet */}
            {selectedContext && (
                <div
                    className="px-4 py-2 text-xs flex-shrink-0 truncate"
                    style={{
                        color: theme.colors.text.muted,
                        borderBottom: `1px solid ${theme.colors.border.light}`,
                        background: "color-mix(in srgb, var(--primary) 5%, transparent)",
                    }}
                >
                    <span className="font-medium" style={{ color: "var(--primary)" }}>Context: </span>
                    {selectedContext.slice(0, 120)}{selectedContext.length > 120 ? "…" : ""}
                </div>
            )}

            {/* Prompt input */}
            <div className="px-4 py-3 flex-shrink-0">
                <textarea
                    ref={textareaRef}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit();
                        }
                        if (e.key === "Escape") {
                            handleClose();
                        }
                    }}
                    placeholder="Ask AI to write, summarise, expand, rephrase… (Enter to send)"
                    rows={2}
                    className="w-full text-sm resize-none rounded-lg px-3 py-2"
                    style={{
                        background: theme.colors.background.primary,
                        border: `1px solid ${theme.colors.border.light}`,
                        color: theme.colors.text.primary,
                        outline: "none",
                        fontFamily: "inherit",
                    }}
                />
                <div className="flex items-center gap-2 mt-2">
                    <button
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                        style={{
                            background: "var(--primary)",
                            color: "#fff",
                            border: "none",
                            opacity: !prompt.trim() || streaming ? 0.6 : 1,
                            cursor: !prompt.trim() || streaming ? "default" : "pointer",
                        }}
                        disabled={!prompt.trim() || streaming}
                        onClick={handleSubmit}
                    >
                        <Sparkles size={12} />
                        {streaming ? "Generating…" : "Generate"}
                    </button>

                    {output && !streaming && (
                        <>
                            <button
                                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                                style={{
                                    background: "color-mix(in srgb, var(--primary) 15%, transparent)",
                                    color: "var(--primary)",
                                    border: "none",
                                    cursor: "pointer",
                                }}
                                onClick={handleAccept}
                                title="Accept (Tab)"
                            >
                                <Check size={12} />
                                Accept
                            </button>
                            <button
                                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-colors"
                                style={{
                                    background: "transparent",
                                    color: theme.colors.text.muted,
                                    border: `1px solid ${theme.colors.border.light}`,
                                    cursor: "pointer",
                                }}
                                onClick={handleRegenerate}
                                title="Regenerate (Ctrl+Enter)"
                            >
                                <RotateCcw size={12} />
                                Retry
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Output area */}
            {(output || streaming) && (
                <div
                    className="flex-1 overflow-y-auto px-4 pb-4 text-sm"
                    style={{
                        color: theme.colors.text.primary,
                        borderTop: `1px solid ${theme.colors.border.light}`,
                        fontFamily: theme.typography.fontFamily.sans,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        paddingTop: "0.75rem",
                        minHeight: "4rem",
                    }}
                >
                    {output}
                    {streaming && (
                        <span
                            className="inline-block ml-0.5 w-2 h-4 rounded-sm animate-pulse"
                            style={{ background: "var(--primary)", verticalAlign: "text-bottom" }}
                        />
                    )}
                </div>
            )}
        </div>
    );
}
