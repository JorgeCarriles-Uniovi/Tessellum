import { SettingSection } from "./items/SettingSection.tsx";
import { SettingItem } from "./items/SettingItem.tsx";
import { ToggleSetting } from "./items/ToggleSetting.tsx";
import { useAccessibilityStore } from "../../stores";
import type { ColorFilter, UiScale } from "../../stores/accessibilityStore";

export function AccessibilitySettings() {
    const highContrast = useAccessibilityStore((state) => state.highContrast);
    const setHighContrast = useAccessibilityStore((state) => state.setHighContrast);
    const reducedMotion = useAccessibilityStore((state) => state.reducedMotion);
    const setReducedMotion = useAccessibilityStore((state) => state.setReducedMotion);
    const uiScale = useAccessibilityStore((state) => state.uiScale);
    const setUiScale = useAccessibilityStore((state) => state.setUiScale);
    const colorFilter = useAccessibilityStore((state) => state.colorFilter);
    const setColorFilter = useAccessibilityStore((state) => state.setColorFilter);

    return (
        <div className="space-y-6">
            <SettingSection title="Readability" description="Improve visibility and comfort">
                <ToggleSetting
                    label="High contrast"
                    description="Increase contrast for better readability"
                    checked={highContrast}
                    onChange={setHighContrast}
                />
                <SettingItem label="UI Scale">
                    <select
                        value={String(uiScale)}
                        onChange={(e) => setUiScale(Number(e.target.value) as UiScale)}
                        className="px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-blue-600)] focus:border-transparent transition-all bg-white cursor-pointer"
                        style={{
                            paddingTop: `0.5rem`,
                            paddingBottom: `0.5rem`,
                            paddingLeft: `0.5rem`,
                            paddingRight: `0.5rem`,
                        }}
                    >
                        <option value="90">90%</option>
                        <option value="100">100%</option>
                        <option value="110">110%</option>
                        <option value="125">125%</option>
                        <option value="150">150%</option>
                    </select>
                </SettingItem>
            </SettingSection>

            <SettingSection title="Motion" description="Reduce animations and transitions">
                <ToggleSetting
                    label="Reduce motion"
                    description="Minimize animations and motion effects"
                    checked={reducedMotion}
                    onChange={setReducedMotion}
                />
            </SettingSection>

            <SettingSection title="Color" description="Color accessibility options">
                <SettingItem label="Color filter">
                    <select
                        value={colorFilter}
                        onChange={(e) => setColorFilter(e.target.value as ColorFilter)}
                        className="px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-blue-600)] focus:border-transparent transition-all bg-white cursor-pointer"
                        style={{
                            paddingTop: `0.5rem`,
                            paddingBottom: `0.5rem`,
                            paddingLeft: `0.5rem`,
                            paddingRight: `0.5rem`,
                        }}
                    >
                        <option value="none">None</option>
                        <option value="protanopia">Protanopia</option>
                        <option value="deuteranopia">Deuteranopia</option>
                        <option value="tritanopia">Tritanopia</option>
                    </select>
                </SettingItem>
            </SettingSection>
        </div>
    );
}
