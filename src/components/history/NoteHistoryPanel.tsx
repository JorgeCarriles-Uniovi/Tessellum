import { useState } from "react";
import { X, Pin, RotateCcw } from "lucide-react";
import { DiffView } from "./DiffView";
import { useNoteHistory, type SnapshotInfo } from "./useNoteHistory";
import { Button, IconButton, TextInput } from "../ui";

interface NoteHistoryPanelProps {
    notePath: string;
    onClose: () => void;
    onRestore: (content: string) => void;
    /** Returns the current (live) note content, used to diff against a snapshot. */
    getCurrentContent: () => string;
}

type PreviewMode = "diff" | "full";

function formatTimestamp(ms: number): string {
    return new Date(ms).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function SnapshotListItem({
    snap,
    isSelected,
    onSelect,
}: {
    snap: SnapshotInfo;
    isSelected: boolean;
    onSelect: (snap: SnapshotInfo) => void;
}) {
    return (
        <button
            onClick={() => onSelect(snap)}
            className="flex flex-col items-start px-3 py-2 text-left border-b hover:opacity-80 transition-opacity"
            style={{
                borderColor: "var(--color-border-light)",
                backgroundColor: isSelected ? "var(--color-panel-active)" : "transparent",
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
    );
}

function PinControls({ onPin }: { onPin: (label: string) => Promise<boolean> }) {
    const [pinLabel, setPinLabel] = useState("");
    const [showPinInput, setShowPinInput] = useState(false);

    const handlePin = async () => {
        if (await onPin(pinLabel)) {
            setPinLabel("");
            setShowPinInput(false);
        }
    };

    return (
        <>
            <Button variant="secondary" size="sm" onClick={() => setShowPinInput((v) => !v)}>
                <Pin size={11} />
                Pin with label
            </Button>
            {showPinInput && (
                <div className="flex gap-1">
                    <TextInput
                        className="flex-1 min-w-0 text-xs"
                        style={{ padding: "2px 6px", borderRadius: "var(--radius-md)" }}
                        placeholder="Label…"
                        value={pinLabel}
                        onChange={(e) => setPinLabel(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handlePin();
                        }}
                        autoFocus
                    />
                    <Button variant="primary" size="sm" onClick={handlePin}>
                        Save
                    </Button>
                </div>
            )}
        </>
    );
}

export function NoteHistoryPanel({ notePath, onClose, onRestore, getCurrentContent }: NoteHistoryPanelProps) {
    const [previewMode, setPreviewMode] = useState<PreviewMode>("diff");
    const { snapshots, selected, previewContent, currentContent, selectSnapshot, pinSnapshot, unpinSnapshot } =
        useNoteHistory(notePath, getCurrentContent);

    const handleRestore = () => {
        if (!previewContent) return;
        onRestore(previewContent);
        onClose();
    };

    return (
        <div
            className="flex flex-col h-full border-l text-sm"
            style={{
                backgroundColor: "var(--color-panel-bg)",
                borderColor: "var(--color-border-light)",
                width: "440px",
                minWidth: "360px",
            }}
        >
            {/* Header */}
            <div
                className="flex items-center justify-between px-3 py-2 border-b font-medium text-xs uppercase tracking-wide"
                style={{ borderColor: "var(--color-border-light)", color: "var(--color-text-muted)" }}
            >
                <span>Version History</span>
                <IconButton label="Close" size={24} onClick={onClose}>
                    <X size={14} />
                </IconButton>
            </div>

            <div className="flex flex-1 min-h-0">
                {/* Snapshot list */}
                <div
                    className="flex flex-col overflow-y-auto border-r"
                    style={{ borderColor: "var(--color-border-light)", flex: "0 0 140px" }}
                >
                    {snapshots.length === 0 && (
                        <div className="px-3 py-4 text-xs" style={{ color: "var(--color-text-muted)" }}>
                            No snapshots yet. Snapshots are created on each save.
                        </div>
                    )}
                    {snapshots.map((snap) => (
                        <SnapshotListItem
                            key={snap.timestamp}
                            snap={snap}
                            isSelected={selected?.timestamp === snap.timestamp}
                            onSelect={selectSnapshot}
                        />
                    ))}
                </div>

                {/* Preview + actions */}
                <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                    {selected && previewContent !== null ? (
                        <>
                            {/* View toggle */}
                            <div
                                className="flex items-center gap-1 px-2 py-1.5 border-b"
                                style={{ borderColor: "var(--color-border-light)" }}
                            >
                                {(["diff", "full"] as PreviewMode[]).map((mode) => {
                                    const active = previewMode === mode;
                                    return (
                                        <button
                                            key={mode}
                                            onClick={() => setPreviewMode(mode)}
                                            className="px-2 py-0.5 rounded text-xs font-medium capitalize transition-colors"
                                            style={{
                                                backgroundColor: active ? "var(--primary)" : "transparent",
                                                color: active ? "white" : "var(--color-text-muted)",
                                            }}
                                        >
                                            {mode}
                                        </button>
                                    );
                                })}
                            </div>
                            {previewMode === "diff" ? (
                                <DiffView oldText={previewContent} newText={currentContent} />
                            ) : (
                                <div
                                    className="flex-1 overflow-y-auto px-2 py-2 text-xs font-mono whitespace-pre-wrap break-words"
                                    style={{ color: "var(--color-text-primary)" }}
                                >
                                    {previewContent.slice(0, 2000)}
                                    {previewContent.length > 2000 && <span style={{ color: "var(--color-text-muted)" }}>…</span>}
                                </div>
                            )}
                            <div
                                className="flex flex-col gap-1 px-2 py-2 border-t"
                                style={{ borderColor: "var(--color-border-light)" }}
                            >
                                <Button variant="primary" size="sm" onClick={handleRestore}>
                                    <RotateCcw size={11} />
                                    Restore this version
                                </Button>
                                {selected.label ? (
                                    <Button variant="secondary" size="sm" onClick={() => unpinSnapshot(selected)}>
                                        <Pin size={11} />
                                        Unpin
                                    </Button>
                                ) : (
                                    <PinControls onPin={pinSnapshot} />
                                )}
                            </div>
                        </>
                    ) : (
                        <div
                            className="flex items-center justify-center h-full px-2 text-xs text-center"
                            style={{ color: "var(--color-text-muted)" }}
                        >
                            Select a snapshot to preview
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
