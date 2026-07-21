import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useVaultStore } from "../../stores/vaultStore";
import { useSyncStore } from "../../stores/syncStore";
import { SettingSection } from "./items/SettingSection";
import { TextInputSetting } from "./items/TextInputSetting";
import { SettingButton } from "./items/SettingButton";
import { SettingStatus } from "./items/SettingStatus";

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
        <div className="space-y-6">
            <SettingSection title="Git Sync" description="Sync your vault across devices using a Git remote.">
                <TextInputSetting
                    label="Remote URL"
                    type="url"
                    value={remoteUrl}
                    onChange={setRemoteUrl}
                    placeholder="https://github.com/you/vault.git"
                />
                <TextInputSetting
                    label="Branch"
                    value={branch}
                    onChange={setBranch}
                    placeholder="main"
                />
            </SettingSection>

            <SettingSection title="Author" description="Git commit author identity.">
                <TextInputSetting
                    label="Name"
                    value={authorName}
                    onChange={setAuthorName}
                    placeholder="Your Name"
                />
                <TextInputSetting
                    label="Email"
                    type="email"
                    value={authorEmail}
                    onChange={setAuthorEmail}
                    placeholder="you@example.com"
                />
            </SettingSection>

            <SettingSection title="Authentication" description="HTTPS credentials (leave blank to use SSH agent).">
                <TextInputSetting
                    label="Username"
                    value={username}
                    onChange={setUsername}
                    placeholder="github_username"
                    autoComplete="username"
                />
                <TextInputSetting
                    label="Password / Token"
                    type="password"
                    value={password}
                    onChange={setPassword}
                    placeholder="ghp_…"
                    autoComplete="new-password"
                />

                <div className="flex items-center gap-3" style={{ paddingLeft: "1rem", paddingRight: "1rem", paddingTop: "0.5rem" }}>
                    <SettingButton onClick={handleInit} disabled={busy}>
                        Initialize Repo
                    </SettingButton>
                    <SettingButton variant="primary" onClick={handleSync} disabled={busy || !remoteUrl.trim()}>
                        {busy ? "Syncing…" : "Sync Now"}
                    </SettingButton>
                </div>
                <div style={{ paddingLeft: "1rem", paddingRight: "1rem" }}>
                    <SettingStatus message={status} error={!!status && status.toLowerCase().includes("error")} />
                </div>
            </SettingSection>
        </div>
    );
}
