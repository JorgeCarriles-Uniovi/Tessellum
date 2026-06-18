import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useVaultStore } from "../../stores/vaultStore";
import { X, Pin, RotateCcw } from "lucide-react";

interface SnapshotInfo {
    timestamp: string;
    timestamp_ms: number;
    label: string | null;
}

interface NoteHistoryPanelProps {
    notePath: string;
    onClose: () => void;
    onRestore: (content: string) => void;
}

function formatTimestamp(ms: number): string {
    const d = new Date(ms);
    return d.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function NoteHistoryPanel({ notePath, onClose, onRestore }: NoteHistoryPanelProps) {
    const vaultPath = useVaultStore((s) => s.vaultPath);
    const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
    const [selected, setSelected] = useState<SnapshotInfo | null>(null);
    const [previewContent, setPreviewContent] = useState<string | null>(null);
    const [pinLabel, setPinLabel] = useState("");
    const [showPinInput, setShowPinInput] = useState(false);

    const loadSnapshots = useCallback(async () => {
        if (!vaultPath) return;
        try {
            const items = await invoke<SnapshotInfo[]>("list_note_snapshots", { vaultPath, notePath });
            setSnapshots(items);
        } catch (e) {
            console.error("Failed to load snapshots:", e);
        }
    }, [vaultPath, notePath]);

    useEffect(() => {
        loadSnapshots();
    }, [loadSnapshots]);

    const selectSnapshot = async (snap: SnapshotInfo) => {
        setSelected(snap);
        setShowPinInput(false);
        if (!vaultPath) return;
        try {
            const content = await invoke<string>("get_note_snapshot", {
                vaultPath,
                notePath,
                timestamp: snap.timestamp,
            });
            setPreviewContent(content);
        } catch (e) {
            console.error("Failed to load snapshot content:", e);
        }
    };

    const handleRestore = () => {
        if (!previewContent) return;
        onRestore(previewContent);
        onClose();
    };

    const handlePin = async () => {
        if (!selected || !vaultPath || !pinLabel.trim()) return;
        try {
            await invoke("pin_snapshot", {
                vaultPath,
                notePath,
                timestamp: selected.timestamp,
                label: pinLabel.trim(),
            });
            setPinLabel("");
            setShowPinInput(false);
            await loadSnapshots();
            // Refresh selected item's label
            setSelected((prev) => prev ? { ...prev, label: pinLabel.trim() } : prev);
        } catch (e) {
            console.error("Failed to pin snapshot:", e);
        }
    };

    const handleUnpin = async (snap: SnapshotInfo) => {
        if (!vaultPath) return;
        try {
            await invoke("unpin_snapshot", { vaultPath, notePath, timestamp: snap.timestamp });
            await loadSnapshots();
        } catch (e) {
            console.error("Failed to unpin snapshot:", e);
        }
    };

    return (
        <div
            className="flex flex-col h-full border-l text-sm"
            style={{
                backgroundColor: "var(--color-background-secondary)",
                borderColor: "var(--color-border-light)",
                width: "280px",
                minWidth: "200px",
            }}
        >
            {/* Header */}
            <div
                className="flex items-center justify-between px-3 py-2 border-b font-medium text-xs uppercase tracking-wide"
                style={{ borderColor: "var(--color-border-light)", color: "var(--color-text-muted)" }}
            >
                <span>Version History</span>
                <button onClick={onClose} className="p-1 rounded hover:opacity-70">
                    <X size={14} />
                </button>
            </div>

            <div className="flex flex-1 min-h-0">
                {/* Snapshot list */}
                <div className="flex flex-col overflow-y-auto border-r" style={{ borderColor: "var(--color-border-light)", flex: "0 0 140px" }}>
                    {snapshots.length === 0 && (
                        <div className="px-3 py-4 text-xs" style={{ color: "var(--color-text-muted)" }}>
                            No snapshots yet. Snapshots are created on each save.
                        </div>
                    )}
                    {snapshots.map((snap) => (
                        <button
                            key={snap.timestamp}
                            onClick={() => selectSnapshot(snap)}
                            className="flex flex-col items-start px-3 py-2 text-left border-b hover:opacity-80 transition-opacity"
                            style={{
                                borderColor: "var(--color-border-light)",
                                backgroundColor: selected?.timestamp === snap.timestamp
                                    ? "var(--color-background-primary)"
                                    : "transparent",
                                color: "var(--color-text-primary)",
                            }}
                        >
                            {snap.label && (
                                <span className="flex items-center gap-1 text-[10px] font-medium mb-0.5" style={{ color: "var(--primary)" }}>
                                    <Pin size={10} />
                                    {snap.label}
                                </span>
                            )}
                            <span className="text-xs">{formatTimestamp(snap.timestamp_ms)}</span>
                        </button>
                    ))}
                </div>

                {/* Preview + actions */}
                <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                    {selected && previewContent !== null ? (
                        <>
                            <div
                                className="flex-1 overflow-y-auto px-2 py-2 text-xs font-mono whitespace-pre-wrap break-words"
                                style={{ color: "var(--color-text-primary)" }}
                            >
                                {previewContent.slice(0, 2000)}
                                {previewContent.length > 2000 && (
                                    <span style={{ color: "var(--color-text-muted)" }}>…</span>
                                )}
                            </div>
                            <div className="flex flex-col gap-1 px-2 py-2 border-t" style={{ borderColor: "var(--color-border-light)" }}>
                                <button
                                    onClick={handleRestore}
                                    className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
                                    style={{ backgroundColor: "var(--primary)", color: "white" }}
                                >
                                    <RotateCcw size={11} />
                                    Restore this version
                                </button>
                                {selected.label ? (
                                    <button
                                        onClick={() => handleUnpin(selected)}
                                        className="flex items-center gap-1 px-2 py-1 rounded text-xs"
                                        style={{ color: "var(--color-text-muted)", border: "1px solid var(--color-border-light)" }}
                                    >
                                        <Pin size={11} />
                                        Unpin
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => setShowPinInput((v) => !v)}
                                            className="flex items-center gap-1 px-2 py-1 rounded text-xs"
                                            style={{ color: "var(--color-text-muted)", border: "1px solid var(--color-border-light)" }}
                                        >
                                            <Pin size={11} />
                                            Pin with label
                                        </button>
                                        {showPinInput && (
                                            <div className="flex gap-1">
                                                <input
                                                    className="flex-1 min-w-0 px-1 py-0.5 text-xs rounded border"
                                                    style={{ borderColor: "var(--color-border-light)", backgroundColor: "var(--color-background-primary)", color: "var(--color-text-primary)" }}
                                                    placeholder="Label…"
                                                    value={pinLabel}
                                                    onChange={(e) => setPinLabel(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === "Enter") handlePin(); }}
                                                    autoFocus
                                                />
                                                <button
                                                    onClick={handlePin}
                                                    className="px-2 py-0.5 rounded text-xs font-medium"
                                                    style={{ backgroundColor: "var(--primary)", color: "white" }}
                                                >
                                                    Save
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full px-2 text-xs text-center" style={{ color: "var(--color-text-muted)" }}>
                            Select a snapshot to preview
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
