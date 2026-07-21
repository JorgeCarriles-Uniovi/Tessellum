import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Sparkles } from "lucide-react";
import { theme } from "../../styles/theme";
import { useVaultStore } from "../../stores/vaultStore";

interface SemanticHit {
    path: string;
    title: string;
    score: number;
}

const SIDEBAR_ICON_SIZE = 14;
const SIDEBAR_ICON_STYLE = { width: "0.875rem", height: "0.875rem" };

function SimilarityDots({ score }: { score: number }) {
    const filled = Math.round(score * 5);
    return (
        <span style={{ display: "inline-flex", gap: "2px", marginLeft: "0.25rem" }}>
            {[1, 2, 3, 4, 5].map((i) => (
                <span
                    key={i}
                    style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        backgroundColor: i <= filled
                            ? "var(--primary)"
                            : "var(--color-border-light)",
                        display: "inline-block",
                    }}
                />
            ))}
        </span>
    );
}

interface BacklinkSuggestionsProps {
    activeNotePath?: string;
    onOpen: (path: string) => void;
}

export function BacklinkSuggestions({ activeNotePath, onOpen }: BacklinkSuggestionsProps) {
    const vaultPath = useVaultStore((s) => s.vaultPath);
    const [suggestions, setSuggestions] = useState<SemanticHit[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!activeNotePath || !vaultPath) {
            setSuggestions([]);
            return;
        }

        let cancelled = false;
        setLoading(true);

        invoke<SemanticHit[]>("get_link_suggestions", {
            vaultPath,
            notePath: activeNotePath,
            topK: 5,
        })
            .then((hits) => {
                if (!cancelled) setSuggestions(hits);
            })
            .catch(() => {
                if (!cancelled) setSuggestions([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [activeNotePath, vaultPath]);

    if (!activeNotePath || suggestions.length === 0 && !loading) return null;

    return (
        <section className="space-y-4">
            <div className="flex items-center justify-between">
                <h3
                    className="text-[0.75rem] font-semibold uppercase tracking-[0.24em]"
                    style={{ color: theme.colors.text.muted, padding: "1rem" }}
                >
                    You might link to
                </h3>
                <Sparkles
                    size={SIDEBAR_ICON_SIZE}
                    style={{ ...SIDEBAR_ICON_STYLE, color: theme.colors.text.muted, marginRight: "1rem" }}
                />
            </div>

            {loading ? (
                <div
                    className="text-[0.6875rem]"
                    style={{ color: theme.colors.text.muted, paddingLeft: "1rem" }}
                >
                    Finding similar notes…
                </div>
            ) : (
                <div className="space-y-2" style={{ padding: "0.5rem 1rem" }}>
                    {suggestions.map((hit) => (
                        <button
                            key={hit.path}
                            className="w-full text-left flex items-center gap-2 rounded-xl px-3 py-2 transition-colors hover:bg-[color:var(--color-background-secondary)]"
                            onClick={() => onOpen(hit.path)}
                            style={{ border: "none", background: "transparent" }}
                        >
                            <span
                                className="flex-1 truncate text-[0.8125rem]"
                                style={{ color: theme.colors.text.secondary }}
                            >
                                {hit.title || hit.path.split("/").pop()?.replace(/\.md$/, "")}
                            </span>
                            <SimilarityDots score={hit.score} />
                        </button>
                    ))}
                </div>
            )}
        </section>
    );
}
