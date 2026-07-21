import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useVaultStore } from "../../stores/vaultStore";

export interface SnapshotInfo {
    timestamp: string;
    timestamp_ms: number;
    label: string | null;
}

/**
 * Snapshot listing/preview/pin state for the note history panel, kept
 * separate from its presentation.
 */
export function useNoteHistory(notePath: string, getCurrentContent: () => string) {
    const vaultPath = useVaultStore((s) => s.vaultPath);
    const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
    const [selected, setSelected] = useState<SnapshotInfo | null>(null);
    const [previewContent, setPreviewContent] = useState<string | null>(null);
    const [currentContent, setCurrentContent] = useState("");

    const loadSnapshots = useCallback(async () => {
        if (!vaultPath) return;
        try {
            setSnapshots(await invoke<SnapshotInfo[]>("list_note_snapshots", { vaultPath, notePath }));
        } catch (e) {
            console.error("Failed to load snapshots:", e);
        }
    }, [vaultPath, notePath]);

    useEffect(() => {
        loadSnapshots();
    }, [loadSnapshots]);

    const selectSnapshot = useCallback(
        async (snap: SnapshotInfo) => {
            setSelected(snap);
            setCurrentContent(getCurrentContent());
            if (!vaultPath) return;
            try {
                setPreviewContent(
                    await invoke<string>("get_note_snapshot", { vaultPath, notePath, timestamp: snap.timestamp }),
                );
            } catch (e) {
                console.error("Failed to load snapshot content:", e);
            }
        },
        [getCurrentContent, notePath, vaultPath],
    );

    const pinSnapshot = useCallback(
        async (label: string) => {
            if (!selected || !vaultPath || !label.trim()) return false;
            try {
                await invoke("pin_snapshot", { vaultPath, notePath, timestamp: selected.timestamp, label: label.trim() });
                await loadSnapshots();
                setSelected((prev) => (prev ? { ...prev, label: label.trim() } : prev));
                return true;
            } catch (e) {
                console.error("Failed to pin snapshot:", e);
                return false;
            }
        },
        [loadSnapshots, notePath, selected, vaultPath],
    );

    const unpinSnapshot = useCallback(
        async (snap: SnapshotInfo) => {
            if (!vaultPath) return;
            try {
                await invoke("unpin_snapshot", { vaultPath, notePath, timestamp: snap.timestamp });
                await loadSnapshots();
            } catch (e) {
                console.error("Failed to unpin snapshot:", e);
            }
        },
        [loadSnapshots, notePath, vaultPath],
    );

    return { snapshots, selected, previewContent, currentContent, selectSnapshot, pinSnapshot, unpinSnapshot };
}
