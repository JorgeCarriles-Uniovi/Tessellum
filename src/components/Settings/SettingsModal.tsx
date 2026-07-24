import { X } from 'lucide-react';
import { useEffect, useState, isValidElement, cloneElement } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { useTessellumApp } from "../../plugins/TessellumApp.ts";
import { useAppTranslation } from "../../i18n/react.tsx";
import { IconButton } from "../ui";

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const [activeTab, setActiveTab] = useState<string>("General");
    const [appVersion, setAppVersion] = useState<string>("");
    const app = useTessellumApp();
    const settingsTabs = app.ui.getSettingsTabs();
    const { t } = useAppTranslation("settings");
    const iconSize = 16;
    const iconStyle = { width: "1rem", height: "1rem" };

    useEffect(() => {
        if (!isOpen) return;

        const fallbackTab = settingsTabs.find((tab) => tab.isActive)?.id ?? settingsTabs[0]?.id ?? "General";
        setActiveTab((current) => settingsTabs.some((tab) => tab.id === current) ? current : fallbackTab);
    }, [isOpen, settingsTabs]);

    useEffect(() => {
        getVersion().then(setAppVersion).catch(() => setAppVersion(""));
    }, []);

    if (!isOpen) return null;

    const selectedTab = settingsTabs.find((tab) => tab.id === activeTab) ?? settingsTabs[0];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Overlay */}
            <div
                className="absolute inset-0 backdrop-blur-sm transition-opacity"
                style={{ backgroundColor: "var(--color-overlay-scrim)" }}
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative flex overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                 style={{
                     width: "min(912px, calc(100vw - 2rem))",
                     height: "min(624px, calc(100vh - 2rem))",
                     backgroundColor: "var(--color-panel-bg)",
                     borderRadius: "var(--radius-xl)",
                     boxShadow: "var(--shadow-modal)",
                 }}
            >
                {/* Sidebar */}
                <div
                    className="w-[236px] shrink-0 border-r flex flex-col overflow-y-auto max-sm:w-[180px]"
                    style={{
                        backgroundColor: "var(--color-bg-app)",
                        borderColor: "var(--color-panel-border)",
                    }}
                >
                    <div className="mb-6"
                         style={{
                             paddingTop: `1.25rem`,
                             paddingBottom: `0.2rem`,
                             paddingLeft: `1.25rem`,
                             paddingRight: `1.25rem`
                         }}>
                        <h2 className="text-base font-bold tracking-tight" style={{ color: "var(--color-text-primary)" }}>{t("title")}</h2>
                        <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>{t("subtitle")}</p>
                    </div>

                    <nav className="flex-1 space-y-0.5" style={{
                        paddingLeft: `0.75rem`,
                        paddingRight: `0.75rem`
                    }}>

                        {settingsTabs.map((tab) => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    name={tab.name}
                                    disabled={tab.disabled}
                                    onClick={() => setActiveTab(tab.id)}
                                    className="w-full flex items-center gap-2.5 rounded-lg text-sm font-medium transition-all hover:bg-[color:var(--color-panel-hover)]"
                                    style={{
                                        backgroundColor: isActive ? "var(--color-accent-soft)" : "transparent",
                                        color: isActive ? "var(--color-accent-default)" : "var(--color-text-tertiary)",
                                        paddingTop: `0.5rem`,
                                        paddingBottom: `0.5rem`,
                                        paddingLeft: `0.75rem`,
                                        paddingRight: `0.75rem`
                                    }}
                                >
                                    {isValidElement(tab.icon)
                                        ? cloneElement(tab.icon as any, {
                                            size: iconSize,
                                            style: { ...iconStyle, ...(tab.icon as any).props?.style },
                                        })
                                        : tab.icon
                                    }
                                    <span>{tab.name}</span>
                                </button>
                            )
                        })}
                    </nav>

                    <div className="border-t"
                         style={{
                             borderColor: "var(--color-panel-border)",
                             paddingTop: `0.75rem`,
                             paddingBottom: `0.75rem`,
                             paddingLeft: `1.25rem`,
                             paddingRight: `1.25rem`
                         }}>
                        <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--color-text-muted)" }}>{t("version")}</p>
                        <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>{appVersion ? `v${appVersion}` : "—"}</p>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Header */}
                    <div
                        className="shrink-0 border-b flex items-center justify-between"
                        style={{ height: "60px", paddingLeft: "28px", paddingRight: "20px", borderColor: "var(--color-panel-border)" }}
                    >
                        <h3
                            className="text-sm font-semibold"
                            style={{ color: "var(--color-text-primary)", textTransform: "capitalize" }}
                        >
                            {selectedTab?.name}
                        </h3>
                        <IconButton
                            label="Close settings"
                            onClick={onClose}
                            size={32}
                        >
                            <X className="size-4" />
                        </IconButton>
                    </div>

                    {/* Settings Content */}
                    <div className="flex-1 overflow-y-auto" style={{ padding: "26px 28px" }}>

                        {selectedTab?.component ||
                            <div>{t("noSettingsAvailable")}</div>}
                    </div>
                </div>
            </div>
        </div>
    );
}
