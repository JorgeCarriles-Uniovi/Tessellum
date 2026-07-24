// src/components/GraphView/GraphQueryPanel.tsx
import { ChangeEvent, useState } from "react";
import { Search, X } from "lucide-react";
import { CYPHER_QUERY_SAMPLES } from "../../lib/cypherQuerySamples";
import { Button } from "../ui";
import { useAppTranslation } from "../../i18n/react.tsx";

interface GraphQueryPanelProps {
    query: string;
    onChange: (value: string) => void;
    error: string | null;
    isRunning: boolean;
}

export function GraphQueryPanel({
                                    query,
                                    onChange,
                                    error,
                                    isRunning,
                                }: GraphQueryPanelProps): JSX.Element {
    const { t } = useAppTranslation("core");
    const [isOpen, setIsOpen] = useState(false);
    const [isSamplesOpen, setIsSamplesOpen] = useState(false);

    const handleChange = (event: ChangeEvent<HTMLTextAreaElement>): void => {
        onChange(event.target.value);
    };

    if (!isOpen) {
        return (
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                style={{
                    position: "absolute", top: 16, right: 16, zIndex: 20,
                    width: 300,
                    display: "flex", alignItems: "center", gap: 9,
                    background: "var(--color-bg-secondary)",
                    border: "1px solid var(--color-border-light)",
                    borderRadius: 10,
                    boxShadow: "var(--shadow)",
                    padding: "8px 12px",
                    cursor: "text",
                    textAlign: "left",
                }}
            >
                <Search size={14} color="var(--color-text-tertiary)" />
                <span
                    style={{
                        flex: 1, fontSize: 12,
                        color: query ? "var(--color-text-secondary)" : "var(--color-text-tertiary)",
                        fontFamily: query
                            ? 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)'
                            : "var(--font-sans)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}
                >
                    {query || t("graph.filterPlaceholder", { defaultValue: "Filter — tag:systems or Cypher…" })}
                </span>
            </button>
        );
    }

    return (
        <div
            style={{
                position: "absolute", top: 16, right: 16, zIndex: 20,
                width: 320,
                backgroundColor: "var(--color-bg-secondary)",
                border: "1px solid var(--color-border-light)",
                borderRadius: "var(--radius-lg)",
                boxShadow: "var(--shadow-lg)",
                padding: "10px 12px",
            }}
        >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div
                    style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "var(--color-text-muted)",
                        letterSpacing: "0.02em",
                        textTransform: "uppercase",
                    }}
                >
                    Cypher Query
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                            onChange("");
                            setIsSamplesOpen(false);
                        }}
                    >
                        Clear
                    </Button>
                    <div style={{ position: "relative" }}>
                        <Button variant="secondary" size="sm" onClick={() => setIsSamplesOpen((open) => !open)}>
                            Examples
                        </Button>
                        {isSamplesOpen && (
                            <div
                                style={{
                                    position: "absolute",
                                    top: "calc(100% + 4px)",
                                    right: 0,
                                    width: 240,
                                    maxHeight: 220,
                                    overflowY: "auto",
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
                                            display: "block",
                                            width: "100%",
                                            textAlign: "left",
                                            border: "none",
                                            background: "transparent",
                                            padding: "8px 10px",
                                            color: "var(--color-text-primary)",
                                            cursor: "pointer",
                                            fontSize: "12px",
                                        }}
                                        title={sample.description}
                                    >
                                        {sample.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        aria-label="Collapse query panel"
                        style={{
                            width: 24, height: 24,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            border: "none", background: "transparent",
                            color: "var(--color-text-tertiary)", cursor: "pointer",
                        }}
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>
            <textarea
                value={query}
                onChange={handleChange}
                placeholder='MATCH (n) WHERE "rust" IN n.tags RETURN n'
                rows={5}
                style={{
                    width: "100%",
                    resize: "none",
                    border: "1px solid var(--color-border-light)",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: "var(--color-bg-app)",
                    padding: "8px",
                    fontFamily:
                        'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)',
                    fontSize: "12px",
                    color: "var(--color-text-primary)",
                    outline: "none",
                }}
            />
            {isRunning && (
                <div style={{ marginTop: 6, fontSize: "11px", color: "var(--color-text-muted)", lineHeight: 1.3 }}>
                    Running query...
                </div>
            )}
            {error && (
                <div style={{ marginTop: 6, fontSize: "11px", color: "var(--color-red-500)", lineHeight: 1.3 }}>
                    {error}
                </div>
            )}
        </div>
    );
}
