import {
    Decoration,
    DecorationSet,
    EditorView,
    ViewPlugin,
    WidgetType,
    ViewUpdate,
} from "@codemirror/view";
import { Extension, RangeSetBuilder } from "@codemirror/state";
import { createRoot, Root } from "react-dom/client";
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { parseCodeBlocks } from "./code-parser";
import { useVaultStore } from "../../../../stores/vaultStore";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DataviewRow {
    path: string;
    title: string;
    [key: string]: unknown;
}

interface DataviewResult {
    view: string;
    columns: string[];
    rows: DataviewRow[];
    calendar_field: string | null;
    error: string | null;
}

// ─── React Result Component ──────────────────────────────────────────────────

function DataviewResultUI({ query }: { query: string }) {
    const vaultPath = useVaultStore((s) => s.vaultPath);
    const [result, setResult] = useState<DataviewResult | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            if (!vaultPath) return;
            setLoading(true);
            try {
                const r = await invoke<DataviewResult>("execute_dataview_query", {
                    query,
                    vaultPath,
                });
                if (!cancelled) setResult(r);
            } catch (e) {
                if (!cancelled) setResult({ view: "LIST", columns: [], rows: [], calendar_field: null, error: String(e) });
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        run();
        return () => { cancelled = true; };
    }, [query, vaultPath]);

    const containerStyle: React.CSSProperties = {
        backgroundColor: "var(--color-background-secondary)",
        border: "1px solid var(--color-border-light)",
        borderRadius: "0.5rem",
        padding: "0.75rem 1rem",
        margin: "0.5rem 0",
        fontSize: "0.8125rem",
        fontFamily: "var(--font-sans)",
        color: "var(--color-text-primary)",
    };

    if (loading) {
        return (
            <div style={containerStyle}>
                <span style={{ color: "var(--color-text-muted)" }}>Running query…</span>
            </div>
        );
    }

    if (!result) return null;

    if (result.error) {
        return (
            <div style={{ ...containerStyle, borderColor: "var(--color-alert-border)", backgroundColor: "var(--color-alert-bg)", color: "var(--color-alert-text)" }}>
                <strong>Dataview error:</strong> {result.error}
            </div>
        );
    }

    if (result.rows.length === 0) {
        return (
            <div style={containerStyle}>
                <span style={{ color: "var(--color-text-muted)" }}>No results.</span>
            </div>
        );
    }

    if (result.view === "TABLE") {
        const cols = result.columns.length > 0 ? result.columns : ["title"];
        return (
            <div style={{ ...containerStyle, padding: 0, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                    <thead>
                        <tr style={{ backgroundColor: "var(--color-background-primary)" }}>
                            {cols.map((col) => (
                                <th
                                    key={col}
                                    style={{
                                        padding: "0.5rem 0.75rem",
                                        textAlign: "left",
                                        fontWeight: 600,
                                        borderBottom: "1px solid var(--color-border-light)",
                                        color: "var(--color-text-secondary)",
                                        textTransform: "capitalize",
                                    }}
                                >
                                    {col}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {result.rows.map((row) => (
                            <tr
                                key={row.path}
                                style={{ borderBottom: "1px solid var(--color-border-light)" }}
                            >
                                {cols.map((col) => (
                                    <td key={col} style={{ padding: "0.4rem 0.75rem", color: "var(--color-text-primary)" }}>
                                        {col === "title" ? row.title : renderCellValue(row[col])}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div style={{ padding: "0.4rem 0.75rem", color: "var(--color-text-muted)", fontSize: "0.75rem", borderTop: "1px solid var(--color-border-light)" }}>
                    {result.rows.length} {result.rows.length === 1 ? "result" : "results"}
                </div>
            </div>
        );
    }

    // LIST view (default)
    return (
        <div style={containerStyle}>
            <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                {result.rows.map((row) => (
                    <li key={row.path} style={{ marginBottom: "0.25rem" }}>
                        {row.title}
                        {result.columns.length > 0 && result.columns[0] !== "title" && (
                            <span style={{ color: "var(--color-text-muted)", marginLeft: "0.5rem" }}>
                                — {renderCellValue(row[result.columns[0]])}
                            </span>
                        )}
                    </li>
                ))}
            </ul>
            <div style={{ color: "var(--color-text-muted)", fontSize: "0.75rem", marginTop: "0.5rem" }}>
                {result.rows.length} {result.rows.length === 1 ? "result" : "results"}
            </div>
        </div>
    );
}

function renderCellValue(v: unknown): string {
    if (v === null || v === undefined) return "";
    if (Array.isArray(v)) return v.join(", ");
    return String(v);
}

// ─── CodeMirror Widget ────────────────────────────────────────────────────────

class DataviewWidget extends WidgetType {
    private root: Root | null = null;
    private dom: HTMLElement | null = null;
    private destroyed = false;

    constructor(readonly query: string, readonly from: number, readonly to: number) {
        super();
    }

    eq(other: DataviewWidget) {
        return this.query === other.query && this.from === other.from;
    }

    toDOM(_view: EditorView): HTMLElement {
        this.dom = document.createElement("div");
        this.root = createRoot(this.dom);
        this.root.render(<DataviewResultUI query={this.query} />);
        return this.dom;
    }

    destroy(_dom: HTMLElement) {
        this.destroyed = true;
        const root = this.root;
        if (root) {
            this.root = null;
            setTimeout(() => { if (this.destroyed) root.unmount(); }, 0);
        }
    }

    ignoreEvent() {
        return false;
    }
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

function buildDecorations(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const blocks = parseCodeBlocks(view.state);

    for (const block of blocks) {
        if (block.language !== "dataview") continue;

        // Extract query content (between the fence lines)
        const full = view.state.doc.sliceString(block.from, block.to);
        const lines = full.split("\n");
        const queryLines = lines.slice(1, lines.length - 1);
        const query = queryLines.join("\n").trim();

        builder.add(
            block.from,
            block.to,
            Decoration.replace({
                widget: new DataviewWidget(query, block.from, block.to),
                block: true,
            })
        );
    }

    return builder.finish();
}

export function dataviewPlugin(): Extension {
    return ViewPlugin.fromClass(
        class {
            decorations: DecorationSet;

            constructor(view: EditorView) {
                this.decorations = buildDecorations(view);
            }

            update(update: ViewUpdate) {
                if (update.docChanged || update.viewportChanged) {
                    this.decorations = buildDecorations(update.view);
                }
            }
        },
        { decorations: (v) => v.decorations }
    );
}
