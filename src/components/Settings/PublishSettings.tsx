import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useVaultStore } from "../../stores/vaultStore";
import { SettingSection } from "./items/SettingSection";
import { SettingItem } from "./items/SettingItem";
import { Button } from "../ui";

interface PublishResult {
    published: number;
    skipped: number;
    output_dir: string;
}

export function PublishSettings() {
    const vaultPath = useVaultStore((s) => s.vaultPath);
    const defaultOutputDir = vaultPath ? `${vaultPath}/site` : "";

    const [outputDir, setOutputDir] = useState(defaultOutputDir);
    const [siteTitle, setSiteTitle] = useState("My Notes");
    const [status, setStatus] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const inputStyle: React.CSSProperties = {
        width: "100%",
        padding: "0.375rem 0.625rem",
        borderRadius: "0.375rem",
        border: "1px solid var(--color-border-light)",
        backgroundColor: "var(--color-background-secondary)",
        color: "var(--color-text-primary)",
        fontSize: "0.8125rem",
        outline: "none",
    };

    const handlePublish = async () => {
        if (!vaultPath) {
            setStatus("Error: No vault is open.");
            return;
        }
        const resolvedOutputDir = outputDir.trim() || `${vaultPath}/site`;
        setBusy(true);
        setStatus(null);
        try {
            const result = await invoke<PublishResult>("publish_vault", {
                vaultPath,
                outputDir: resolvedOutputDir,
                siteTitle: siteTitle.trim() || undefined,
            });
            setStatus(
                `Published ${result.published} note${result.published === 1 ? "" : "s"} to ${result.output_dir} (${result.skipped} skipped).`
            );
        } catch (e) {
            setStatus(`Error: ${e}`);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div style={{ maxWidth: 600 }}>
            <SettingSection
                title="Static Site Publisher"
                description="Export your vault as a static HTML website. Notes with 'publish: false' in their frontmatter are excluded."
            >
                <SettingItem label="Site Title">
                    <input
                        type="text"
                        value={siteTitle}
                        onChange={(e) => setSiteTitle(e.target.value)}
                        placeholder="My Notes"
                        style={inputStyle}
                    />
                </SettingItem>
                <SettingItem label="Output Directory">
                    <input
                        type="text"
                        value={outputDir}
                        onChange={(e) => setOutputDir(e.target.value)}
                        placeholder={defaultOutputDir || "/path/to/site"}
                        style={inputStyle}
                    />
                </SettingItem>
            </SettingSection>

            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem", alignItems: "center" }}>
                <Button variant="primary" onClick={handlePublish} disabled={busy || !vaultPath}>
                    {busy ? "Publishing…" : "Publish"}
                </Button>
                {status && (
                    <span
                        style={{
                            fontSize: "0.8125rem",
                            color: status.startsWith("Error")
                                ? "var(--color-alert-text)"
                                : "var(--color-text-muted)",
                        }}
                    >
                        {status}
                    </span>
                )}
            </div>
        </div>
    );
}
