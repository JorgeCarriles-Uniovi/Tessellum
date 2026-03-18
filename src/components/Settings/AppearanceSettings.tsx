import { SettingSection } from "./items/SettingSection.tsx";
import { ThemeOption } from "./items/ThemeOption.tsx";
import { ToggleSetting } from "./items/ToggleSetting.tsx";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";

export function AppearanceSettings() {
    const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('light');
    const [themeSchedule, setThemeSchedule] = useState<'system' | 'sun' | 'custom'>('system');
    const [accentColor, setAccentColor] = useState('#3d14b8');
    const [customAccent, setCustomAccent] = useState('#3d14b8');
    const [density, setDensity] = useState<'compact' | 'comfortable'>('comfortable');
    const [radius, setRadius] = useState('10');
    const [shadow, setShadow] = useState<'subtle' | 'medium' | 'strong'>('medium');
    const [iconStyle, setIconStyle] = useState<'outline' | 'filled'>('outline');
    const [sidebarPosition, setSidebarPosition] = useState<'left' | 'right'>('left');
    const [toolbarVisible, setToolbarVisible] = useState(true);

    const pillStyle = {
        paddingTop: `0.5rem`,
        paddingBottom: `0.5rem`,
        paddingLeft: `0.5rem`,
        paddingRight: `0.5rem`,
    }
    const timeInputStyle = {
        paddingTop: `0.5rem`,
        paddingBottom: `0.5rem`,
        paddingLeft: `0.5rem`,
        paddingRight: `0.5rem`,
    }

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

            <SettingSection title="Theme Schedule" description="Automatically switch themes">
                <div className="grid grid-cols-3 gap-3">
                    <button
                        onClick={() => setThemeSchedule('system')}
                        className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${themeSchedule === 'system'
                            ? 'border-[#3d14b8] bg-[rgba(61,20,184,0.05)] text-[#3d14b8]'
                            : 'border-[#e2e8f0] text-[#64748b] hover:border-[#cbd5e1]'
                        }`}
                        style={pillStyle}
                    >
                        System
                    </button>
                    <button
                        onClick={() => setThemeSchedule('sun')}
                        className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${themeSchedule === 'sun'
                            ? 'border-[#3d14b8] bg-[rgba(61,20,184,0.05)] text-[#3d14b8]'
                            : 'border-[#e2e8f0] text-[#64748b] hover:border-[#cbd5e1]'
                        }`}
                        style={pillStyle}
                    >
                        Sunrise / Sunset
                    </button>
                    <button
                        onClick={() => setThemeSchedule('custom')}
                        className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${themeSchedule === 'custom'
                            ? 'border-[#3d14b8] bg-[rgba(61,20,184,0.05)] text-[#3d14b8]'
                            : 'border-[#e2e8f0] text-[#64748b] hover:border-[#cbd5e1]'
                        }`}
                        style={pillStyle}
                    >
                        Custom
                    </button>
                </div>
                {themeSchedule === 'custom' && (
                    <div className="mt-4 grid grid-cols-2 gap-3"
                         style={{
                             paddingTop: `1rem`,
                             paddingLeft: `1rem`,
                             paddingRight: `1rem`,
                         }}>
                        <div className="flex items-center justify-between">
                            <label className="text-xs text-[#475569]">Light start</label>
                            <input
                                type="time"
                                defaultValue="08:00"
                                className="px-2 py-1 border border-[#e2e8f0] rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-[#3d14b8] focus:border-transparent transition-all"
                                style={timeInputStyle}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <label className="text-xs text-[#475569]">Dark start</label>
                            <input
                                type="time"
                                defaultValue="20:00"
                                className="px-2 py-1 border border-[#e2e8f0] rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-[#3d14b8] focus:border-transparent transition-all"
                                style={timeInputStyle}
                            />
                        </div>
                    </div>
                )}
            </SettingSection>

            <SettingSection title="Accent Color" description="Customize the accent color">
                <div className="grid grid-cols-6 gap-2"
                     style={{
                         paddingBottom: `1rem`,
                     }}
                >
                    {['#3d14b8', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'].map((color) => (
                        <button
                            key={color}
                            onClick={() => setAccentColor(color)}
                            className={`size-10 rounded-lg border-2 transition-all relative group ${accentColor === color ? 'border-[#3d14b8]' : 'border-transparent hover:border-[#e2e8f0]'
                            }`}
                            style={{ backgroundColor: color }}
                        >
                            {accentColor === color && (
                                <Check className="size-4 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                            )}
                        </button>
                    ))}
                </div>
                <div className="mt-4 flex items-center gap-3">
                    <input
                        type="color"
                        value={customAccent}
                        onChange={(e) => {
                            setCustomAccent(e.target.value);
                            setAccentColor(e.target.value);
                        }}
                        className="size-10 rounded-lg border border-[#e2e8f0] bg-white cursor-pointer"
                    />
                    <input
                        type="text"
                        value={customAccent}
                        onChange={(e) => {
                            setCustomAccent(e.target.value);
                            setAccentColor(e.target.value);
                        }}
                        className="px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3d14b8] focus:border-transparent transition-all w-32"
                        style={pillStyle}
                    />
                    <div
                        className="size-8 rounded-md border border-[#e2e8f0]"
                        style={{ backgroundColor: accentColor }}
                    />
                </div>
            </SettingSection>

            <SettingSection title="Visual Style" description="Adjust density and styling">
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between">
                        <label className="text-sm text-[#475569]">Density</label>
                        <select
                            value={density}
                            onChange={(e) => setDensity(e.target.value as 'compact' | 'comfortable')}
                            className="px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3d14b8] focus:border-transparent transition-all bg-white cursor-pointer"
                            style={pillStyle}
                        >
                            <option value="compact">Compact</option>
                            <option value="comfortable">Comfortable</option>
                        </select>
                    </div>
                    <div className="flex items-center justify-between">
                        <label className="text-sm text-[#475569]">Corner radius</label>
                        <select
                            value={radius}
                            onChange={(e) => setRadius(e.target.value)}
                            className="px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3d14b8] focus:border-transparent transition-all bg-white cursor-pointer"
                            style={pillStyle}
                        >
                            <option value="6">Sharp</option>
                            <option value="10">Balanced</option>
                            <option value="16">Soft</option>
                        </select>
                    </div>
                    <div className="flex items-center justify-between">
                        <label className="text-sm text-[#475569]">Shadows</label>
                        <select
                            value={shadow}
                            onChange={(e) => setShadow(e.target.value as 'subtle' | 'medium' | 'strong')}
                            className="px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3d14b8] focus:border-transparent transition-all bg-white cursor-pointer"
                            style={pillStyle}
                        >
                            <option value="subtle">Subtle</option>
                            <option value="medium">Medium</option>
                            <option value="strong">Strong</option>
                        </select>
                    </div>
                    <div className="flex items-center justify-between">
                        <label className="text-sm text-[#475569]">Icon style</label>
                        <select
                            value={iconStyle}
                            onChange={(e) => setIconStyle(e.target.value as 'outline' | 'filled')}
                            className="px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3d14b8] focus:border-transparent transition-all bg-white cursor-pointer"
                            style={pillStyle}
                        >
                            <option value="outline">Outline</option>
                            <option value="filled">Filled</option>
                        </select>
                    </div>
                </div>
            </SettingSection>

            <SettingSection title="Layout" description="Adjust workspace layout options">
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between">
                        <label className="text-sm text-[#475569]">Sidebar position</label>
                        <select
                            value={sidebarPosition}
                            onChange={(e) => setSidebarPosition(e.target.value as 'left' | 'right')}
                            className="px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3d14b8] focus:border-transparent transition-all bg-white cursor-pointer"
                            style={pillStyle}
                        >
                            <option value="left">Left</option>
                            <option value="right">Right</option>
                        </select>
                    </div>
                    <ToggleSetting
                        label="Toolbar"
                        description="Show the top toolbar"
                        checked={toolbarVisible}
                        onChange={setToolbarVisible}
                    />
                </div>
            </SettingSection>
        </div>
    );
}
