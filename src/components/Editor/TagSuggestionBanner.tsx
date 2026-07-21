import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Tag, X } from "lucide-react";
import { IconButton } from "../ui";

interface TagSuggestionBannerProps {
    notePath: string | undefined;
    content: string;
    existingTags: string[];
    onAddTag: (tag: string) => void;
}

const DEBOUNCE_MS = 3000;

export function TagSuggestionBanner({
    notePath,
    content,
    existingTags,
    onAddTag,
}: TagSuggestionBannerProps) {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());
    const [visible, setVisible] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastPathRef = useRef<string | undefined>(undefined);
    const existingTagsRef = useRef<string[]>(existingTags);
    const dismissedRef = useRef<Set<string>>(dismissed);

    // Keep refs in sync so debounce callback always reads fresh values
    existingTagsRef.current = existingTags;
    dismissedRef.current = dismissed;

    // Reset dismissed set when note changes
    useEffect(() => {
        if (notePath !== lastPathRef.current) {
            lastPathRef.current = notePath;
            setDismissed(new Set());
            setSuggestions([]);
            setVisible(false);
        }
    }, [notePath]);

    // Debounce suggest_tags call on content change
    useEffect(() => {
        if (!notePath || !content.trim()) return;

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(async () => {
            try {
                const tags = await invoke<string[]>("suggest_tags", {
                    content,
                    existingTags: existingTagsRef.current,
                });
                const fresh = tags.filter((t) => !dismissedRef.current.has(t) && !existingTagsRef.current.includes(t));
                setSuggestions(fresh);
                setVisible(fresh.length > 0);
            } catch {
                // fail silently — suggestions are non-critical
            }
        }, DEBOUNCE_MS);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
        // Only re-run on content or note path changes; dismissed set excluded intentionally
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [content, notePath]);

    const handleAdd = (tag: string) => {
        onAddTag(tag);
        setSuggestions((prev) => prev.filter((t) => t !== tag));
        setDismissed((prev) => new Set([...prev, tag]));
        if (suggestions.length <= 1) setVisible(false);
    };

    const handleDismissAll = () => {
        setDismissed((prev) => new Set([...prev, ...suggestions]));
        setSuggestions([]);
        setVisible(false);
    };

    if (!visible || suggestions.length === 0) return null;

    return (
        <div
            className="flex items-center gap-2 flex-wrap px-4 py-2"
            style={{
                background: "color-mix(in srgb, var(--primary) 6%, var(--color-background-primary))",
                borderTop: `1px solid color-mix(in srgb, var(--primary) 20%, transparent)`,
                minHeight: "2.25rem",
            }}
        >
            <Tag
                size={12}
                style={{ color: "var(--primary)", flexShrink: 0 }}
            />
            <span
                className="text-[0.6875rem] font-medium flex-shrink-0"
                style={{ color: "var(--primary)" }}
            >
                Suggested:
            </span>

            {suggestions.map((tag) => (
                <button
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6875rem] transition-colors"
                    style={{
                        background: "color-mix(in srgb, var(--primary) 12%, transparent)",
                        color: "var(--primary)",
                        border: "1px solid color-mix(in srgb, var(--primary) 25%, transparent)",
                        cursor: "pointer",
                    }}
                    onClick={() => handleAdd(tag)}
                    title={`Add #${tag} to this note`}
                >
                    #{tag}
                </button>
            ))}

            <span style={{ flex: 1 }} />

            <IconButton label="Dismiss suggestions" size={20} onClick={handleDismissAll}>
                <X size={12} />
            </IconButton>
        </div>
    );
}
