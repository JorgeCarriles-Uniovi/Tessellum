import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useVaultStore } from "../../stores/vaultStore";
import { DatabaseZap } from "lucide-react";

interface IndexStatus {
    indexed: number;
    total: number;
    stale: number;
    sync_in_progress: boolean;
}

const POLL_INTERVAL_MS = 8000;

export function IndexStatusBadge() {
    const vaultPath = useVaultStore((s) => s.vaultPath);
    const [status, setStatus] = useState<IndexStatus | null>(null);

    const refresh = useCallback(async () => {
        if (!vaultPath) return;
        try {
            const s = await invoke<IndexStatus>("get_index_status", { vaultPath });
            setStatus(s);
        } catch {
            // non-fatal — badge simply stays hidden
        }
    }, [vaultPath]);

    useEffect(() => {
        refresh();
        const id = setInterval(refresh, POLL_INTERVAL_MS);
        return () => clearInterval(id);
    }, [refresh]);

    if (!status) return null;

    const { indexed, total, stale, sync_in_progress } = status;

    if (sync_in_progress) {
        return (
            <span
                className="flex items-center gap-1"
                title="Indexing vault…"
                style={{ color: "var(--primary)" }}
            >
                <DatabaseZap size={10} />
                <span>Indexing…</span>
            </span>
        );
    }

    if (stale > 0) {
        return (
            <span
                className="flex items-center gap-1"
                title={`${stale} file${stale === 1 ? "" : "s"} out of date — sync in progress`}
                style={{ color: "var(--color-text-muted)" }}
            >
                <DatabaseZap size={10} />
                <span>{indexed}/{total} indexed</span>
            </span>
        );
    }

    return (
        <span
            className="flex items-center gap-1"
            title={`Index up to date — ${indexed} notes`}
            style={{ color: "var(--color-text-muted)" }}
        >
            <DatabaseZap size={10} />
            <span>{indexed} indexed</span>
        </span>
    );
}
