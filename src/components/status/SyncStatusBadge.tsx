import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useVaultStore } from "../../stores/vaultStore";
import { useSyncStore } from "../../stores/syncStore";
import { CloudOff, CheckCircle2, Upload, Download, RefreshCw, AlertTriangle, Loader2 } from "lucide-react";

const POLL_INTERVAL_MS = 30_000;

interface BackendSyncStatus {
    state: string;
    ahead: number;
    behind: number;
    uncommitted_changes: number;
    conflicts: string[];
    last_sync: number | null;
    message: string | null;
}

export function SyncStatusBadge() {
    const vaultPath = useVaultStore((s) => s.vaultPath);
    const { config, state, ahead, behind, conflicts, setStatus, setError } = useSyncStore();
    const [isSyncing, setIsSyncing] = useState(false);

    const pollStatus = useCallback(async () => {
        if (!vaultPath || !config.remoteUrl) return;
        try {
            const s = await invoke<BackendSyncStatus>("get_sync_status", { vaultPath });
            setStatus({
                state: s.state as any,
                ahead: s.ahead,
                behind: s.behind,
                uncommitted_changes: s.uncommitted_changes,
                conflicts: s.conflicts,
                message: s.message,
            });
        } catch {
            // Ignore polling errors
        }
    }, [vaultPath, config.remoteUrl, setStatus]);

    useEffect(() => {
        pollStatus();
        const id = setInterval(pollStatus, POLL_INTERVAL_MS);
        return () => clearInterval(id);
    }, [pollStatus]);

    const handleSync = async () => {
        if (!vaultPath || !config.remoteUrl || isSyncing) return;
        setIsSyncing(true);
        try {
            await invoke("full_git_sync", {
                vaultPath,
                config: {
                    remote_url: config.remoteUrl,
                    remote_name: config.remoteName ?? "origin",
                    branch: config.branch ?? "main",
                    author_name: config.authorName,
                    author_email: config.authorEmail,
                    username: config.username,
                    password: config.password,
                },
            });
            await pollStatus();
        } catch (e) {
            setError(String(e));
        } finally {
            setIsSyncing(false);
        }
    };

    // No remote configured — show nothing
    if (!config.remoteUrl) return null;

    const iconSize = 10;
    const baseStyle: React.CSSProperties = {
        display: "flex",
        alignItems: "center",
        gap: "0.25rem",
        fontSize: "0.625rem",
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        cursor: "pointer",
        userSelect: "none",
    };

    if (isSyncing || state === "syncing") {
        return (
            <span style={{ ...baseStyle, color: "var(--primary)" }} title="Syncing…">
                <Loader2 size={iconSize} className="animate-spin" />
                Syncing
            </span>
        );
    }

    if (state === "conflict") {
        return (
            <span
                style={{ ...baseStyle, color: "var(--color-alert-text)" }}
                onClick={handleSync}
                title={`${conflicts.length} conflict(s) — click to retry`}
            >
                <AlertTriangle size={iconSize} />
                {conflicts.length} Conflicts
            </span>
        );
    }

    if (state === "error") {
        return (
            <span
                style={{ ...baseStyle, color: "var(--color-alert-text)" }}
                onClick={handleSync}
                title="Sync error — click to retry"
            >
                <AlertTriangle size={iconSize} />
                Sync Error
            </span>
        );
    }

    if (state === "no_remote") {
        return (
            <span style={{ ...baseStyle, color: "var(--color-text-muted)" }} title="No remote configured">
                <CloudOff size={iconSize} />
                No Sync
            </span>
        );
    }

    if (state === "synced") {
        return (
            <span
                style={{ ...baseStyle, color: "var(--color-text-muted)" }}
                onClick={handleSync}
                title="Synced — click to sync now"
            >
                <CheckCircle2 size={iconSize} />
                Synced
            </span>
        );
    }

    if (state === "ahead") {
        return (
            <span
                style={{ ...baseStyle, color: "var(--primary)" }}
                onClick={handleSync}
                title={`${ahead} commit(s) to push — click to sync`}
            >
                <Upload size={iconSize} />
                {ahead} Ahead
            </span>
        );
    }

    if (state === "behind") {
        return (
            <span
                style={{ ...baseStyle, color: "var(--primary)" }}
                onClick={handleSync}
                title={`${behind} commit(s) to pull — click to sync`}
            >
                <Download size={iconSize} />
                {behind} Behind
            </span>
        );
    }

    if (state === "diverged") {
        return (
            <span
                style={{ ...baseStyle, color: "var(--color-text-muted)" }}
                onClick={handleSync}
                title={`Diverged (${ahead}↑ ${behind}↓) — click to sync`}
            >
                <RefreshCw size={iconSize} />
                {ahead}↑ {behind}↓
            </span>
        );
    }

    return null;
}
