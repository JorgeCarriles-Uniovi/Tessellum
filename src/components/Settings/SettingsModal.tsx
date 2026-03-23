import { X, ChevronRight } from 'lucide-react';
import { useState, isValidElement, cloneElement } from 'react';
import { useTessellumApp } from "../../plugins/TessellumApp.ts";

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const [activeTab, setActiveTab] = useState<String>('General');
    const app = useTessellumApp();
    const settingsTabs = app.ui.getSettingsTabs();
    const iconSize = 16;
    const iconStyle = { width: "1rem", height: "1rem" };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Overlay */}
            <div
                className="absolute inset-0 backdrop-blur-sm transition-opacity"
                style={{ backgroundColor: "var(--color-overlay-scrim)" }}
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-[900px] h-[640px] flex overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                 style={{
                     backgroundColor: "var(--color-panel-bg)",
                     borderRadius: "var(--radius-xl)",
                     boxShadow: "var(--shadow-modal)",
                 }}
            >
                {/* Sidebar */}
                <div
                    className="w-[240px] border-r p-6 flex flex-col"
                    style={{
                        backgroundColor: "var(--color-panel-bg)",
                        borderColor: "var(--color-panel-border)",
                    }}
                >
                    <div className="mb-8"
                         style={{
                             paddingTop: `1rem`,
                             paddingBottom: `0.2rem`,
                             paddingLeft: `1rem`,
                             paddingRight: `1rem`
                         }}>
                        <h2 className="text-xl font-bold tracking-tight" style={{ color: "var(--color-text-primary)" }}>Settings</h2>
                        <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>Customize your workspace</p>
                    </div>

                    <nav className="flex-1 space-y-1" style={{
                        paddingTop: `1rem`,
                        paddingBottom: `0.2rem`,
                        paddingLeft: `1rem`,
                        paddingRight: `1rem`
                    }}>

                        {settingsTabs.map((tab) => {
                            return (
                                <button
                                    key={tab.id}
                                    name={tab.name}
                                    disabled={tab.disabled}
                                    onClick={() => {
                                        settingsTabs.map(t => t.isActive = false);
                                        tab.isActive = true;
                                        setActiveTab(tab.id)
                                    }
                                    }
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all hover:bg-[color:var(--color-panel-hover)] hover:text-[color:var(--color-text-primary)]"
                                    style={{
                                        backgroundColor: tab.isActive ? "var(--primary)" : "var(--color-panel-bg)",
                                        boxShadow: tab.isActive ? "0 10px 15px -3px color-mix(in srgb, var(--primary) 25%, transparent)" : undefined,
                                        color: tab.isActive ? "var(--primary-foreground)" : "var(--color-text-muted)",
                                        paddingTop: `0.75rem`,
                                        paddingBottom: `0.75rem`,
                                        paddingLeft: `1rem`,
                                        paddingRight: `1rem`
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
                                    {tab.isActive && <ChevronRight className="size-3.5 ml-auto" />}
                                </button>
                            )
                        })}
                    </nav>

                    <div className="pt-6 border-t"
                         style={{
                             borderColor: "var(--color-panel-border)",
                             paddingTop: `0.75rem`,
                             paddingBottom: `0.75rem`,
                             paddingLeft: `1rem`,
                             paddingRight: `1rem`
                         }}>
                        <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--color-text-muted)" }}>Version</p>
                        <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>v1.2.0</p>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col"
                     style={{
                         paddingTop: `0.5rem`,
                         paddingBottom: `0.5rem`,
                         paddingLeft: `1rem`,
                         paddingRight: `1rem`
                     }}>
                    {/* Header */}
                    <div className="h-16 border-b px-8 flex items-center justify-between" style={{ borderColor: "var(--color-panel-border)" }}>
                        <h3 className="text-lg font-bold" style={{ color: "var(--color-text-primary)" }}>
                            {settingsTabs.find(t => t.id === activeTab)?.name}
                        </h3>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg transition-colors group hover:bg-[color:var(--color-panel-hover)]"
                            style={{
                                backgroundColor: "var(--color-panel-bg)",
                                paddingTop: `0.5rem`,
                                paddingBottom: `0.5rem`,
                                paddingLeft: `1rem`,
                                paddingRight: `1rem`
                            }}
                        >
                            <X className="size-4 transition-colors group-hover:text-[color:var(--color-text-primary)]" style={{ color: "var(--color-text-muted)" }} />
                        </button>
                    </div>

                    {/* Settings Content */}
                    <div className="flex-1 overflow-y-auto p-8">

                        {settingsTabs.find(t => t.id === activeTab)?.component ||
                            <div>No settings available for this tab.</div>}
                    </div>
                </div>
            </div>
        </div>
    );
}
