import { Download, X } from "lucide-react";
import { useUpdaterStore } from "../../stores/updaterStore";
import { SettingButton } from "../Settings/items/SettingButton";
import { IconButton } from "../ui";

/**
 * Modal shown when a newer version is available (from the launch check or the
 * Settings "Check for updates" button). Lets the user download & install now or
 * dismiss until next launch.
 */
export function UpdatePrompt() {
    const status = useUpdaterStore((s) => s.status);
    const version = useUpdaterStore((s) => s.version);
    const currentVersion = useUpdaterStore((s) => s.currentVersion);
    const notes = useUpdaterStore((s) => s.notes);
    const progress = useUpdaterStore((s) => s.progress);
    const error = useUpdaterStore((s) => s.error);
    const dismissed = useUpdaterStore((s) => s.dismissed);
    const installUpdate = useUpdaterStore((s) => s.installUpdate);
    const dismiss = useUpdaterStore((s) => s.dismiss);

    const downloading = status === "downloading";
    // Keep the modal open on a failed install (version set) so the error is shown;
    // a bare "error" with no pending update is handled by the Settings toast instead.
    const open =
        !dismissed &&
        (status === "available" || downloading || (status === "error" && version !== null));
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Overlay */}
            <div
                className="absolute inset-0 backdrop-blur-sm transition-opacity"
                style={{ backgroundColor: "var(--color-overlay-scrim)" }}
                onClick={downloading ? undefined : dismiss}
            />

            {/* Modal */}
            <div
                className="relative w-[460px] max-w-[90vw] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                style={{
                    backgroundColor: "var(--color-panel-bg)",
                    borderRadius: "var(--radius-xl)",
                    boxShadow: "var(--shadow-modal)",
                }}
            >
                {/* Header */}
                <div
                    className="flex items-center gap-2 px-5 h-14 border-b"
                    style={{ borderColor: "var(--color-panel-border)" }}
                >
                    <Download size={16} style={{ color: "var(--primary)" }} />
                    <h3 className="text-base font-bold flex-1" style={{ color: "var(--color-text-primary)" }}>
                        Update available
                    </h3>
                    {!downloading && (
                        <IconButton label="Dismiss update" onClick={dismiss}>
                            <X size={16} />
                        </IconButton>
                    )}
                </div>

                {/* Body */}
                <div className="px-5 py-4 flex flex-col gap-3">
                    <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                        A new version of Tessellum is available.
                        {currentVersion && version && (
                            <>
                                {" "}
                                <span style={{ color: "var(--color-text-muted)" }}>v{currentVersion}</span>
                                {" → "}
                                <span className="font-semibold" style={{ color: "var(--primary)" }}>
                                    v{version}
                                </span>
                            </>
                        )}
                    </p>

                    {notes && (
                        <div
                            className="text-xs whitespace-pre-wrap break-words overflow-y-auto rounded-lg p-3"
                            style={{
                                color: "var(--color-text-secondary)",
                                backgroundColor: "var(--color-panel-active)",
                                maxHeight: "220px",
                            }}
                        >
                            {notes}
                        </div>
                    )}

                    {downloading && (
                        <div className="flex flex-col gap-1.5">
                            <div
                                className="h-2 w-full rounded-full overflow-hidden"
                                style={{ backgroundColor: "var(--color-border-light)" }}
                            >
                                <div
                                    className="h-full rounded-full transition-all"
                                    style={{ width: `${progress}%`, backgroundColor: "var(--primary)" }}
                                />
                            </div>
                            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                                {progress > 0 ? `Downloading… ${progress}%` : "Starting download…"}
                            </span>
                        </div>
                    )}

                    {error && status === "error" && (
                        <p className="text-sm" style={{ color: "var(--destructive)" }}>
                            {error}
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div
                    className="flex items-center justify-end gap-2 px-5 py-3 border-t"
                    style={{ borderColor: "var(--color-panel-border)" }}
                >
                    <SettingButton onClick={dismiss} disabled={downloading}>
                        Later
                    </SettingButton>
                    <SettingButton variant="primary" onClick={installUpdate} disabled={downloading}>
                        {downloading ? "Installing…" : "Update now"}
                    </SettingButton>
                </div>
            </div>
        </div>
    );
}
