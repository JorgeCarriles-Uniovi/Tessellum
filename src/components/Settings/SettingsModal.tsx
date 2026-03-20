import { X, User, Bell, Shield, Palette, FileText, Cloud, Keyboard, Moon, Sun, Monitor, ChevronRight, Check } from 'lucide-react';
import { useState, isValidElement, cloneElement } from 'react';
import { useTessellumApp } from "../../plugins/TessellumApp.ts";

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const [activeTab, setActiveTab] = useState<String>('General');
    const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('light');
    const [fontSize, setFontSize] = useState('16');
    const [autoSave, setAutoSave] = useState(true);
    const [spellCheck, setSpellCheck] = useState(true);
    const [lineNumbers, setLineNumbers] = useState(false);
    const [notifications, setNotifications] = useState(true);
    const [syncEnabled, setSyncEnabled] = useState(true);
    const app = useTessellumApp();
    const settingsTabs = app.ui.getSettingsTabs();
    const iconSize = 16;
    const iconStyle = { width: "1rem", height: "1rem" };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Overlay */}
            <div
                className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white w-[900px] h-[640px] flex overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                 style={{
                     borderRadius: "var(--radius-xl)",
                     boxShadow: "var(--shadow-modal)",
                 }}
            >
                {/* Sidebar */}
                <div className="w-[240px] bg-[#f8fafc] border-r border-[#e2e8f0] p-6 flex flex-col">
                    <div className="mb-8"
                         style={{
                             paddingTop: `1rem`,
                             paddingBottom: `0.2rem`,
                             paddingLeft: `1rem`,
                             paddingRight: `1rem`
                         }}>
                        <h2 className="text-xl font-bold text-[#0f172a] tracking-tight">Settings</h2>
                        <p className="text-xs text-[#94a3b8] mt-1">Customize your workspace</p>
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
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${tab.isActive
                                        ? 'text-white shadow-lg'
                                        : 'text-[#64748b] hover:bg-white hover:text-[#0f172a] hover:shadow-sm'
                                    }`}
                                    style={{
                                        backgroundColor: tab.isActive ? "var(--color-blue-600)" : undefined,
                                        boxShadow: tab.isActive ? "0 10px 15px -3px color-mix(in srgb, var(--color-blue-600) 25%, transparent)" : undefined,
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

                    <div className="pt-6 border-t border-[#e2e8f0]"
                         style={{
                             paddingTop: `0.75rem`,
                             paddingBottom: `0.75rem`,
                             paddingLeft: `1rem`,
                             paddingRight: `1rem`
                         }}>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#94a3b8] mb-2">Version</p>
                        <p className="text-xs text-[#64748b]">v1.2.0</p>
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
                    <div className="h-16 border-b border-[#f1f5f9] px-8 flex items-center justify-between">
                        <h3 className="text-lg font-bold text-[#0f172a]"
                        >
                            {settingsTabs.find(t => t.id === activeTab)?.name}
                        </h3>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-[#f8fafc] transition-colors group"
                            style={{
                                paddingTop: `0.5rem`,
                                paddingBottom: `0.5rem`,
                                paddingLeft: `1rem`,
                                paddingRight: `1rem`
                            }}
                        >
                            <X className="size-4 text-[#94a3b8] group-hover:text-[#0f172a] transition-colors" />
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
