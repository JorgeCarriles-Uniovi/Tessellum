import { ChangeEvent } from "react";

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
    const handleChange = (event: ChangeEvent<HTMLTextAreaElement>): void => {
        onChange(event.target.value);
    };

    return (
        <div style={{ position: "absolute", top: 12, right: 12, zIndex: 20, pointerEvents: "none" }}>
            <div
                style={{
                    width: 360,
                    backgroundColor: "var(--color-bg-primary)",
                    border: "1px solid var(--color-border-light)",
                    borderRadius: "var(--radius-md)",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                    padding: "10px 12px",
                    pointerEvents: "auto",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
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
                </div>
                <textarea
                    value={query}
                    onChange={handleChange}
                    placeholder='MATCH (n:Note) WHERE "rust" IN n.tags RETURN n.id AS id, n.title AS title'
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
                <div style={{ marginTop: 6, fontSize: "11px", color: "var(--color-text-muted)", lineHeight: 1.3 }}>
                    Runs automatically while typing (250ms debounce). RETURN is optional; tag shorthand supported: n.tags = tag1, tag2.
                </div>
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
        </div>
    );
}
