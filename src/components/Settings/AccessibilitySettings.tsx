import { SettingSection } from "./items/SettingSection.tsx";
import { SettingItem } from "./items/SettingItem.tsx";
import { ToggleSetting } from "./items/ToggleSetting.tsx";
import { useAccessibilityStore } from "../../stores";
import type { ColorFilter, UiScale } from "../../stores/accessibilityStore";
import { useAppTranslation } from "../../i18n/react.tsx";

export function AccessibilitySettings() {
    const highContrast = useAccessibilityStore((state) => state.highContrast);
    const setHighContrast = useAccessibilityStore((state) => state.setHighContrast);
    const reducedMotion = useAccessibilityStore((state) => state.reducedMotion);
    const setReducedMotion = useAccessibilityStore((state) => state.setReducedMotion);
    const uiScale = useAccessibilityStore((state) => state.uiScale);
    const setUiScale = useAccessibilityStore((state) => state.setUiScale);
    const colorFilter = useAccessibilityStore((state) => state.colorFilter);
    const setColorFilter = useAccessibilityStore((state) => state.setColorFilter);
    const { t } = useAppTranslation("settings");
    const inputStyle = {
        borderColor: "var(--color-border-light)",
        backgroundColor: "var(--color-panel-bg)",
        color: "var(--color-text-primary)",
        paddingTop: `0.5rem`,
        paddingBottom: `0.5rem`,
        paddingLeft: `0.5rem`,
        paddingRight: `0.5rem`,
    };

    return (
        <div className="space-y-6">
            <SettingSection title={t("accessibility.readabilityTitle")} description={t("accessibility.readabilityDescription")}>
                <ToggleSetting
                    label={t("accessibility.highContrast")}
                    description={t("accessibility.highContrastDescription")}
                    checked={highContrast}
                    onChange={setHighContrast}
                />
                <SettingItem label={t("accessibility.uiScale")}>
                    <select
                        value={String(uiScale)}
                        onChange={(e) => setUiScale(Number(e.target.value) as UiScale)}
                        className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] focus:border-transparent transition-all cursor-pointer"
                        style={inputStyle}
                    >
                        <option value="90">90%</option>
                        <option value="100">100%</option>
                        <option value="110">110%</option>
                        <option value="125">125%</option>
                        <option value="150">150%</option>
                    </select>
                </SettingItem>
            </SettingSection>

            <SettingSection title={t("accessibility.motionTitle")} description={t("accessibility.motionDescription")}>
                <ToggleSetting
                    label={t("accessibility.reduceMotion")}
                    description={t("accessibility.reduceMotionDescription")}
                    checked={reducedMotion}
                    onChange={setReducedMotion}
                />
            </SettingSection>

            <SettingSection title={t("accessibility.colorTitle")} description={t("accessibility.colorDescription")}>
                <SettingItem label={t("accessibility.colorFilter")}>
                    <select
                        value={colorFilter}
                        onChange={(e) => setColorFilter(e.target.value as ColorFilter)}
                        className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] focus:border-transparent transition-all cursor-pointer"
                        style={inputStyle}
                    >
                        <option value="none">{t("accessibility.none")}</option>
                        <option value="protanopia">Protanopia</option>
                        <option value="deuteranopia">Deuteranopia</option>
                        <option value="tritanopia">Tritanopia</option>
                    </select>
                </SettingItem>
            </SettingSection>
        </div>
    );
}
