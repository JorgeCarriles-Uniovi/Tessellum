import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useVaultStore } from "../../stores/vaultStore";

interface RecoveryFileInfo {
    original_path: string;
    recovery_filename: string;
    saved_at_ms: number;
}

interface RecoveryBannerProps {
    /** Called after a note's content has been restored so callers can navigate to it. */
    onNavigate?: (originalPath: string) => void;
}

export function RecoveryBanner({ onNavigate }: RecoveryBannerProps) {
    const vaultPath = useVaultStore((s) => s.vaultPath);
    const files = useVaultStore((s) => s.files);
    const setActiveNote = useVaultStore((s) => s.setActiveNote);
    const [items, setItems] = useState<RecoveryFileInfo[]>([]);

    useEffect(() => {
        if (!vaultPath) return;
        invoke<RecoveryFileInfo[]>("list_recovery_files", { vaultPath })
            .then(setItems)
            .catch(() => {/* non-critical */});
    }, [vaultPath]);

    if (items.length === 0) return null;

    const handleRestore = async (item: RecoveryFileInfo) => {
        if (!vaultPath) return;
        try {
            const content = await invoke<string>("read_recovery_file", {
                vaultPath,
                recoveryFilename: item.recovery_filename,
            });

            // Save the recovered content as the actual file so the editor loads it fresh.
            const fullPath = vaultPath.replace(/\/$/, "") + "/" + item.original_path;
            await invoke("write_file", { vaultPath, path: fullPath, content });

            // Navigate to the restored note.
            const file = files.find((f) => f.path === fullPath || f.path === item.original_path);
            if (file) {
                setActiveNote(file);
                onNavigate?.(item.original_path);
            }

            await invoke("clear_recovery_file", {
                vaultPath,
                recoveryFilename: item.recovery_filename,
            });
            setItems((prev) => prev.filter((i) => i.recovery_filename !== item.recovery_filename));
        } catch (e) {
            console.error("Failed to restore recovery file:", e);
        }
    };

    const handleDiscard = async (item: RecoveryFileInfo) => {
        if (!vaultPath) return;
        try {
            await invoke("clear_recovery_file", {
                vaultPath,
                recoveryFilename: item.recovery_filename,
            });
            setItems((prev) => prev.filter((i) => i.recovery_filename !== item.recovery_filename));
        } catch (e) {
            console.error("Failed to discard recovery file:", e);
        }
    };

    return (
        <div
            className="flex flex-col gap-1 px-3 py-2 border-b text-xs"
            style={{
                backgroundColor: "var(--color-warning-bg, #fef3c7)",
                borderColor: "var(--color-warning-border, #f59e0b)",
            }}
        >
            {items.map((item) => {
                const date = new Date(item.saved_at_ms);
                const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                const shortName = item.original_path.split("/").pop() ?? item.original_path;
                return (
                    <div key={item.recovery_filename} className="flex items-center gap-2 flex-wrap">
                        <span style={{ color: "var(--color-warning-text, #92400e)" }}>
                            Unsaved changes for <strong>{shortName}</strong> from {timeStr}
                        </span>
                        <button
                            onClick={() => handleRestore(item)}
                            className="px-2 py-0.5 rounded font-medium"
                            style={{
                                backgroundColor: "var(--color-warning-action-bg, #d97706)",
                                color: "white",
                            }}
                        >
                            Restore
                        </button>
                        <button
                            onClick={() => handleDiscard(item)}
                            className="px-2 py-0.5 rounded font-medium"
                            style={{
                                color: "var(--color-warning-text, #92400e)",
                                border: "1px solid currentColor",
                            }}
                        >
                            Discard
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
