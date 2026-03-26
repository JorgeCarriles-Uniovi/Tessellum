import { ChangeEvent, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CYPHER_QUERY_SAMPLES } from "../../lib/cypherQuerySamples";

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
    const [isOpen, setIsOpen] = useState(false);
    const [isSamplesOpen, setIsSamplesOpen] = useState(false);

    const handleChange = (event: ChangeEvent<HTMLTextAreaElement>): void => {
        onChange(event.target.value);
    };

    return (
        <div
            style={{
                position: "absolute",
                top: "50%",
                right: 0,
                transform: "translateY(-50%)",
                zIndex: 20,
                display: "flex",
                alignItems: "center",
                pointerEvents: "none",
            }}
        >
            <div
                style={{
                    width: 320,
                    marginRight: 8,
                    backgroundColor: "var(--color-bg-primary)",
                    border: "1px solid var(--color-border-light)",
                    borderRadius: "var(--radius-md)",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                    padding: "10px 12px",
                    pointerEvents: isOpen ? "auto" : "none",
                    opacity: isOpen ? 1 : 0,
                    transform: isOpen ? "translateX(0)" : "translateX(24px)",
                    transition: "transform 220ms ease, opacity 220ms ease",
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
                        <button
                            type="button"
                            onClick={() => {
                                onChange("");
                                setIsSamplesOpen(false);
                            }}
                            style={{
                                fontSize: "11px",
                                border: "1px solid var(--color-border-light)",
                                borderRadius: "var(--radius-sm)",
                                backgroundColor: "var(--color-bg-secondary)",
                                color: "var(--color-text-primary)",
                                padding: "4px 8px",
                                cursor: "pointer",
                            }}
                        >
                            Clear
                        </button>
                        <div style={{ position: "relative" }}>
                            <button
                                type="button"
                                onClick={() => setIsSamplesOpen((open) => !open)}
                                style={{
                                    fontSize: "11px",
                                    border: "1px solid var(--color-border-light)",
                                    borderRadius: "var(--radius-sm)",
                                    backgroundColor: "var(--color-bg-secondary)",
                                    color: "var(--color-text-primary)",
                                    padding: "4px 8px",
                                    cursor: "pointer",
                                }}
                            >
                                Examples
                            </button>
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
                                        borderRadius: "var(--radius-sm)",
                                        backgroundColor: "var(--color-bg-primary)",
                                        boxShadow: "0 8px 18px rgba(0, 0, 0, 0.14)",
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
                    </div>
                </div>
                <textarea
                    value={query}
                    onChange={handleChange}
                    placeholder='MATCH (n) WHERE "rust" IN n.tags RETURN n.id AS id, n.title AS title'
                    rows={5}
                    style={{
                        width: "100%",
                        resize: "none",
                        border: "1px solid var(--color-border-light)",
                        borderRadius: "var(--radius-sm)",
                        backgroundColor: "var(--color-bg-secondary)",
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
            <button
                type="button"
                onClick={() => {
                    setIsOpen((open) => !open);
                    setIsSamplesOpen(false);
                }}
                style={{
                    pointerEvents: "auto",
                    width: 26,
                    height: 58,
                    border: "1px solid var(--color-border-light)",
                    borderRight: "none",
                    borderTopLeftRadius: "var(--radius-sm)",
                    borderBottomLeftRadius: "var(--radius-sm)",
                    backgroundColor: "var(--color-bg-primary)",
                    color: "var(--color-text-muted)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 4px 10px rgba(0, 0, 0, 0.08)",
                }}
                aria-label={isOpen ? "Hide query panel" : "Show query panel"}
            >
                {isOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
        </div>
    );
}
