import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useVaultStore } from "../../stores/vaultStore";
import { useSyncStore } from "../../stores/syncStore";
import { SettingSection } from "./items/SettingSection";
import { SettingItem } from "./items/SettingItem";

export function SyncSettings() {
    const vaultPath = useVaultStore((s) => s.vaultPath);
    const { config, setConfig } = useSyncStore();

    const [remoteUrl, setRemoteUrl] = useState(config.remoteUrl ?? "");
    const [branch, setBranch] = useState(config.branch ?? "main");
    const [authorName, setAuthorName] = useState(config.authorName ?? "");
    const [authorEmail, setAuthorEmail] = useState(config.authorEmail ?? "");
    const [username, setUsername] = useState(config.username ?? "");
    const [password, setPassword] = useState(config.password ?? "");
    const [status, setStatus] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const inputStyle = {
        width: "100%",
        padding: "0.375rem 0.625rem",
        borderRadius: "0.375rem",
        border: "1px solid var(--color-border-light)",
        backgroundColor: "var(--color-background-secondary)",
        color: "var(--color-text-primary)",
        fontSize: "0.8125rem",
        outline: "none",
    };

    const btnStyle = (primary = false): React.CSSProperties => ({
        padding: "0.4rem 1rem",
        borderRadius: "0.375rem",
        fontSize: "0.8125rem",
        fontWeight: 500,
        cursor: busy ? "not-allowed" : "pointer",
        opacity: busy ? 0.6 : 1,
        backgroundColor: primary ? "var(--primary)" : "var(--color-background-secondary)",
        color: primary ? "white" : "var(--color-text-secondary)",
        border: primary ? "none" : "1px solid var(--color-border-light)",
    });

    const saveConfig = () => {
        setConfig({
            remoteUrl: remoteUrl.trim() || undefined,
            branch: branch.trim() || "main",
            authorName: authorName.trim() || undefined,
            authorEmail: authorEmail.trim() || undefined,
            username: username.trim() || undefined,
            password: password.trim() || undefined,
        });
    };

    const handleInit = async () => {
        if (!vaultPath) return;
        setBusy(true);
        setStatus(null);
        try {
            await invoke("init_vault_repo", { vaultPath });
            if (remoteUrl.trim()) {
                await invoke("set_sync_remote", { vaultPath, remoteUrl: remoteUrl.trim() });
            }
            saveConfig();
            setStatus("Repository initialized.");
        } catch (e) {
            setStatus(`Error: ${e}`);
        } finally {
            setBusy(false);
        }
    };

    const handleSync = async () => {
        if (!vaultPath) return;
        setBusy(true);
        setStatus(null);
        saveConfig();
        try {
            const updated = await invoke<boolean>("full_git_sync", {
                vaultPath,
                config: {
                    remote_url: remoteUrl.trim() || undefined,
                    remote_name: config.remoteName ?? "origin",
                    branch: branch.trim() || "main",
                    author_name: authorName.trim() || undefined,
                    author_email: authorEmail.trim() || undefined,
                    username: username.trim() || undefined,
                    password: password.trim() || undefined,
                },
            });
            setStatus(updated ? "Sync complete — remote changes applied." : "Sync complete — already up to date.");
        } catch (e) {
            setStatus(`Sync error: ${e}`);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div style={{ maxWidth: 600 }}>
            <SettingSection title="Git Sync" description="Sync your vault across devices using a Git remote.">
                <SettingItem label="Remote URL">
                    <input
                        type="url"
                        value={remoteUrl}
                        onChange={(e) => setRemoteUrl(e.target.value)}
                        placeholder="https://github.com/you/vault.git"
                        style={inputStyle}
                    />
                </SettingItem>
                <SettingItem label="Branch">
                    <input
                        type="text"
                        value={branch}
                        onChange={(e) => setBranch(e.target.value)}
                        placeholder="main"
                        style={{ ...inputStyle, width: 160 }}
                    />
                </SettingItem>
            </SettingSection>

            <SettingSection title="Author" description="Git commit author identity.">
                <SettingItem label="Name">
                    <input
                        type="text"
                        value={authorName}
                        onChange={(e) => setAuthorName(e.target.value)}
                        placeholder="Your Name"
                        style={inputStyle}
                    />
                </SettingItem>
                <SettingItem label="Email">
                    <input
                        type="email"
                        value={authorEmail}
                        onChange={(e) => setAuthorEmail(e.target.value)}
                        placeholder="you@example.com"
                        style={inputStyle}
                    />
                </SettingItem>
            </SettingSection>

            <SettingSection title="Authentication" description="HTTPS credentials (leave blank to use SSH agent).">
                <SettingItem label="Username">
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="github_username"
                        style={inputStyle}
                        autoComplete="username"
                    />
                </SettingItem>
                <SettingItem label="Password / Token">
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="ghp_…"
                        style={inputStyle}
                        autoComplete="new-password"
                    />
                </SettingItem>
            </SettingSection>

            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem", alignItems: "center" }}>
                <button style={btnStyle()} onClick={handleInit} disabled={busy}>
                    Initialize Repo
                </button>
                <button style={btnStyle(true)} onClick={handleSync} disabled={busy || !remoteUrl.trim()}>
                    {busy ? "Syncing…" : "Sync Now"}
                </button>
                {status && (
                    <span style={{ fontSize: "0.8125rem", color: status.startsWith("Error") ? "var(--color-alert-text)" : "var(--color-text-muted)" }}>
                        {status}
                    </span>
                )}
            </div>
        </div>
    );
}
