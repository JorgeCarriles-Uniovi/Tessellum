import { SettingSection } from "./items/SettingSection.tsx";
import { ThemeOption } from "./items/ThemeOption.tsx";
import { ToggleSetting } from "./items/ToggleSetting.tsx";
import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import { useAppearanceStore, useThemeStore } from "../../stores";

export function AppearanceSettings() {
    const [themeSchedule, setThemeSchedule] = useState<'system' | 'sun' | 'custom'>('system');
    const themes = useThemeStore((state) => state.themes);
    const activeThemeName = useThemeStore((state) => state.activeThemeName);
    const setActiveTheme = useThemeStore((state) => state.setActiveTheme);
    const accentColor = useAppearanceStore((state) => state.accentColor);
    const setAccentColor = useAppearanceStore((state) => state.setAccentColor);
    const density = useAppearanceStore((state) => state.density);
    const setDensity = useAppearanceStore((state) => state.setDensity);
    const radius = useAppearanceStore((state) => state.radius);
    const setRadius = useAppearanceStore((state) => state.setRadius);
    const shadow = useAppearanceStore((state) => state.shadow);
    const setShadow = useAppearanceStore((state) => state.setShadow);
    const iconStyle = useAppearanceStore((state) => state.iconStyle);
    const setIconStyle = useAppearanceStore((state) => state.setIconStyle);
    const sidebarPosition = useAppearanceStore((state) => state.sidebarPosition);
    const setSidebarPosition = useAppearanceStore((state) => state.setSidebarPosition);
    const toolbarVisible = useAppearanceStore((state) => state.toolbarVisible);
    const setToolbarVisible = useAppearanceStore((state) => state.setToolbarVisible);
    const terminalHeaderBg = useAppearanceStore((state) => state.terminalHeaderBg);
    const setTerminalHeaderBg = useAppearanceStore((state) => state.setTerminalHeaderBg);
    const terminalLineBg = useAppearanceStore((state) => state.terminalLineBg);
    const setTerminalLineBg = useAppearanceStore((state) => state.setTerminalLineBg);
    const terminalBorder = useAppearanceStore((state) => state.terminalBorder);
    const setTerminalBorder = useAppearanceStore((state) => state.setTerminalBorder);
    const terminalText = useAppearanceStore((state) => state.terminalText);
    const setTerminalText = useAppearanceStore((state) => state.setTerminalText);
    const terminalMuted = useAppearanceStore((state) => state.terminalMuted);
    const setTerminalMuted = useAppearanceStore((state) => state.setTerminalMuted);
    const terminalCustom = useAppearanceStore((state) => state.terminalCustom);
    const setTerminalCustom = useAppearanceStore((state) => state.setTerminalCustom);
    const syntaxComment = useAppearanceStore((state) => state.syntaxComment);
    const setSyntaxComment = useAppearanceStore((state) => state.setSyntaxComment);
    const syntaxKeyword = useAppearanceStore((state) => state.syntaxKeyword);
    const setSyntaxKeyword = useAppearanceStore((state) => state.setSyntaxKeyword);
    const syntaxOperator = useAppearanceStore((state) => state.syntaxOperator);
    const setSyntaxOperator = useAppearanceStore((state) => state.setSyntaxOperator);
    const syntaxString = useAppearanceStore((state) => state.syntaxString);
    const setSyntaxString = useAppearanceStore((state) => state.setSyntaxString);
    const syntaxNumber = useAppearanceStore((state) => state.syntaxNumber);
    const setSyntaxNumber = useAppearanceStore((state) => state.setSyntaxNumber);
    const syntaxVariable = useAppearanceStore((state) => state.syntaxVariable);
    const setSyntaxVariable = useAppearanceStore((state) => state.setSyntaxVariable);
    const syntaxFunction = useAppearanceStore((state) => state.syntaxFunction);
    const setSyntaxFunction = useAppearanceStore((state) => state.setSyntaxFunction);
    const syntaxCustom = useAppearanceStore((state) => state.syntaxCustom);
    const setSyntaxCustom = useAppearanceStore((state) => state.setSyntaxCustom);

    const pillStyle = {
        paddingTop: `0.5rem`,
        paddingBottom: `0.5rem`,
        paddingLeft: `0.5rem`,
        paddingRight: `0.5rem`,

    }
    const mutedLabelStyle = {
        color: "var(--color-text-muted)",
    };
    const inputBaseStyle = {
        borderColor: "var(--color-border-light)",
        backgroundColor: "var(--color-panel-bg)",
        color: "var(--color-text-primary)",
    };
    const timeInputStyle = {
        paddingTop: `0.5rem`,
        paddingBottom: `0.5rem`,
        paddingLeft: `0.5rem`,
        paddingRight: `0.5rem`,
        borderColor: "var(--color-border-light)",
        backgroundColor: "var(--color-panel-bg)",
        color: "var(--color-text-primary)",
    }

    const orderedThemes = useMemo(() => {
        return [...themes].sort((a, b) => a.name.localeCompare(b.name));
    }, [themes]);
    const accentSwatches = useMemo(() => ([
        "var(--color-accent-swatch-1)",
        "var(--color-accent-swatch-2)",
        "var(--color-accent-swatch-3)",
        "var(--color-accent-swatch-4)",
        "var(--color-accent-swatch-5)",
        "var(--color-accent-swatch-6)",
    ]), []);
    const resolvedSwatches = useMemo(() => {
        if (typeof document === "undefined") {
            return accentSwatches.map((token) => ({ token, value: token }));
        }
        const style = getComputedStyle(document.documentElement);
        return accentSwatches.map((token) => {
            const match = token.match(/var\((--[^)]+)\)/);
            const value = match ? style.getPropertyValue(match[1]).trim() : token;
            return { token, value };
        });
    }, [accentSwatches, activeThemeName]);

    const ColorField = ({
                            label,
                            value,
                            onChange,
                            disabled = false,
                        }: {
        label: string;
        value: string;
        onChange: (value: string) => void;
        disabled?: boolean;
    }) => (
        <div className="flex items-center justify-between gap-3">
            <label className="text-sm" style={mutedLabelStyle}>{label}</label>
            <input
                type="color"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="size-9 rounded-md border cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                style={inputBaseStyle}
                disabled={disabled}
            />
        </div>
    );

    return (
        <div className="space-y-6">
            <SettingSection title="Theme" description="Choose your preferred theme">
                <div className="grid grid-cols-2 gap-3">
                    {orderedThemes.map((theme) => (
                        <ThemeOption
                            key={theme.name}
                            label={theme.name}
                            selected={theme.name.toLowerCase() === activeThemeName.toLowerCase()}
                            onClick={() => setActiveTheme(theme.name)}
                        />
                    ))}
                </div>
            </SettingSection>

            <SettingSection title="Theme Schedule" description="Automatically switch themes">
                <div className="grid grid-cols-3 gap-3">
                    <button
                        onClick={() => setThemeSchedule('system')}
                        className="px-3 py-2 rounded-lg border text-xs font-semibold transition-all hover:bg-[color:var(--color-panel-hover)]"
                        style={{
                            ...pillStyle,
                            borderColor: themeSchedule === 'system' ? "var(--primary)" : "var(--color-border-light)",
                            backgroundColor: themeSchedule === 'system' ? "color-mix(in srgb, var(--primary) 10%, transparent)" : "var(--color-panel-bg)",
                            color: themeSchedule === 'system' ? "var(--primary)" : "var(--color-text-secondary)",
                        }}
                    >
                        System
                    </button>
                    <button
                        onClick={() => setThemeSchedule('sun')}
                        className="px-3 py-2 rounded-lg border text-xs font-semibold transition-all hover:bg-[color:var(--color-panel-hover)]"
                        style={{
                            ...pillStyle,
                            borderColor: themeSchedule === 'sun' ? "var(--primary)" : "var(--color-border-light)",
                            backgroundColor: themeSchedule === 'sun' ? "color-mix(in srgb, var(--primary) 10%, transparent)" : "var(--color-panel-bg)",
                            color: themeSchedule === 'sun' ? "var(--primary)" : "var(--color-text-secondary)",
                        }}
                    >
                        Sunrise / Sunset
                    </button>
                    <button
                        onClick={() => setThemeSchedule('custom')}
                        className="px-3 py-2 rounded-lg border text-xs font-semibold transition-all hover:bg-[color:var(--color-panel-hover)]"
                        style={{
                            ...pillStyle,
                            borderColor: themeSchedule === 'custom' ? "var(--primary)" : "var(--color-border-light)",
                            backgroundColor: themeSchedule === 'custom' ? "color-mix(in srgb, var(--primary) 10%, transparent)" : "var(--color-panel-bg)",
                            color: themeSchedule === 'custom' ? "var(--primary)" : "var(--color-text-secondary)",
                        }}
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
                            <label className="text-xs" style={mutedLabelStyle}>Light start</label>
                            <input
                                type="time"
                                defaultValue="08:00"
                                className="px-2 py-1 border rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] focus:border-transparent transition-all"
                                style={timeInputStyle}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <label className="text-xs" style={mutedLabelStyle}>Dark start</label>
                            <input
                                type="time"
                                defaultValue="20:00"
                                className="px-2 py-1 border rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] focus:border-transparent transition-all"
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
                    {resolvedSwatches.map(({ token, value }) => (
                        <button
                            key={token}
                            onClick={() => setAccentColor(value)}
                            className="size-10 rounded-lg border-2 transition-all relative group"
                            style={{
                                backgroundColor: token,
                                borderColor: accentColor === value ? "var(--primary)" : "var(--color-border-light)",
                            }}
                        >
                            {accentColor === value && (
                                <Check className="size-4 text-[color:var(--primary-foreground)] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                            )}
                        </button>
                    ))}
                </div>
                <div className="mt-4 flex items-center gap-3">
                    <input
                        type="color"
                        value={accentColor}
                        onChange={(e) => {
                            setAccentColor(e.target.value);
                        }}
                        className="size-10 rounded-lg border cursor-pointer"
                        style={inputBaseStyle}
                    />
                    <input
                        type="text"
                        value={accentColor}
                        onChange={(e) => {
                            setAccentColor(e.target.value);
                        }}
                        className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] focus:border-transparent transition-all w-32"
                        style={{ ...pillStyle, ...inputBaseStyle }}
                    />
                    <div
                        className="size-8 rounded-md border"
                        style={{ backgroundColor: accentColor, borderColor: "var(--color-border-light)" }}
                    />
                </div>
            </SettingSection>

            <SettingSection title="Terminal Colors" description="Adjust terminal callout colors">
                <div className="mb-4">
                    <ToggleSetting
                        label="Custom terminal colors"
                        description="Override the theme defaults for terminal callouts"
                        checked={terminalCustom}
                        onChange={setTerminalCustom}
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <ColorField label="Header bg" value={terminalHeaderBg} onChange={setTerminalHeaderBg} disabled={!terminalCustom} />
                    <ColorField label="Line bg" value={terminalLineBg} onChange={setTerminalLineBg} disabled={!terminalCustom} />
                    <ColorField label="Border" value={terminalBorder} onChange={setTerminalBorder} disabled={!terminalCustom} />
                    <ColorField label="Text" value={terminalText} onChange={setTerminalText} disabled={!terminalCustom} />
                    <ColorField label="Muted" value={terminalMuted} onChange={setTerminalMuted} disabled={!terminalCustom} />
                </div>
            </SettingSection>

            <SettingSection title="Syntax Highlighting" description="Customize code block colors">
                <div className="mb-4">
                    <ToggleSetting
                        label="Custom syntax colors"
                        description="Override the theme defaults for code blocks"
                        checked={syntaxCustom}
                        onChange={setSyntaxCustom}
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <ColorField label="Comment" value={syntaxComment} onChange={setSyntaxComment} disabled={!syntaxCustom} />
                    <ColorField label="Keyword" value={syntaxKeyword} onChange={setSyntaxKeyword} disabled={!syntaxCustom} />
                    <ColorField label="Operator" value={syntaxOperator} onChange={setSyntaxOperator} disabled={!syntaxCustom} />
                    <ColorField label="String" value={syntaxString} onChange={setSyntaxString} disabled={!syntaxCustom} />
                    <ColorField label="Number" value={syntaxNumber} onChange={setSyntaxNumber} disabled={!syntaxCustom} />
                    <ColorField label="Variable" value={syntaxVariable} onChange={setSyntaxVariable} disabled={!syntaxCustom} />
                    <ColorField label="Function" value={syntaxFunction} onChange={setSyntaxFunction} disabled={!syntaxCustom} />
                </div>
            </SettingSection>

            <SettingSection title="Visual Style" description="Adjust density and styling">
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between">
                        <label className="text-sm" style={mutedLabelStyle}>Density</label>
                        <select
                            value={density}
                            onChange={(e) => setDensity(e.target.value as 'compact' | 'comfortable')}
                            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] focus:border-transparent transition-all cursor-pointer"
                            style={{ ...pillStyle, ...inputBaseStyle }}
                        >
                            <option value="compact">Compact</option>
                            <option value="comfortable">Comfortable</option>
                        </select>
                    </div>
                    <div className="flex items-center justify-between">
                        <label className="text-sm" style={mutedLabelStyle}>Corner radius</label>
                        <select
                            value={radius}
                            onChange={(e) => setRadius(e.target.value as '6' | '10' | '16')}
                            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] focus:border-transparent transition-all cursor-pointer"
                            style={{ ...pillStyle, ...inputBaseStyle }}
                        >
                            <option value="6">Sharp</option>
                            <option value="10">Balanced</option>
                            <option value="16">Soft</option>
                        </select>
                    </div>
                    <div className="flex items-center justify-between">
                        <label className="text-sm" style={mutedLabelStyle}>Shadows</label>
                        <select
                            value={shadow}
                            onChange={(e) => setShadow(e.target.value as 'subtle' | 'medium' | 'strong')}
                            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] focus:border-transparent transition-all cursor-pointer"
                            style={{ ...pillStyle, ...inputBaseStyle }}
                        >
                            <option value="subtle">Subtle</option>
                            <option value="medium">Medium</option>
                            <option value="strong">Strong</option>
                        </select>
                    </div>
                    <div className="flex items-center justify-between">
                        <label className="text-sm" style={mutedLabelStyle}>Icon style</label>
                        <select
                            value={iconStyle}
                            onChange={(e) => setIconStyle(e.target.value as 'outline' | 'filled')}
                            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] focus:border-transparent transition-all cursor-pointer"
                            style={{ ...pillStyle, ...inputBaseStyle }}
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
                        <label className="text-sm" style={mutedLabelStyle}>Sidebar position</label>
                        <select
                            value={sidebarPosition}
                            onChange={(e) => setSidebarPosition(e.target.value as 'left' | 'right')}
                            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] focus:border-transparent transition-all cursor-pointer"
                            style={{ ...pillStyle, ...inputBaseStyle }}
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
