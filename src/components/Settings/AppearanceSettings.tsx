import { SettingSection } from "./items/SettingSection.tsx";
import { ToggleSetting } from "./items/ToggleSetting.tsx";
import { SettingItem } from "./items/SettingItem.tsx";
import { ThemePreview } from "./ThemePreview.tsx";
import { Check } from "lucide-react";
import { useMemo } from "react";
import { useAppearanceStore, useThemeStore } from "../../stores";
import { useAppTranslation } from "../../i18n/react.tsx";

export function AppearanceSettings() {
    const { t } = useAppTranslation("settings");
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
    const inlineCodeColor = useAppearanceStore((state) => state.inlineCodeColor);
    const setInlineCodeColor = useAppearanceStore((state) => state.setInlineCodeColor);
    const inlineCodeCustom = useAppearanceStore((state) => state.inlineCodeCustom);
    const setInlineCodeCustom = useAppearanceStore((state) => state.setInlineCodeCustom);
    const themeScheduleMode = useAppearanceStore((state) => state.themeScheduleMode);
    const setThemeScheduleMode = useAppearanceStore((state) => state.setThemeScheduleMode);
    const themeScheduleLightStart = useAppearanceStore((state) => state.themeScheduleLightStart);
    const setThemeScheduleLightStart = useAppearanceStore((state) => state.setThemeScheduleLightStart);
    const themeScheduleDarkStart = useAppearanceStore((state) => state.themeScheduleDarkStart);
    const setThemeScheduleDarkStart = useAppearanceStore((state) => state.setThemeScheduleDarkStart);

    const pillStyle = {
        paddingTop: `0.5rem`,
        paddingBottom: `0.5rem`,
        paddingLeft: `0.5rem`,
        paddingRight: `0.5rem`,
    };
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
    };
    const isThemeActive = (name: string) => name.toLowerCase() === activeThemeName.toLowerCase();
    const selectedScheduleStyle = {
        borderColor: "var(--primary)",
        backgroundColor: "color-mix(in srgb, var(--primary) 10%, transparent)",
        color: "var(--primary)",
    };
    const idleScheduleStyle = {
        borderColor: "var(--color-border-light)",
        backgroundColor: "var(--color-panel-bg)",
        color: "var(--color-text-secondary)",
    };

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
            <SettingSection title={t("appearance.themeTitle")} description={t("appearance.themeDescription")}>
                <div className="grid grid-cols-2 gap-3 mb-4">
                    {orderedThemes.map((theme) => {
                        const isActive = isThemeActive(theme.name);
                        return (
                            <button
                                key={theme.name}
                                onClick={() => setActiveTheme(theme.name)}
                                className="p-3 rounded-xl border-2 transition-all group"
                                style={{
                                    borderColor: isActive ? "var(--primary)" : "var(--color-border-light)",
                                    backgroundColor: isActive
                                        ? "color-mix(in srgb, var(--primary) 2%, transparent)"
                                        : "var(--color-panel-bg)",
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <ThemePreview theme={theme} size="sm" />
                                    <div className="flex-1 text-left min-w-0">
                                        <p className="text-sm font-bold truncate" style={{ color: "var(--color-text-primary)" }}>
                                            {theme.name}
                                        </p>
                                        <p className="text-[10px] truncate" style={{ color: "var(--color-text-muted)" }}>
                                            {theme.variant === "light" ? t("appearance.lightMode") : theme.variant === "dark" ? t("appearance.darkMode") : t("appearance.customTheme")}
                                        </p>
                                    </div>
                                    <div
                                        className="flex-shrink-0 size-4 rounded-full border-2 flex items-center justify-center transition-all"
                                        style={{
                                            borderColor: isActive ? "var(--primary)" : "var(--color-border-light)",
                                            backgroundColor: isActive ? "var(--primary)" : "transparent",
                                        }}
                                    >
                                        {isActive && <Check className="size-2.5 text-[color:var(--primary-foreground)]" />}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </SettingSection>

            <SettingSection title={t("appearance.scheduleTitle")} description={t("appearance.scheduleDescription")}>
                <div className="grid grid-cols-4 gap-3">
                    <button
                        onClick={() => setThemeScheduleMode('off')}
                        className="px-3 py-2 rounded-lg border text-xs font-semibold transition-all hover:bg-[color:var(--color-panel-hover)]"
                        style={{
                            ...pillStyle,
                            ...(themeScheduleMode === "off" ? selectedScheduleStyle : idleScheduleStyle),
                        }}
                    >
                        {t("appearance.off")}
                    </button>
                    <button
                        onClick={() => setThemeScheduleMode('system')}
                        className="px-3 py-2 rounded-lg border text-xs font-semibold transition-all hover:bg-[color:var(--color-panel-hover)]"
                        style={{
                            ...pillStyle,
                            ...(themeScheduleMode === "system" ? selectedScheduleStyle : idleScheduleStyle),
                        }}
                    >
                        {t("appearance.system")}
                    </button>
                    <button
                        onClick={() => setThemeScheduleMode('sun')}
                        className="px-3 py-2 rounded-lg border text-xs font-semibold transition-all hover:bg-[color:var(--color-panel-hover)]"
                        style={{
                            ...pillStyle,
                            ...(themeScheduleMode === "sun" ? selectedScheduleStyle : idleScheduleStyle),
                        }}
                    >
                        {t("appearance.sunriseSunset")}
                    </button>
                    <button
                        onClick={() => setThemeScheduleMode('custom')}
                        className="px-3 py-2 rounded-lg border text-xs font-semibold transition-all hover:bg-[color:var(--color-panel-hover)]"
                        style={{
                            ...pillStyle,
                            ...(themeScheduleMode === "custom" ? selectedScheduleStyle : idleScheduleStyle),
                        }}
                    >
                        {t("appearance.custom")}
                    </button>
                </div>
                {themeScheduleMode === 'custom' && (
                    <div
                        className="mt-4 grid grid-cols-2 gap-3 rounded-lg"
                        style={{
                            paddingTop: `1rem`,
                            paddingBottom: `1rem`,
                            paddingLeft: `1rem`,
                            paddingRight: `1rem`,
                            backgroundColor: "var(--color-panel-hover)",
                        }}
                    >
                        <div className="flex items-center justify-between">
                            <label className="text-xs" style={mutedLabelStyle}>{t("appearance.lightStart")}</label>
                            <input
                                type="time"
                                value={themeScheduleLightStart}
                                onChange={(e) => setThemeScheduleLightStart(e.target.value)}
                                className="px-2 py-1 border rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] focus:border-transparent transition-all"
                                style={timeInputStyle}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <label className="text-xs" style={mutedLabelStyle}>{t("appearance.darkStart")}</label>
                            <input
                                type="time"
                                value={themeScheduleDarkStart}
                                onChange={(e) => setThemeScheduleDarkStart(e.target.value)}
                                className="px-2 py-1 border rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] focus:border-transparent transition-all"
                                style={timeInputStyle}
                            />
                        </div>
                    </div>
                )}
            </SettingSection>

            <SettingSection title={t("appearance.accentTitle")} description={t("appearance.accentDescription")}>
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

            <SettingSection title={t("appearance.terminalTitle")} description={t("appearance.terminalDescription")}>
                <div className="mb-4">
                    <ToggleSetting
                        label={t("appearance.customTerminalColors")}
                        description={t("appearance.customTerminalColorsDescription")}
                        checked={terminalCustom}
                        onChange={setTerminalCustom}
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <ColorField label={t("appearance.headerBg")} value={terminalHeaderBg} onChange={setTerminalHeaderBg} disabled={!terminalCustom} />
                    <ColorField label={t("appearance.lineBg")} value={terminalLineBg} onChange={setTerminalLineBg} disabled={!terminalCustom} />
                    <ColorField label={t("appearance.border")} value={terminalBorder} onChange={setTerminalBorder} disabled={!terminalCustom} />
                    <ColorField label={t("appearance.text")} value={terminalText} onChange={setTerminalText} disabled={!terminalCustom} />
                    <ColorField label={t("appearance.muted")} value={terminalMuted} onChange={setTerminalMuted} disabled={!terminalCustom} />
                </div>
            </SettingSection>

            <SettingSection title={t("appearance.syntaxTitle")} description={t("appearance.syntaxDescription")}>
                <div className="mb-4">
                    <ToggleSetting
                        label={t("appearance.customSyntaxColors")}
                        description={t("appearance.customSyntaxColorsDescription")}
                        checked={syntaxCustom}
                        onChange={setSyntaxCustom}
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <ColorField label={t("appearance.comment")} value={syntaxComment} onChange={setSyntaxComment} disabled={!syntaxCustom} />
                    <ColorField label={t("appearance.keyword")} value={syntaxKeyword} onChange={setSyntaxKeyword} disabled={!syntaxCustom} />
                    <ColorField label={t("appearance.operator")} value={syntaxOperator} onChange={setSyntaxOperator} disabled={!syntaxCustom} />
                    <ColorField label={t("appearance.string")} value={syntaxString} onChange={setSyntaxString} disabled={!syntaxCustom} />
                    <ColorField label={t("appearance.number")} value={syntaxNumber} onChange={setSyntaxNumber} disabled={!syntaxCustom} />
                    <ColorField label={t("appearance.variable")} value={syntaxVariable} onChange={setSyntaxVariable} disabled={!syntaxCustom} />
                    <ColorField label={t("appearance.function")} value={syntaxFunction} onChange={setSyntaxFunction} disabled={!syntaxCustom} />
                </div>
            </SettingSection>

            <SettingSection title={t("appearance.inlineCodeTitle")} description={t("appearance.inlineCodeDescription")}>
                <div className="mb-4">
                    <ToggleSetting
                        label={t("appearance.customInlineCodeColor")}
                        description={t("appearance.customInlineCodeColorDescription")}
                        checked={inlineCodeCustom}
                        onChange={setInlineCodeCustom}
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <ColorField
                        label={t("appearance.text")}
                        value={inlineCodeColor}
                        onChange={setInlineCodeColor}
                        disabled={!inlineCodeCustom}
                    />
                </div>
            </SettingSection>

            <SettingSection title={t("appearance.visualStyleTitle")} description={t("appearance.visualStyleDescription")}>
                <div className="grid grid-cols-2 gap-4">
                    <SettingItem label={t("appearance.density")}>
                        <select
                            value={density}
                            onChange={(e) => setDensity(e.target.value as 'compact' | 'comfortable')}
                            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] focus:border-transparent transition-all cursor-pointer"
                            style={{ ...pillStyle, ...inputBaseStyle }}
                        >
                            <option value="compact">{t("appearance.compact")}</option>
                            <option value="comfortable">{t("appearance.comfortable")}</option>
                        </select>
                    </SettingItem>
                    <SettingItem label={t("appearance.cornerRadius")}>
                        <select
                            value={radius}
                            onChange={(e) => setRadius(e.target.value as '6' | '10' | '16')}
                            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] focus:border-transparent transition-all cursor-pointer"
                            style={{ ...pillStyle, ...inputBaseStyle }}
                        >
                            <option value="6">{t("appearance.sharp")}</option>
                            <option value="10">{t("appearance.balanced")}</option>
                            <option value="16">{t("appearance.soft")}</option>
                        </select>
                    </SettingItem>
                    <SettingItem label={t("appearance.shadows")}>
                        <select
                            value={shadow}
                            onChange={(e) => setShadow(e.target.value as 'subtle' | 'medium' | 'strong')}
                            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] focus:border-transparent transition-all cursor-pointer"
                            style={{ ...pillStyle, ...inputBaseStyle }}
                        >
                            <option value="subtle">{t("appearance.subtle")}</option>
                            <option value="medium">{t("appearance.medium")}</option>
                            <option value="strong">{t("appearance.strong")}</option>
                        </select>
                    </SettingItem>
                    <SettingItem label={t("appearance.iconStyle")}>
                        <select
                            value={iconStyle}
                            onChange={(e) => setIconStyle(e.target.value as 'outline' | 'filled')}
                            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] focus:border-transparent transition-all cursor-pointer"
                            style={{ ...pillStyle, ...inputBaseStyle }}
                        >
                            <option value="outline">{t("appearance.outline")}</option>
                            <option value="filled">{t("appearance.filled")}</option>
                        </select>
                    </SettingItem>
                </div>
            </SettingSection>

            <SettingSection title={t("appearance.layoutTitle")} description={t("appearance.layoutDescription")}>
                <div className="grid grid-cols-2 gap-4">
                    <SettingItem label={t("appearance.sidebarPosition")}>
                        <select
                            value={sidebarPosition}
                            onChange={(e) => setSidebarPosition(e.target.value as 'left' | 'right')}
                            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] focus:border-transparent transition-all cursor-pointer"
                            style={{ ...pillStyle, ...inputBaseStyle }}
                        >
                            <option value="left">{t("appearance.left")}</option>
                            <option value="right">{t("appearance.right")}</option>
                        </select>
                    </SettingItem>
                    <ToggleSetting
                        label={t("appearance.toolbar")}
                        description={t("appearance.toolbarDescription")}
                        checked={toolbarVisible}
                        onChange={setToolbarVisible}
                    />
                </div>
            </SettingSection>
        </div>
    );
}
