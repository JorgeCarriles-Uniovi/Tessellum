import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { Plus, Play, Trash2, FileCode, ChevronDown, ChevronRight } from "lucide-react";
import { SettingSection } from "./items/SettingSection";
import { useVaultStore } from "../../stores/vaultStore";
import { runScript, type ScriptRunResult } from "../../utils/scriptRunner";
import { Button, IconButton } from "../ui";

interface ScriptMeta {
    id: string;
    name: string;
    path: string;
    size: number;
    modified: number;
}

const SCRIPT_TEMPLATE = `// Tessellum Script
// API: read_note(path), write_note(path, content), query_index(query, topK?),
//      send_notification(msg), open_file(path), log(...args)

const results = await query_index("your query here", 5);
for (const note of results) {
    log(note.title, note.score.toFixed(2));
}
`;

export function ScriptsSettings() {
    const vaultPath = useVaultStore((s) => s.vaultPath);
    const setActiveNote = useVaultStore((s) => s.setActiveNote);
    const files = useVaultStore((s) => s.files);

    const [scripts, setScripts] = useState<ScriptMeta[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState("");
    const [runResult, setRunResult] = useState<Record<string, ScriptRunResult>>({});
    const [running, setRunning] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!vaultPath) return;
        setLoading(true);
        try {
            const list = await invoke<ScriptMeta[]>("list_scripts", { vaultPath });
            setScripts(list);
        } catch {
            toast.error("Failed to load scripts");
        } finally {
            setLoading(false);
        }
    }, [vaultPath]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const handleNew = async () => {
        if (!vaultPath) return;
        const id = `script-${Date.now()}.js`;
        try {
            await invoke("write_script", { vaultPath, scriptId: id, content: SCRIPT_TEMPLATE });
            await refresh();
            setEditingId(id);
            setEditContent(SCRIPT_TEMPLATE);
        } catch (e) {
            toast.error(`Failed to create script: ${String(e)}`);
        }
    };

    const handleEdit = async (id: string) => {
        if (!vaultPath) return;
        if (editingId === id) {
            setEditingId(null);
            return;
        }
        try {
            const code = await invoke<string>("read_script", { vaultPath, scriptId: id });
            setEditContent(code);
            setEditingId(id);
        } catch (e) {
            toast.error(`Failed to read script: ${String(e)}`);
        }
    };

    const handleSave = async (id: string) => {
        if (!vaultPath) return;
        try {
            await invoke("write_script", { vaultPath, scriptId: id, content: editContent });
            toast.success("Script saved");
        } catch (e) {
            toast.error(`Failed to save script: ${String(e)}`);
        }
    };

    const handleDelete = async (id: string) => {
        if (!vaultPath) return;
        try {
            await invoke("delete_script", { vaultPath, scriptId: id });
            if (editingId === id) setEditingId(null);
            await refresh();
            toast.success("Script deleted");
        } catch (e) {
            toast.error(`Failed to delete script: ${String(e)}`);
        }
    };

    const handleRun = async (id: string) => {
        if (!vaultPath || running) return;
        let code = editContent;
        if (editingId !== id) {
            try {
                code = await invoke<string>("read_script", { vaultPath, scriptId: id });
            } catch (e) {
                toast.error(`Failed to read script: ${String(e)}`);
                return;
            }
        }
        setRunning(id);
        const result = await runScript(code, vaultPath, {
            onOpenFile: (path) => {
                const file = files.find((f) => f.path === path);
                if (file) setActiveNote(file);
            },
            onNotification: (msg) => toast.info(msg),
        });
        setRunResult((prev) => ({ ...prev, [id]: result }));
        setRunning(null);
        if (result.error) {
            toast.error(`Script error: ${result.error}`);
        } else {
            toast.success(`Script completed in ${result.duration}ms`);
        }
    };

    return (
        <div className="space-y-6">
            <SettingSection
                title="Scripts"
                description="JavaScript scripts stored in .tessellum/scripts/. Use the Tessellum API to read notes, query the index, and more."
            >
                <div className="flex justify-between items-center mb-3">
                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                        {scripts.length} script{scripts.length !== 1 ? "s" : ""}
                    </span>
                    <Button variant="tint" size="sm" disabled={!vaultPath} onClick={handleNew}>
                        <Plus size={12} />
                        New Script
                    </Button>
                </div>

                {loading && (
                    <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                        Loading…
                    </div>
                )}

                {!loading && scripts.length === 0 && (
                    <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                        No scripts yet. Create one to get started.
                    </div>
                )}

                <div className="space-y-3">
                    {scripts.map((script) => (
                        <div
                            key={script.id}
                            className="rounded-xl overflow-hidden"
                            style={{
                                border: `1px solid ${editingId === script.id ? "var(--primary)" : "var(--color-border-light)"}`,
                            }}
                        >
                            {/* Script header */}
                            <div
                                className="flex items-center gap-2 px-3 py-2"
                                style={{ background: "var(--color-background-secondary)" }}
                            >
                                <FileCode size={13} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
                                <span
                                    className="flex-1 text-sm font-medium truncate"
                                    style={{ color: "var(--color-text-primary)" }}
                                >
                                    {script.name}
                                </span>
                                <span className="text-[0.625rem]" style={{ color: "var(--color-text-muted)" }}>
                                    {script.id}
                                </span>

                                <IconButton
                                    label="Run script"
                                    size={24}
                                    disabled={!!running}
                                    style={running === script.id ? { color: "var(--primary)" } : undefined}
                                    onClick={() => handleRun(script.id)}
                                >
                                    <Play size={12} />
                                </IconButton>
                                <IconButton label="Edit script" size={24} onClick={() => handleEdit(script.id)}>
                                    {editingId === script.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                </IconButton>
                                <IconButton label="Delete script" size={24} danger onClick={() => handleDelete(script.id)}>
                                    <Trash2 size={12} />
                                </IconButton>
                            </div>

                            {/* Editor */}
                            {editingId === script.id && (
                                <div>
                                    <textarea
                                        value={editContent}
                                        onChange={(e) => setEditContent(e.target.value)}
                                        spellCheck={false}
                                        rows={12}
                                        className="w-full font-mono text-xs p-3 resize-y"
                                        style={{
                                            background: "var(--color-background-primary)",
                                            border: "none",
                                            borderTop: "1px solid var(--color-border-light)",
                                            color: "var(--color-text-primary)",
                                            outline: "none",
                                            display: "block",
                                        }}
                                    />
                                    <div
                                        className="flex items-center justify-end gap-2 px-3 py-2"
                                        style={{
                                            borderTop: "1px solid var(--color-border-light)",
                                            background: "var(--color-background-secondary)",
                                        }}
                                    >
                                        <Button variant="primary" size="sm" onClick={() => handleSave(script.id)}>
                                            Save
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Run result */}
                            {runResult[script.id] && (
                                <div
                                    className="px-3 py-2 font-mono text-xs"
                                    style={{
                                        background: "var(--color-background-primary)",
                                        borderTop: "1px solid var(--color-border-light)",
                                        color: runResult[script.id].error
                                            ? "#ef4444"
                                            : "var(--color-text-secondary)",
                                        whiteSpace: "pre-wrap",
                                        maxHeight: "8rem",
                                        overflowY: "auto",
                                    }}
                                >
                                    {runResult[script.id].error
                                        ? `Error: ${runResult[script.id].error}`
                                        : runResult[script.id].output.join("\n") || "(no output)"}
                                    <div
                                        className="text-[0.5625rem] mt-1"
                                        style={{ color: "var(--color-text-muted)" }}
                                    >
                                        {runResult[script.id].duration}ms
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </SettingSection>

            <SettingSection
                title="API Reference"
                description="Functions available inside scripts."
            >
                <ul className="space-y-1.5 text-xs font-mono" style={{ color: "var(--color-text-secondary)" }}>
                    {[
                        ["read_note(path)", "Read note content → string"],
                        ["write_note(path, content)", "Write content to a note"],
                        ["query_index(query, topK?)", "Semantic search → [{path, title, score}]"],
                        ["send_notification(msg)", "Show a toast notification"],
                        ["open_file(path)", "Open a note in the editor"],
                        ["log(...args)", "Print to the output pane below"],
                    ].map(([sig, desc]) => (
                        <li key={sig} className="flex gap-3">
                            <code
                                className="flex-shrink-0 px-1 rounded"
                                style={{ background: "var(--color-background-secondary)" }}
                            >
                                {sig}
                            </code>
                            <span style={{ color: "var(--color-text-muted)" }}>{desc}</span>
                        </li>
                    ))}
                </ul>
            </SettingSection>
        </div>
    );
}
