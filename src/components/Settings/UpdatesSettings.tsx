import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { toast } from "sonner";
import { SettingSection } from "./items/SettingSection";
import { SettingButton } from "./items/SettingButton";
import { useUpdaterStore } from "../../stores/updaterStore";

export function UpdatesSettings() {
    const [appVersion, setAppVersion] = useState<string>("");
    const status = useUpdaterStore((s) => s.status);
    const checkForUpdates = useUpdaterStore((s) => s.checkForUpdates);

    useEffect(() => {
        getVersion()
            .then(setAppVersion)
            .catch(() => setAppVersion(""));
    }, []);

    const checking = status === "checking";

    const handleCheck = async () => {
        await checkForUpdates({ silent: false });
        const s = useUpdaterStore.getState();
        if (s.status === "uptodate") {
            toast.success("You're on the latest version.");
        } else if (s.status === "available") {
            toast.message(`Update available: v${s.version}`);
        } else if (s.status === "error") {
            toast.error(`Update check failed: ${s.error ?? "unknown error"}`);
        }
    };

    return (
        <div className="space-y-6">
            <SettingSection title="Updates" description="Keep Tessellum up to date.">
                <div className="flex items-center justify-between" style={{ padding: "0.5rem 1rem" }}>
                    <div>
                        <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                            Current version
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                            {appVersion ? `v${appVersion}` : "—"}
                        </p>
                    </div>
                    <SettingButton variant="primary" onClick={handleCheck} disabled={checking}>
                        {checking ? "Checking…" : "Check for updates"}
                    </SettingButton>
                </div>
                <p className="text-xs" style={{ padding: "0 1rem", color: "var(--color-text-muted)" }}>
                    Tessellum also checks for updates automatically when it starts.
                </p>
            </SettingSection>
        </div>
    );
}
