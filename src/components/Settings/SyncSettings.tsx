import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useVaultStore } from "../../stores/vaultStore";
import { useSyncStore, persistSyncSecret } from "../../stores/syncStore";
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
    // Tracks whether the user has actually edited the password field in this
    // session. `hydrateSyncSecret()` resolves asynchronously, so the field
    // can still read "" here even though the keychain holds a real password.
    // Only a deliberate edit should be allowed to write (or delete) the
    // stored credential — see the guard in saveConfig below.
    const [passwordDirty, setPasswordDirty] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    // The credential arrives asynchronously from the OS credential store; seed
    // the field once it lands, unless the user has already touched it.
    //
    // Gated on passwordDirty rather than `!password`: gating on emptiness
    // meant clearing the field (which sets password to "") immediately
    // re-satisfied the guard, so this effect wrote config.password straight
    // back on the next render and the field could never actually be cleared.
    // Once the user has deliberately edited the field — including clearing it
    // — it becomes the source of truth for the rest of this component's
    // lifetime; there is no scenario where re-seeding from config.password
    // after that should win over what the user just typed, so passwordDirty
    // is intentionally never reset back to false (see saveConfig below).
    useEffect(() => {
        if (config.password && !passwordDirty) {
            setPassword(config.password);
        }
    }, [config.password, passwordDirty]);

    // Returns false (and surfaces an error) if the credential write failed,
    // so callers can avoid overwriting that message with an unrelated
    // success status.
    const saveConfig = async (): Promise<boolean> => {
        setConfig({
            remoteUrl: remoteUrl.trim() || undefined,
            branch: branch.trim() || "main",
            authorName: authorName.trim() || undefined,
            authorEmail: authorEmail.trim() || undefined,
            username: username.trim() || undefined,
            password: password.trim() || undefined,
        });
        // The password is stripped from the persisted blob, so it must be
        // written through to the OS credential store explicitly.
        //
        // Gated on passwordDirty: a save that fires before hydrateSyncSecret()
        // resolves would otherwise see an empty local field and call
        // persistSyncSecret() with "", which setSecret() treats as a delete —
        // silently destroying the user's stored credential. Only a field the
        // user actually touched should be allowed to overwrite the keychain.
        if (passwordDirty) {
            const ok = await persistSyncSecret();
            if (!ok) {
                setStatus("Error: couldn't save the git password to the credential store. It will not persist after restart.");
                return false;
            }
        }
        return true;
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
            const saved = await saveConfig();
            if (saved) {
                setStatus("Repository initialized.");
            }
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
        const saved = await saveConfig();
        if (!saved) {
            setBusy(false);
            return;
        }
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
                    onChange={(v) => {
                        setPassword(v);
                        setPasswordDirty(true);
                    }}
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
