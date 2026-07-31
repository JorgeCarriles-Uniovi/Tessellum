// src/components/GraphView/GraphQueryPanel.tsx
import { ChangeEvent, useState } from "react";
import { Search, Sparkles, X } from "lucide-react";
import { CYPHER_QUERY_SAMPLES } from "../../lib/cypherQuerySamples";
import { IconButton } from "../ui";
import { useAppTranslation } from "../../i18n/react.tsx";

interface GraphQueryPanelProps {
    query: string;
    onChange: (value: string) => void;
    error: string | null;
    isRunning: boolean;
    width?: number;
}

export function GraphQueryPanel({
                                    query,
                                    onChange,
                                    error,
                                    isRunning,
                                    width = 300,
                                }: GraphQueryPanelProps): JSX.Element {
    const { t } = useAppTranslation("core");
    const [isSamplesOpen, setIsSamplesOpen] = useState(false);

    const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
        onChange(event.target.value);
    };

    const placeholder = t("graph.filterPlaceholder", { defaultValue: "Filter — tag:systems or Cypher…" });

    return (
        <div style={{ position: "absolute", top: 16, right: 16, zIndex: 20, width }}>
            <div
                style={{
                    display: "flex", alignItems: "center", gap: 8,
                    background: "var(--color-bg-secondary)",
                    border: "1px solid var(--color-border-light)",
                    borderRadius: 10,
                    boxShadow: "var(--shadow)",
                    padding: "8px 10px",
                }}
            >
                <Search size={14} color="var(--color-text-tertiary)" style={{ flexShrink: 0 }} />
                <input
                    type="text"
                    value={query}
                    onChange={handleChange}
                    placeholder={placeholder}
                    aria-label={placeholder}
                    style={{
                        flex: 1, minWidth: 0,
                        border: "none", outline: "none", background: "transparent",
                        fontSize: 12,
                        color: query ? "var(--color-text-secondary)" : "var(--color-text-tertiary)",
                        fontFamily: query
                            ? 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)'
                            : "var(--font-sans)",
                    }}
                />
                {query.length > 0 && (
                    <IconButton
                        label={t("graph.clearFilter", { defaultValue: "Clear filter" })}
                        size={20}
                        onClick={() => onChange("")}
                    >
                        <X size={13} />
                    </IconButton>
                )}
                <div style={{ position: "relative", flexShrink: 0 }}>
                    <IconButton
                        label={t("graph.filterExamples", { defaultValue: "Filter examples" })}
                        size={20}
                        onClick={() => setIsSamplesOpen((open) => !open)}
                    >
                        <Sparkles size={13} />
                    </IconButton>
                    {isSamplesOpen && (
                        <div
                            style={{
                                position: "absolute", top: "calc(100% + 6px)", right: 0,
                                width: 240, maxHeight: 220, overflowY: "auto",
                                border: "1px solid var(--color-border-light)",
                                borderRadius: "var(--radius-md)",
                                backgroundColor: "var(--color-bg-elevated)",
                                boxShadow: "var(--shadow-lg)",
                                zIndex: 5,
                            }}
                        >
                            {CYPHER_QUERY_SAMPLES.map((sample) => (
                                <button
                                    key={sample.id}
                                    type="button"
                                    onClick={() => {
                                        onChange(sample.query);
                                        setIsSamplesOpen(false);
                                    }}
                                    style={{
                                        display: "block", width: "100%", textAlign: "left",
                                        border: "none", background: "transparent",
                                        padding: "8px 10px", color: "var(--color-text-primary)",
                                        cursor: "pointer", fontSize: "12px",
                                    }}
                                    title={sample.description}
                                >
                                    {sample.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            {(isRunning || error) && (
                <div
                    style={{
                        marginTop: 6, fontSize: 11, lineHeight: 1.3,
                        color: error ? "var(--color-red-500)" : "var(--color-text-muted)",
                        background: "var(--color-bg-secondary)",
                        border: "1px solid var(--color-border-light)",
                        borderRadius: 8, padding: "5px 9px",
                    }}
                >
                    {error ?? t("graph.runningQuery", { defaultValue: "Running query..." })}
                </div>
            )}
        </div>
    );
}
