import {SettingSection} from "./items/SettingSection.tsx";
import {ThemeOption} from "./items/ThemeOption.tsx";
import {Check, Monitor, Moon, Sun} from "lucide-react";
import {useState} from "react";

export function AppearanceSettings() {
    const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('light');
    return (
        <div className="space-y-6">
            <SettingSection title="Theme" description="Choose your preferred theme">
                <div className="grid grid-cols-3 gap-3">
                    <ThemeOption
                        label="Light"
                        icon={Sun}
                        selected={theme === 'light'}
                        onClick={() => setTheme('light')}
                    />
                    <ThemeOption
                        label="Dark"
                        icon={Moon}
                        selected={theme === 'dark'}
                        onClick={() => setTheme('dark')}
                    />
                    <ThemeOption
                        label="System"
                        icon={Monitor}
                        selected={theme === 'system'}
                        onClick={() => setTheme('system')}
                    />
                </div>
            </SettingSection>

            <SettingSection title="Accent Color" description="Customize the accent color">
                <div className="grid grid-cols-6 gap-2">
                    {['#3d14b8', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'].map((color) => (
                        <button
                            key={color}
                            className="size-10 rounded-lg border-2 border-transparent hover:border-[#e2e8f0] transition-all relative group"
                            style={{ backgroundColor: color }}
                        >
                            {color === '#3d14b8' && (
                                <Check className="size-4 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                            )}
                        </button>
                    ))}
                </div>
            </SettingSection>
        </div>
    );
}