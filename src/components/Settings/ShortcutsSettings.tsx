import { SettingSection } from "./items/SettingSection.tsx";
import { ShortcutItem } from "./items/ShortcutItem.tsx";
import { useAppTranslation } from "../../i18n/react.tsx";
import { APP_SHORTCUTS } from "../../constants/shortcuts.ts";

export function ShortcutsSettings() {
    const { t } = useAppTranslation("settings");

    return (
        <div className="space-y-6">
            <SettingSection title={t("shortcuts.title")} description={t("shortcuts.description")}>
                <div className="space-y-3">
                    {APP_SHORTCUTS.map((shortcut) => (
                        <ShortcutItem
                            key={shortcut.id}
                            label={t(shortcut.labelKey)}
                            shortcut={shortcut.shortcut}
                        />
                    ))}
                </div>
            </SettingSection>
        </div>
    )
}
